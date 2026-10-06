/* ポップアップとページのパネルで共有する部品（設定の保存・ファイルを変換する・結果を画面に出す）。外へは通信しない。 */
(function (root) {
  'use strict';
  const DEFAULTS = { item: '衣類', honorific: '様' };

  const store = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;

  async function loadSettings() {
    const s = store();
    if (!s) return { ...DEFAULTS };
    const got = await s.get(['item', 'honorific']);
    return { item: got.item || DEFAULTS.item, honorific: got.honorific || DEFAULTS.honorific };
  }

  async function saveSettings(partial) {
    const s = store();
    if (s) await s.set(partial);
  }

  function baseNameFor(file) {
    const stem = (file.name || 'orders').replace(/\.[^.]*$/, '');
    return `clickpost_${stem}.csv`;
  }

  // ファイルを変換する。item は検査してから使う（呼ぶ側が先に validateItem で止めていても二重に守る）
  async function convertFile(file, settings) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const res = ClickpostCore.run(bytes, { item: settings.item, honorific: settings.honorific, baseName: baseNameFor(file) });
    if (res.status === 2 && new TextDecoder('shift_jis').decode(bytes.slice(0, 300)).includes('お届け先郵便番号')) {
      res.message = 'これはクリックポスト用に変換済みのファイルです。ここには落とさず、クリックポストの「ファイルを選択」でそのまま選んでください（元の Shopify の CSV を落とし直すと、同じ注文をもう一度入れてしまいます）';
    } else if (res.status === 2 && res.message.startsWith('列が足りない')) {
      res.message = `Shopify の注文エクスポートではないようです（${res.message}）。Shopify の注文一覧で「エクスポート」した CSV を選んでください`;
    }
    return res;
  }

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
    }
    for (const c of children) if (c) e.append(c);
    return e;
  }

  function downloadLink(file, label) {
    const url = URL.createObjectURL(new Blob([file.bytes], { type: 'text/csv' }));
    return el('a', { class: 'dl', href: url, download: file.name, 'data-testid': 'download-link', text: label || `${file.name}（${file.count}件）をダウンロード` });
  }

  function clickDownload(file) {
    const a = downloadLink(file);
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 5000);
  }

  // 結果の表を container に出す（毎回作り直す＝2回目以降も前の結果が残らない）
  function renderResult(container, res, opts = {}) {
    container.replaceChildren();
    if (res.status === 2) {
      container.append(el('p', { class: 'msg ng', 'data-testid': 'result-error', text: res.message }));
      return;
    }
    const wrote = res.written || 0;
    container.append(el('p', { class: 'msg ' + (res.errors.length ? 'warn' : 'ok'), 'data-testid': 'result-summary',
      text: `変換できた注文: ${wrote}件／入れなかった注文: ${res.errors.length}件／飛ばした注文: ${res.skipped.length}件` }));
    if (res.files.length && !opts.hideLinks) {
      const box = el('div', { class: 'links' });
      res.files.forEach((f) => box.append(downloadLink(f)));
      if (res.files.length > 1) container.append(el('p', { class: 'note', text: `クリックポストは1回に40件までなので、${res.files.length}つのファイルに分けました。1つずつ申し込んでください。` }));
      container.append(box);
    }
    if (res.errors.length) {
      container.append(el('p', { class: 'head', text: '入れなかった注文（直して、もう一度選んでください）' }));
      const ul = el('ul', { 'data-testid': 'result-errors' });
      res.errors.forEach((m) => ul.append(el('li', { text: m })));
      container.append(ul);
    }
    if (res.skipped.length) {
      container.append(el('p', { class: 'head', text: '飛ばした注文（送らなくてよいもの）' }));
      const ul = el('ul', { 'data-testid': 'result-skipped' });
      res.skipped.forEach((m) => ul.append(el('li', { text: m })));
      container.append(ul);
    }
  }

  root.ClickpostUI = { DEFAULTS, loadSettings, saveSettings, convertFile, renderResult, downloadLink, clickDownload, el };
})(typeof self !== 'undefined' ? self : this);
