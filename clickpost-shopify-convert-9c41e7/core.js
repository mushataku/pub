/* Shopify の注文 CSV → クリックポストのまとめ申込 CSV（変換の核）。
 * sites/clickpost/shopify_to_clickpost.py の写し。規則を変えるときは Python 版と両方を変え、
 * tests/test_clickpost_extension_parity.py（バイト単位の同値テスト）を緑に保つ。
 * 外へは通信しない（住所は PC の外に出ない）。Shift_JIS 化は lib/encoding.min.js（encoding-japanese・MIT）。 */
(function (root, factory) {
  const Enc = typeof Encoding !== 'undefined' ? Encoding : (typeof require !== 'undefined' ? require('./lib/encoding.min.js') : null);
  const api = factory(Enc);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickpostCore = api;
})(typeof self !== 'undefined' ? self : this, function (Enc) {
  'use strict';

  const HEADER = [
    'お届け先郵便番号', 'お届け先氏名', 'お届け先敬称',
    'お届け先住所1行目', 'お届け先住所2行目', 'お届け先住所3行目', 'お届け先住所4行目',
    '内容品',
  ];
  const NAME_WIDTH = 40;
  const LINE_WIDTH = 40;
  const ITEM_WIDTH = 30;
  const ADDRESS_LINES = 4;
  const MAX_ROWS_PER_FILE = 40;
  const HONORIFICS = ['様', '御中'];
  const REQUIRED_COLUMNS = ['Shipping Name', 'Shipping Zip', 'Shipping City', 'Shipping Address1'];
  const PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
    '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
    '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  ];

  // Python の str.isspace / re の \s と同じ集合（JS の \s とは \x1c-\x1f・\x85・﻿ が違う）
  const WS = '\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  const WS_RUN = new RegExp('[' + WS + ']+', 'g');
  const WS_LEAD = new RegExp('^[' + WS + ']+');
  const WS_TRAIL = new RegExp('[' + WS + ']+$');
  const pyStrip = (s) => s.replace(WS_LEAD, '').replace(WS_TRAIL, '');
  const pyLstrip = (s) => s.replace(WS_LEAD, '');
  const pyRstrip = (s) => s.replace(WS_TRAIL, '');

  const TO_CP932 = new Map([
    ['−', '-'], ['‐', '-'], ['‑', '-'], ['‒', '-'], ['–', '-'],
    ['—', '-'], ['―', '-'], ['﹣', '-'], ['〜', '~'], [' ', ' '],
  ]);

  // --- 幅・正規化 -------------------------------------------------------------
  const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);
  // unicodedata.east_asian_width が Na / H の字（それ以外は全角＝2 に数える。曖昧幅も2）
  const NARROW = [[0x20, 0x7e], [0xa2, 0xa3], [0xa5, 0xa6], [0xac, 0xac], [0xaf, 0xaf], [0x27e6, 0x27ed], [0x2985, 0x2986],
    [0x20a9, 0x20a9], [0xff61, 0xffbe], [0xffc2, 0xffc7], [0xffca, 0xffcf], [0xffd2, 0xffd7], [0xffda, 0xffdc], [0xffe8, 0xffee]];

  function width(text) {
    let w = 0;
    for (const ch of text) w += inRanges(ch.codePointAt(0), NARROW) ? 1 : 2;
    return w;
  }

  function clean(text) {
    let t = (text || '').normalize('NFKC');
    let out = '';
    for (const ch of t) out += TO_CP932.has(ch) ? TO_CP932.get(ch) : ch;
    return pyStrip(out.replace(WS_RUN, ' '));
  }

  function normalizeZip(raw) {
    const digits = clean(raw).replace(new RegExp("[" + WS + "'〒ー-]", 'g'), '');
    return /^\p{Nd}{7}$/u.test(digits) ? `${digits.slice(0, 3)}-${digits.slice(3)}` : null;
  }

  function province(row) {
    const name = clean(row.get('Shipping Province Name'));
    if (name) return name;
    const code = clean(row.get('Shipping Province'));
    const m = /^JP-(\p{Nd}{2})$/u.exec(code);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= PREFECTURES.length) return PREFECTURES[Number(m[1]) - 1];
    return code;
  }

  // --- 住所の折り返し -----------------------------------------------------------
  function chop(piece, limit) {
    const out = [];
    let cur = '';
    for (const ch of piece) {
      if (cur && width(cur + ch) > limit) { out.push(cur); cur = ''; }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  function wrap(pieces, limit = LINE_WIDTH) {
    const lines = [];
    let cur = '';
    for (const piece of pieces) {
      for (const chunk of chop(piece, limit)) {
        if (cur && width(cur + chunk) > limit) { lines.push(pyRstrip(cur)); cur = pyLstrip(chunk); }
        else cur += chunk;
      }
    }
    if (pyStrip(cur)) lines.push(pyRstrip(cur));
    return lines.filter((l) => l);
  }

  const words = (text) => text.split(/(?<= )/).filter((w) => w);

  function addressLines(prov, city, addr1, addr2, company) {
    let head;
    if (prov && addr1.startsWith(prov)) head = [addr1];
    else if (city && addr1.startsWith(city)) head = [prov, addr1];
    else head = [prov, city, ...words(addr1)];
    const tails = [addr2, company].filter((t) => t);
    let lines = wrap(head);
    for (const tail of tails) lines = lines.concat(wrap(words(tail)));
    if (lines.length > ADDRESS_LINES) lines = wrap(head.concat(words(' ' + tails.join(' '))));
    return lines.length > 0 && lines.length <= ADDRESS_LINES ? lines : null;
  }

  // --- cp932 -----------------------------------------------------------------
  // encoding-japanese の表は Python の cp932 と BMP で次の点だけ違う（全 BMP を突き合わせた）: 私用領域 U+E000-E757・U+0080・U+F8F0-F8F3
  function sjisBytes(ch) {
    const cp = ch.codePointAt(0);
    if (cp === 0x80) return [0x80];
    if (cp >= 0xf8f0 && cp <= 0xf8f3) return [[0xa0, 0xfd, 0xfe, 0xff][cp - 0xf8f0]];
    if (cp >= 0xe000 && cp <= 0xe757) {
      const n = cp - 0xe000, t = n % 188;
      return [0xf0 + Math.floor(n / 188), t < 63 ? 0x40 + t : 0x41 + t];
    }
    const r = Enc.convert(ch, { to: 'SJIS', from: 'UNICODE', type: 'array' });
    return r.length === 1 && r[0] === 0x3f && ch !== '?' ? null : r;
  }
  const encodes = (ch) => sjisBytes(ch) !== null;

  function encodeCp932(text) {
    const out = [];
    for (const ch of text) {
      const b = sjisBytes(ch);
      if (b === null) throw new Error('cp932 に無い字: ' + ch);
      out.push(...b);
    }
    return Uint8Array.from(out);
  }

  function unencodable(text) {
    return Array.from(new Set(Array.from(text).filter((ch) => !encodes(ch))))
      .sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
  }

  // --- 変換 ---------------------------------------------------------------------
  function convert(records, item, honorific = '様') {
    const res = { rows: [], errors: [], skipped: [] };
    const seen = new Set();
    records.forEach((row, idx) => {
      const i = idx + 2;                                   // 1行目はヘッダ
      const order = pyStrip(row.get('Name') || '');
      let label = order || `${i}行目`;
      if (order) {
        if (seen.has(order)) return;                       // 同じ注文の2品目以降の行
        seen.add(order);
      }
      if (!REQUIRED_COLUMNS.some((c) => pyStrip(row.get(c) || ''))) {
        res.skipped.push(`${label}: 配送先が空（店頭受取・デジタル商品など）`);
        return;
      }
      if (pyStrip(row.get('Cancelled at') || '')) { res.skipped.push(`${label}: キャンセル済み`); return; }
      const country = clean(row.get('Shipping Country'));
      if (country && !['JP', 'JAPAN', '日本'].includes(country.toUpperCase())) {
        res.errors.push(`${label}: 海外宛（${country}）はクリックポストで送れない`);
        return;
      }
      const name = clean(row.get('Shipping Name'));
      label = pyStrip(`${label} ${name}`);
      const zip = normalizeZip(row.get('Shipping Zip'));
      const lines = addressLines(province(row), clean(row.get('Shipping City')), clean(row.get('Shipping Address1')),
        clean(row.get('Shipping Address2')), clean(row.get('Shipping Company')));
      const problems = [];
      if (!name) problems.push('氏名が空');
      else if (width(name) > NAME_WIDTH) problems.push(`氏名が長い（全角20・半角40まで: ${name}）`);
      if (zip === null) problems.push(`郵便番号が7桁にならない（${row.has('Shipping Zip') ? (row.get('Shipping Zip') ?? '') : ''}）`);
      if (lines === null) problems.push('住所が4行（各全角20・半角40）に収まらない');
      const padded = (lines || []).concat(['', '', '', '']).slice(0, ADDRESS_LINES);
      const out = [zip || '', name, honorific, ...padded, item];
      const bad = unencodable(out.join(''));
      if (bad) problems.push(`Shift_JIS に無い字がある（${bad}）`);
      if (problems.length) { res.errors.push(`${label}: ` + problems.join('／')); return; }
      res.rows.push(out);
    });
    return res;
  }

  // --- CSV 読み（Python csv.DictReader の既定と同じ挙動） -------------------------------
  function parseCsv(text) {
    const records = [];
    let row = [], field = '', state = 'start', inRecordChars = false;
    const endField = () => { row.push(field); field = ''; };
    const endRecord = () => { if (row.length || inRecordChars) { endField(); records.push(row); } row = []; field = ''; inRecordChars = false; state = 'start'; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (state === 'start') {
        if (c === '"') { state = 'quoted'; inRecordChars = true; }
        else if (c === ',') { inRecordChars = true; endField(); }
        else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRecord(); }
        else { field += c; inRecordChars = true; state = 'field'; }
      } else if (state === 'field') {
        if (c === ',') { endField(); state = 'start'; }
        else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRecord(); }
        else field += c;
      } else if (state === 'quoted') {
        if (c === '"') state = 'quote_in_quoted'; else field += c;
      } else {                                             // quote_in_quoted
        if (c === '"') { field += '"'; state = 'quoted'; }
        else if (c === ',') { endField(); state = 'start'; }
        else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRecord(); }
        else { field += c; state = 'field'; }
      }
    }
    if (inRecordChars || row.length) endRecord();
    return records;
  }

  function decodeShopify(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);     // BOM は外れる
    } catch (e) {
      try { return new TextDecoder('shift_jis', { fatal: true }).decode(bytes); }
      catch (e2) { throw new Error('UTF-8 でも Shift_JIS でも読めない'); }
    }
  }

  function readRecords(bytes) {
    const rows = parseCsv(decodeShopify(bytes));
    if (!rows.length) return [];
    const header = rows[0];
    return rows.slice(1).map((r) => {
      const m = new Map();
      header.forEach((h, k) => m.set(h, k < r.length ? r[k] : null));
      return m;
    });
  }

  function csvField(v) {
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function writeCsvs(rows, baseName) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += MAX_ROWS_PER_FILE) chunks.push(rows.slice(i, i + MAX_ROWS_PER_FILE));
    if (!chunks.length) chunks.push([]);
    const dot = baseName.lastIndexOf('.');
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName, ext = dot > 0 ? baseName.slice(dot) : '';
    return chunks.map((chunk, n) => {
      const text = [HEADER, ...chunk].map((r) => r.map(csvField).join(',') + '\r\n').join('');
      return { name: chunks.length === 1 ? baseName : `${stem}_${n + 1}${ext}`, bytes: encodeCp932(text), count: chunk.length };
    });
  }

  function validateItem(value) {
    const item = clean(value);
    if (!item) return { ok: false, message: '内容品が空です' };
    if (width(item) > ITEM_WIDTH) return { ok: false, message: '内容品は全角15文字（半角30文字）までです' };
    if (!Array.from(item).every(encodes)) return { ok: false, message: '内容品に使えない文字が入っています' };
    return { ok: true, item };
  }

  // 1本で全部: status 0=全部入れた／1=入れなかった注文あり／2=列が足りない・読めない（Python 版の終了コードと同じ）
  function run(bytes, { item: rawItem, honorific = '様', baseName = 'clickpost.csv' }) {
    const checked = validateItem(rawItem);               // Python 版の --item と同じく clean() してから使う
    if (!checked.ok) return { status: 2, message: checked.message, files: [], errors: [], skipped: [] };
    if (!HONORIFICS.includes(honorific)) return { status: 2, message: '敬称は「様」か「御中」です', files: [], errors: [], skipped: [] };
    const item = checked.item;
    if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {   // 'PK'＝xlsx / zip
      return { status: 2, message: 'Excel（xlsx）のファイルです。Shopify の「エクスポート」で出した CSV を使ってください', files: [], errors: [], skipped: [] };
    }
    let records;
    try { records = readRecords(bytes); }
    catch (e) { return { status: 2, message: String(e.message || e), files: [], errors: [], skipped: [] }; }
    const columns = new Set(records.length ? Array.from(records[0].keys()) : []);
    const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c));
    if (!columns.has('Shipping Province Name') && !columns.has('Shipping Province')) missing.push('Shipping Province Name（または Shipping Province）');
    if (missing.length) {
      const message = records.length ? `列が足りない: ${missing.join(', ')}` : '注文が1件もありません（空のファイルか、見出しだけです）';
      return { status: 2, message, files: [], errors: [], skipped: [] };
    }
    const res = convert(records, item, honorific);
    const files = res.rows.length ? writeCsvs(res.rows, baseName) : [];
    return { status: res.errors.length ? 1 : 0, message: '', files, errors: res.errors, skipped: res.skipped, written: res.rows.length };
  }

  return { HEADER, HONORIFICS, MAX_ROWS_PER_FILE, width, clean, normalizeZip, convert, parseCsv, readRecords, writeCsvs, validateItem, run, encodes };
});
