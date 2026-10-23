/* 広告運用の勉強サイト・試せる模型（A: 連鎖の計算／B: 予算と飽和／C: 少ない件数の揺らぎ）。file:// で動く素のスクリプト。 */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var HAS = Object.prototype.hasOwnProperty;

  function adn(k, fallback) {
    var n = window.AD && window.AD.n;
    return (n && HAS.call(n, k)) ? String(n[k]) : fallback;
  }

  function R(k) {
    var raw = window.AD && window.AD.raw;
    if (!raw) return null;
    var v = raw[k];
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function copy(o) { var c = {}; for (var k in o) if (HAS.call(o, k)) c[k] = o[k]; return c; }
  function same(a, b) {
    var k;
    for (k in a) if (HAS.call(a, k) && a[k] !== b[k]) return false;
    for (k in b) if (HAS.call(b, k) && !HAS.call(a, k)) return false;
    return true;
  }
  function val(x, s) { return typeof x === 'function' ? x(s) : x; }

  /* ---- 要素を作る ---- */
  function setAttrs(e, attrs) {
    if (attrs) for (var a in attrs) if (HAS.call(attrs, a) && attrs[a] != null) e.setAttribute(a, String(attrs[a]));
    return e;
  }
  function h(tag, attrs, text) {
    var e = setAttrs(document.createElement(tag), attrs);
    if (text != null) e.textContent = text;
    return e;
  }
  function sv(tag, attrs, text) {
    var e = setAttrs(document.createElementNS(SVGNS, tag), attrs);
    if (text != null) e.textContent = text;
    return e;
  }
  function svgBox(w, hh, title) {
    var s = sv('svg', { viewBox: '0 0 ' + w + ' ' + hh, role: 'img' });
    s.appendChild(sv('title', null, title));
    return s;
  }
  function txt(svg, x, y, str, o) {
    o = o || {};
    if (!ok(x) || !ok(y)) return null;
    return svg.appendChild(sv('text', {
      x: r1(x), y: r1(y), 'font-size': o.size || 13, 'text-anchor': o.anchor || null,
      'font-weight': o.weight || null, 'class': o.cls || 's-ink'
    }, str));
  }
  function more(a, extra) { if (extra) for (var k in extra) if (HAS.call(extra, k)) a[k] = extra[k]; return a; }
  function line(svg, x1, y1, x2, y2, cls, extra) {
    if (!ok(x1) || !ok(y1) || !ok(x2) || !ok(y2)) return null;
    return svg.appendChild(sv('line', more({ x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), 'class': cls }, extra)));
  }
  function rect(svg, x, y, w, hh, cls, extra) {
    if (!ok(x) || !ok(y) || !ok(w) || !ok(hh) || w < 0 || hh < 0) return null;
    return svg.appendChild(sv('rect', more({ x: r1(x), y: r1(y), width: r1(w), height: r1(hh), 'class': cls }, extra)));
  }
  function circle(svg, x, y, r, cls, extra) {
    if (!ok(x) || !ok(y)) return null;
    return svg.appendChild(sv('circle', more({ cx: r1(x), cy: r1(y), r: r, 'class': cls }, extra)));
  }
  function diamond(svg, x, y, r, cls, extra) {
    if (!ok(x) || !ok(y)) return null;
    var p = [x, y - r, x + r, y, x, y + r, x - r, y].map(r1);
    return svg.appendChild(sv('polygon', more({ points: p[0] + ',' + p[1] + ' ' + p[2] + ',' + p[3] + ' ' + p[4] + ',' + p[5] + ' ' + p[6] + ',' + p[7], 'class': cls }, extra)));
  }
  function poly(svg, pts, cls, extra) {
    var s = [];
    for (var i = 0; i < pts.length; i++) if (ok(pts[i][0]) && ok(pts[i][1])) s.push(r1(pts[i][0]) + ',' + r1(pts[i][1]));
    if (s.length < 2) return null;
    return svg.appendChild(sv('polyline', more({ points: s.join(' '), fill: 'none', 'class': cls }, extra)));
  }

  /* ---- 数の書き方 ---- */
  function commas(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtFixed(v, dec) {
    if (!ok(v) || Math.abs(v) >= 1e15) return null;
    var t = Math.abs(v).toFixed(dec), p = t.split('.');
    p[0] = commas(p[0]);
    var out = p.join('.');
    return (v < 0 && /[1-9]/.test(out)) ? '−' + out : out;
  }
  function fmtCount(v) {
    if (!ok(v) || Math.abs(v) >= 1e15) return null;
    if (v === 0) return '0';
    if (v > 0 && v < 0.01) return '0.01未満';
    if (Math.abs(v - Math.round(v)) < 0.005) return fmtFixed(Math.round(v), 0);
    if (v < 1) return fmtFixed(v, 2);
    if (v < 100) return fmtFixed(v, 1);
    return fmtFixed(v, 0);
  }
  function fmtCountShort(v) {
    if (!ok(v)) return '—';
    if (v >= 1e8) return fmtFixed(v / 1e8, 2) + '億';
    if (v >= 1e5) return fmtFixed(v / 1e4, 1) + '万';
    return fmtCount(v);
  }
  function fmtYen(v) {
    if (!ok(v) || Math.abs(v) >= 1e15) return null;
    if (Math.abs(v) >= 1e8) return fmtFixed(v / 1e8, 2) + '億円';
    return fmtFixed(v, 0) + '円';
  }
  function fmtMan(v) {
    if (!ok(v)) return '';
    if (v === 0) return '0';
    if (v >= 1e8) return fmtFixed(v / 1e8, (v % 1e8 === 0) ? 0 : 1) + '億';
    if (v >= 1e4) return fmtFixed(v / 1e4, (v % 1e4 === 0) ? 0 : 1) + '万';
    return fmtFixed(v, (v % 1 === 0) ? 0 : 1);
  }
  function fmtPctAuto(p) {
    if (!ok(p)) return null;
    if (p === 0) return '0%';
    var a = Math.abs(p);
    if (a < 0.0001) return '0.0001%未満';
    return fmtFixed(p, a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4) + '%';
  }
  function or(s, why) { return s == null ? '—（' + why + '）' : s; }
  function clip(s) { s = String(s); return s.length > 20 ? s.slice(0, 20) + '…' : s; }
  function fmtInput(v, p) {
    if (!ok(v)) return '';
    if (p.int) return fmtFixed(Math.round(v), 0);
    var t = v.toFixed(p.dec == null ? 2 : p.dec);
    if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
    var parts = t.split('.');
    parts[0] = commas(parts[0].replace('-', ''));
    return (v < 0 ? '−' : '') + parts.join('.');
  }

  /* 全角・カンマ・単位・「万」を受け付けて数に直す。読めなければ err を返す */
  function readNum(rawIn) {
    var s = String(rawIn == null ? '' : rawIn);
    try { s = s.normalize('NFKC'); } catch (e) { /* 古いブラウザは正規化なしで続ける */ }
    s = s.replace(/[−‐-―－]/g, '-');
    s = s.replace(/[,\s円%¥￥人件]/g, '');
    var mult = 1;
    if (/万$/.test(s)) { mult = 10000; s = s.slice(0, -1); }
    else if (/億$/.test(s)) { mult = 1e8; s = s.slice(0, -1); }
    if (s === '') return { err: 'blank' };
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { err: 'nan' };
    var v = parseFloat(s) * mult;
    if (!isFinite(v)) return { err: 'nan' };
    return { v: v };
  }

  function niceStep(v, n) {
    if (!(v > 0) || !isFinite(v)) return 1;
    var raw = v / n, e = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / e;
    var f = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return f * e;
  }
  function axisOf(v, n) {
    var st = niceStep(v, n), k = Math.max(1, Math.ceil(v / st - 1e-9));
    return { step: st, n: k, max: st * k };
  }

  /* ---- 模型の器（入力・戻す/やり直す・実数に戻す・出力） ---- */
  function buildSim(root, cfg) {
    var defaults = copy(cfg.defaults);
    var state = copy(defaults), hist = [copy(defaults)], idx = 0, dragKey = null, changed = null;
    root.innerHTML = '';
    root.appendChild(h('h3', null, cfg.title));
    (cfg.intro || []).forEach(function (t) { root.appendChild(h('p', { 'class': 'cav' }, t)); });

    var groups = {};
    function grp(name) {
      if (groups[name]) return groups[name];
      var g = h('div', { 'class': 'ctrls' });
      if (name === 'main') root.appendChild(g);
      else {
        var gi = cfg.groups[name];
        var d = h('details', { 'class': 'rates', open: gi.open ? '' : null });
        d.appendChild(h('summary', null, gi.title));
        d.appendChild(g);
        root.appendChild(d);
      }
      groups[name] = g;
      return g;
    }
    var io = {};
    cfg.params.forEach(function (p) {
      var id = cfg.id + '-' + p.key;
      var row = h('div', { 'class': 'row' });
      row.appendChild(h('label', { 'for': id }, p.label));
      var right = h('div');
      var inw = h('div', { 'class': 'inwrap' });
      var inp = h('input', { type: 'text', id: id, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'data-key': p.key });
      inw.appendChild(inp);
      if (p.unit) inw.appendChild(h('span', { 'class': 'unit' }, p.unit));
      right.appendChild(inw);
      var rg = null;
      if (p.slider) {
        rg = h('input', { type: 'range', min: p.slider.min, max: p.slider.max, step: p.slider.step, 'aria-label': p.label + '（つまみ）', 'data-key': p.key });
        right.appendChild(rg);
      }
      row.appendChild(right);
      grp(p.group || 'main').appendChild(row);
      io[p.key] = { inp: inp, rg: rg, p: p };
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); fromText(p); } });
      inp.addEventListener('change', function () { fromText(p); });
      if (rg) {
        rg.addEventListener('input', function () { fromSlider(p, rg, true); });
        rg.addEventListener('change', function () { fromSlider(p, rg, false); });
      }
    });

    var btns = h('div', { 'class': 'btns' });
    (cfg.presets || []).forEach(function (pr) {
      var b = h('button', { type: 'button' }, pr.label);
      b.addEventListener('click', function () { setMsg(''); var ns = copy(state); for (var k in pr.values) if (HAS.call(pr.values, k)) ns[k] = pr.values[k]; commit(ns, null, null); });
      btns.appendChild(b);
    });
    var bUndo = h('button', { type: 'button', 'class': 'undo', title: '1つ前の値に戻す' }, '↶ 戻す');
    var bRedo = h('button', { type: 'button', 'class': 'redo', title: '戻したのをやり直す' }, '↷ やり直す');
    var bReset = h('button', { type: 'button', 'class': 'primary reset' }, '実数に戻す');
    btns.appendChild(bUndo); btns.appendChild(bRedo); btns.appendChild(bReset);
    (cfg.extras || []).forEach(function (ex) {
      var b = h('button', { type: 'button', 'class': ex.cls || null }, ex.label);
      b.addEventListener('click', function () { setMsg(''); commit(ex.run(copy(state)), ex.key || null, null); });
      btns.appendChild(b);
    });
    root.appendChild(btns);
    var msg = h('p', { 'class': 'msg', role: 'status', 'aria-live': 'polite' });
    root.appendChild(msg);
    var out = h('div', { 'class': 'out' });
    root.appendChild(out);

    function setMsg(t) { msg.textContent = t || ''; }
    function sync() {
      for (var k in io) {
        if (!HAS.call(io, k)) continue;
        var x = io[k];
        if (document.activeElement !== x.inp || !dragKey) x.inp.value = fmtInput(state[k], x.p);
        if (x.rg && dragKey !== k) {
          var sl = x.p.slider, v = Math.min(sl.max, Math.max(sl.min, state[k]));
          x.rg.value = String(v);
        }
      }
      bUndo.disabled = idx <= 0;
      bRedo.disabled = idx >= hist.length - 1;
    }
    function render() {
      sync();
      out.innerHTML = '';
      try { cfg.draw(state, changed, out); }
      catch (e) { out.innerHTML = ''; out.appendChild(h('p', null, '表示に失敗しました。「実数に戻す」で元に戻せます。')); }
    }
    function commit(ns, ch, drag) {
      if (same(ns, hist[idx])) { state = copy(hist[idx]); if (!drag) dragKey = null; sync(); return; }
      if (drag && dragKey === drag) hist[idx] = copy(ns);
      else {
        hist = hist.slice(0, idx + 1);
        hist.push(copy(ns));
        if (hist.length > 200) hist.shift();
        idx = hist.length - 1;
      }
      dragKey = drag || null;
      state = copy(ns);
      changed = ch;
      render();
    }
    function endDrag() {
      if (dragKey && idx > 0 && same(hist[idx], hist[idx - 1])) { hist.pop(); idx--; state = copy(hist[idx]); }
      dragKey = null;
      sync();
    }
    function fromText(p) {
      var x = io[p.key], rawStr = x.inp.value, r = readNum(rawStr), old = state[p.key];
      if (r.err) {
        x.inp.value = fmtInput(old, p);
        setMsg(p.label + ': ' + (r.err === 'blank' ? '空欄なので前の値に戻しました' : '数字として読めないので前の値に戻しました（入力: ' + clip(rawStr) + '）'));
        return;
      }
      var v = r.v, notes = [];
      if (p.int && v !== Math.round(v)) { v = Math.round(v); notes.push('整数に丸めました'); }
      if (!p.int) v = parseFloat(v.toFixed(p.dec == null ? 2 : p.dec));
      var lo = val(p.min, state), hi = val(p.max, state);
      if (v < lo || v > hi) {
        var nv = Math.min(hi, Math.max(lo, v));
        notes.push(fmtInput(lo, p) + '〜' + fmtInput(hi, p) + ' の範囲なので ' + fmtInput(nv, p) + ' にしました（入力: ' + clip(rawStr) + '）');
        v = nv;
      }
      if (!notes.length && fmtInput(v, p) === fmtInput(old, p)) { x.inp.value = fmtInput(old, p); return; }
      var ns = copy(state);
      ns[p.key] = v;
      var extra = cfg.fix ? cfg.fix(ns, p.key) : '';
      if (extra) notes.push(extra);
      setMsg(notes.length ? p.label + ': ' + notes.join('・') : '');
      commit(ns, p.key, null);
    }
    function fromSlider(p, rg, live) {
      var v = parseFloat(rg.value);
      if (!ok(v)) return;
      if (p.int) v = Math.round(v);
      v = Math.min(val(p.max, state), Math.max(val(p.min, state), v));
      if (v !== state[p.key]) {
        var ns = copy(state);
        ns[p.key] = v;
        var extra = cfg.fix ? cfg.fix(ns, p.key) : '';
        setMsg(extra ? p.label + ': ' + extra : '');
        commit(ns, p.key, p.key);
      }
      if (!live) endDrag();
    }
    bUndo.addEventListener('click', function () {
      dragKey = null;
      if (idx <= 0) return;
      idx--; state = copy(hist[idx]); changed = null; setMsg(''); render();
    });
    bRedo.addEventListener('click', function () {
      dragKey = null;
      if (idx >= hist.length - 1) return;
      idx++; state = copy(hist[idx]); changed = null; setMsg(''); render();
    });
    bReset.addEventListener('click', function () { setMsg(''); commit(copy(defaults), null, null); });
    render();
  }

  function kpi(box, k, v, cls) {
    var d = h('div', { 'class': 'kpi' + (cls ? ' ' + cls : '') });
    d.appendChild(h('div', { 'class': 'k' }, k));
    d.appendChild(h('div', { 'class': 'v' }, v));
    box.appendChild(d);
  }
  function srcLine(out, extra) {
    var m = (window.AD && window.AD.meta) || {};
    out.appendChild(h('p', { 'class': 'cav' }, '数字の出どころ: ' + (m.src || '[未取得]') + (extra ? '。' + extra : '')));
  }

  /* ---- 模型A: 広告費から紹介料までの連鎖 ---- */
  var STAGES = ['クリック', '応募', '有効応募', '設定可能', '面談設定', '新規面談', '共有面談', '推薦', '書類通過', '企業面接', '内定', '承諾'];
  var STAGE_ROLE = ['media', 'mk', 'mk', 'gn', 'gn', 'gn', 'gn', 'gn', 'co', 'co', 'co', 'gn'];
  var ROLE_FILL = { media: 'f-blue', mk: 'f-orange', gn: 'f-aqua', co: 's-muted' };
  var ROLE_NAME = { media: '媒体の自動', mk: 'MK', gn: 'Gooner', co: '企業' };
  var RK = ['valid', 'settable', 'set', 'iv1', 'iv2', 'rec', 'doc', 'iv3', 'offer', 'acc'];
  var RATE_LABEL = ['有効応募率（応募→有効）', '設定可能率（有効→設定可能）', '面談設定率（設定可能→設定）', '新規面談の実施率（設定→実施）',
    '共有面談率（新規→共有）', '推薦率（共有→推薦）', '書類通過率（推薦→通過）', '企業面接率（通過→面接）', '内定率（面接→内定）', '承諾率（内定→承諾）'];
  var RATE_SHORT = ['有効', '設定可能', '面談設定', '新規面談', '共有面談', '推薦', '書類通過', '企業面接', '内定', '承諾'];

  function ratesFrom(prefix) {
    var v = {}, prev = R(prefix + '.app');
    if (prev == null) return null;
    for (var i = 0; i < RK.length; i++) {
      var cur = R(prefix + '.' + RK[i]);
      if (cur == null) return null;
      v['r_' + RK[i]] = prev > 0 ? cur / prev * 100 : 0;
      prev = cur;
    }
    return v;
  }
  function presetA(prefix, mk) {
    var spend = R(mk + '.spend'), clicks = R(mk + '.clicks'), app = R(prefix + '.app'), rates = ratesFrom(prefix);
    if (spend == null || !clicks || app == null || !rates) return null;
    var v = { spend: spend, cpc: spend / clicks, cvr: app / clicks * 100 };
    for (var k in rates) if (HAS.call(rates, k)) v[k] = rates[k];
    return v;
  }
  function calcA(s) {
    var clicks = s.cpc > 0 ? s.spend / s.cpc : NaN;
    var counts = [clicks, clicks * s.cvr / 100], prod = 1;
    for (var i = 0; i < RK.length; i++) {
      var r = s['r_' + RK[i]] / 100;
      prod *= r;
      counts.push(counts[counts.length - 1] * r);
    }
    var app = counts[1], acc = counts[11];
    return {
      counts: counts, prod: prod, app: app, acc: acc,
      cpa: app > 0 ? s.spend / app : NaN,
      cpacc: acc > 0 ? s.spend / acc : NaN,
      sales: acc * s.fee,
      roas: s.spend > 0 ? acc * s.fee / s.spend : NaN
    };
  }
  function firstChangedStage(ch) {
    if (ch === 'spend' || ch === 'cpc') return 0;
    if (ch === 'cvr') return 1;
    if (ch && ch.indexOf('r_') === 0) { var i = RK.indexOf(ch.slice(2)); return i >= 0 ? i + 2 : -1; }
    return -1;
  }

  function drawStages(s, c, ch) {
    var W = 340, y0 = 30, rh = 22, n = STAGES.length;
    var H = y0 + n * rh + 66;
    var svg = svgBox(W, H, '段階ごとの件数と1件あたりの費用（承諾 ' + or(fmtCount(c.acc), '計算不可') + '人・内定承諾単価 ' + or(fmtYen(c.cpacc), '承諾0人') + '）');
    var maxC = ok(c.counts[0]) ? Math.max(c.counts[0], 1) : 1;
    var hi = Math.max(5, Math.ceil(Math.log(maxC) / Math.LN10)), lo = -1, bx = 64, bw = 116;
    function bxw(v) { if (!ok(v) || v <= 0) return 0; var t = (Math.log(v) / Math.LN10 - lo) / (hi - lo); return Math.max(2, Math.min(1, t) * bw); }
    txt(svg, 58, 18, '段階', { size: 12, anchor: 'end', cls: 's-ink2' });
    txt(svg, bx, 18, '棒＝件数（対数）', { size: 12, cls: 's-ink2' });
    txt(svg, 248, 18, '件数', { size: 12, anchor: 'end', cls: 's-ink2' });
    txt(svg, 336, 18, '1件あたり', { size: 12, anchor: 'end', cls: 's-ink2' });
    for (var d = 0; d <= hi; d++) {
      var gx = bx + (d - lo) / (hi - lo) * bw;
      line(svg, gx, y0 - 2, gx, y0 + n * rh, 'st-grid', { 'stroke-width': 1 });
    }
    var st = firstChangedStage(ch);
    if (st >= 0) rect(svg, 2, y0 + st * rh - 1, W - 4, (n - st) * rh + 1, 'st-violet', { fill: 'none', 'stroke-width': 2.5, rx: 6 });
    for (var i = 0; i < n; i++) {
      var y = y0 + i * rh, v = c.counts[i];
      txt(svg, 58, y + 15, STAGES[i], { anchor: 'end' });
      var w = bxw(v);
      if (w > 0) rect(svg, bx, y + 4, w, 14, ROLE_FILL[STAGE_ROLE[i]], { rx: 2 });
      txt(svg, 248, y + 15, fmtCountShort(v), { anchor: 'end' });
      var u = (ok(v) && v > 0) ? s.spend / v : NaN;
      var us = fmtYen(u);
      txt(svg, 336, y + 15, us == null ? '—' : us, { anchor: 'end' });
    }
    var ty = y0 + n * rh + 15;
    var tickNames = { '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1千', '4': '1万', '5': '10万', '6': '100万', '7': '1千万', '8': '1億', '9': '10億' };
    for (d = 0; d <= hi; d += 2) {
      txt(svg, bx + (d - lo) / (hi - lo) * bw, ty, tickNames[String(d)] || ('1e' + d), { size: 12, anchor: 'middle', cls: 's-ink2' });
    }
    var ly = ty + 22, lx = 4;
    ['media', 'mk', 'gn', 'co'].forEach(function (r) {
      rect(svg, lx, ly - 11, 12, 12, ROLE_FILL[r], { rx: 2 });
      var label = ROLE_NAME[r];
      txt(svg, lx + 16, ly, label, { size: 12 });
      lx += 16 + label.length * 12 + (r === 'gn' ? 2 : 14);
    });
    if (st >= 0) {
      rect(svg, 4, ly + 9, 20, 12, 'st-violet', { fill: 'none', 'stroke-width': 2.5, rx: 3 });
      txt(svg, 30, ly + 20, '紫の枠＝今動かした所から下流（数が動いた段）', { size: 12 });
    }
    return svg;
  }

  function drawRoasGauge(c) {
    var W = 340, H = 62, x0 = 10, x1 = 330, max = 4;
    var good = ok(c.roas) && c.roas >= 1;
    var label = !ok(c.roas) ? 'ROAS は出ない（広告費0）' : (good ? '✓ 広告費を回収（ROAS ' : '✗ 広告費割れ（ROAS ') + fmtFixed(c.roas * 100, 0) + '%）';
    var svg = svgBox(W, H, 'ROAS のゲージ: ' + label);
    rect(svg, x0, 22, x1 - x0, 16, 'f-grid', { rx: 3 });
    if (ok(c.roas) && c.roas > 0) rect(svg, x0, 22, Math.min(1, c.roas / max) * (x1 - x0), 16, good ? 'f-good' : 'f-critical', { rx: 3 });
    var x100 = x0 + (x1 - x0) / max;
    line(svg, x100, 16, x100, 44, 'st-ink', { 'stroke-width': 2 });
    txt(svg, x0, 14, label, { weight: '700' });
    txt(svg, x0, 57, '0%', { size: 12, cls: 's-ink2' });
    txt(svg, x100 + 3, 57, '100%＝広告費と同額の売上', { size: 12, cls: 's-ink2' });
    txt(svg, x1, 57, '400%', { size: 12, anchor: 'end', cls: 's-ink2' });
    if (ok(c.roas) && c.roas > max) txt(svg, x1 - 4, 35, '▶ 枠の外', { size: 12, anchor: 'end', weight: '700' });
    return svg;
  }

  function sensRows(s, base) {
    function rel(ns) { var c = calcA(ns); return (ok(base.roas) && base.roas > 0 && ok(c.roas)) ? c.roas / base.roas - 1 : NaN; }
    function capped(label, key) {
      var ns = copy(s), a = s[key], b = Math.min(100, a * 1.1);
      ns[key] = b;
      var note = a >= 100 ? '100%・上限' : (fmtFixed(a, 1) + '→' + (a * 1.1 > 100 ? '100%・上限' : fmtFixed(b, 1) + '%'));
      return { label: label, d: rel(ns), note: note, cap: a * 1.1 > 100 };
    }
    var rates = RK.map(function (k, i) { return capped(RATE_SHORT[i], 'r_' + k); });
    rates.push(capped('応募率', 'cvr'));
    /* 上限に当たらない率は全部同じ +10%（弾力性1）なので1行にまとめ、上限に当たった率だけ別の行に出す */
    var free = rates.filter(function (r) { return !r.cap; }), hit = rates.filter(function (r) { return r.cap; });
    var rows = [];
    if (free.length) rows.push({ label: hit.length ? 'ほかの率' : 'どの率も', d: free[0].d, note: free.length + '本' });
    rows = rows.concat(hit);
    var nf = copy(s); nf.fee = s.fee * 1.1;
    rows.push({ label: '紹介料', d: rel(nf), note: '' });
    var nc = copy(s); nc.cpc = s.cpc * 0.9;
    rows.push({ label: 'CPC', d: rel(nc), note: '−10%' });
    var ns = copy(s); ns.spend = s.spend * 1.1;
    rows.push({ label: '広告費', d: rel(ns), note: '承諾は+10%・比は不変' });
    return rows;
  }
  function drawSens(s, base) {
    var rows = sensRows(s, base), W = 340, rh = 21, y0 = 6, H = y0 + rows.length * rh + 6, bx = 72, k = 9;
    var svg = svgBox(W, H, '各項目を10%良くしたときの ROAS の変化（率は+10%・CPC は−10%）');
    var x10 = bx + 10 * k;
    line(svg, x10, y0, x10, y0 + rows.length * rh, 'st-grid', { 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    rows.forEach(function (r, i) {
      var y = y0 + i * rh;
      txt(svg, 66, y + 15, r.label, { anchor: 'end' });
      var str;
      if (!ok(r.d)) str = '—（承諾0人）';
      else {
        var pct = r.d * 100, w = Math.max(0, Math.min(12, pct)) * k;
        if (w > 0) rect(svg, bx, y + 4, w, 13, 'f-violet', { rx: 2 });
        var sign = Math.abs(pct) < 0.05 ? '±' : (pct > 0 ? '+' : '');
        str = sign + fmtFixed(Math.abs(pct) < 0.05 ? 0 : pct, 1) + '%' + (r.note ? '（' + r.note + '）' : '');
        txt(svg, bx + w + 4, y + 15, str, { size: 12 });
        return;
      }
      txt(svg, bx + 4, y + 15, str, { size: 12 });
    });
    return svg;
  }

  function drawA(s, ch, out) {
    var c = calcA(s);
    var box = h('div', { 'class': 'kpis' });
    kpi(box, '応募単価（CPA）', or(fmtYen(c.cpa), s.spend <= 0 ? '広告費0' : '応募0件'));
    kpi(box, '内定承諾単価', or(fmtYen(c.cpacc), c.acc > 0 ? '大きすぎて表示できない' : '承諾0人'));
    var accs = fmtCount(c.acc);
    kpi(box, '承諾数', accs == null ? '—（計算不可）' : accs + '人');
    kpi(box, '売上（承諾×平均紹介料）', or(fmtYen(c.sales), '計算不可'));
    kpi(box, 'ROAS（売上÷広告費）', ok(c.roas) ? (c.roas >= 1 ? '✓ ' : '✗ ') + fmtFixed(c.roas * 100, 0) + '%' : '—（広告費0）');
    kpi(box, '損益分岐の内定承諾単価（＝平均紹介料）', or(fmtYen(s.fee), '計算不可'));
    var need = s.fee > 0 ? fmtCount(s.spend / s.fee) : null;
    kpi(box, '広告費を回収するのに要る承諾数', need == null ? '—（紹介料0）' : need + '人');
    out.appendChild(box);

    var f = h('p', { 'class': 'formula' });
    if (ok(c.cpa) && ok(c.cpacc) && c.prod > 0) {
      var same1 = Math.abs(c.cpa / c.prod - c.cpacc) <= Math.abs(c.cpacc) * 1e-9;
      f.textContent = '応募単価 ' + fmtYen(c.cpa) + ' ÷ 率の積 ' + fmtPctAuto(c.prod * 100) + ' ＝ ' + or(fmtYen(c.cpa / c.prod), '大きすぎ') +
        ' ＝ 内定承諾単価 ' + (same1 ? '✓（一致）' : '✗（不一致）');
    } else {
      f.textContent = '率の積が 0（または広告費0）なので、内定承諾単価は出ません。';
    }
    out.appendChild(f);

    out.appendChild(h('h4', null, '段階ごとの件数と1件あたりの費用'));
    out.appendChild(drawStages(s, c, ch));
    out.appendChild(h('p', { 'class': 'cav' }, '1件あたり＝広告費÷その段の件数。下の段ほど件数が減るので、1件あたりは上がる。いちばん下が内定承諾単価。'));

    out.appendChild(h('h4', null, 'ROAS（売上÷広告費）'));
    out.appendChild(drawRoasGauge(c));

    out.appendChild(h('h4', null, 'どこを10%良くすると ROAS がどれだけ動くか'));
    out.appendChild(h('p', { 'class': 'cav' }, 'どの率も10%良くなれば ROAS は同じ10%上がる（弾力性1・CPC だけ −1）'));
    out.appendChild(drawSens(s, c));
    out.appendChild(h('p', { 'class': 'cav' }, '広告費を増やしても、この模型では応募単価が変わらないので ROAS は動かない。実際は増やすほど1件が高くなる（2章の飽和）。上限100%に当たる率は10%伸ばせないので、その率だけ別の行に出しています。'));
    srcLine(out, '9月は暦月（9/1〜9/30）の広告費・クリック・応募と、各段の集計期間の件数から率を出した。応募は Gooner の数え（' +
      or(fmtFixed(R('c09.all.gn_app'), 0), '[未取得]') + '件）で、MK の数えは ' + or(fmtFixed(R('c09.all.mk_app'), 0), '[未取得]') + '件');
  }

  function setupA(root) {
    var d = presetA('c09.all', 'mk09.tot'), fee = R('ret09.mk.avg');
    if (!d || fee == null) return false;
    d.fee = fee;
    var params = [
      { key: 'spend', label: '広告費（月）', unit: '円', min: 0, max: 1e8, int: true, slider: { min: 0, max: 5e6, step: 1000 } },
      { key: 'cpc', label: 'クリック単価（CPC）', unit: '円', min: 1, max: 10000, dec: 2, slider: { min: 1, max: 400, step: 0.5 } },
      { key: 'cvr', label: '応募率（クリック→応募）', unit: '%', min: 0.01, max: 100, dec: 3, slider: { min: 0.1, max: 10, step: 0.01 } }
    ];
    RK.forEach(function (k, i) {
      params.push({ key: 'r_' + k, label: RATE_LABEL[i], unit: '%', min: 0, max: 100, dec: 1, group: 'rates', slider: { min: 0, max: 100, step: 0.1 } });
    });
    params.push({ key: 'fee', label: '平均紹介料（1承諾あたり）', unit: '円', min: 0, max: 1e7, int: true, slider: { min: 0, max: 1.5e6, step: 1000 } });
    var presets = [];
    var ps = presetA('c09.seed', 'mk09.seed'), pb = presetA('c09.box', 'mk09.box');
    if (ps) presets.push({ label: 'SeeD（9月）の値', values: ps });
    if (pb) presets.push({ label: '求人BOX（9月）の値', values: pb });
    buildSim(root, {
      id: 'simA', title: '模型A　広告費から紹介料までを1本の式で動かす',
      intro: ['9月の実数（MK 経由の全体）が入っています。数字を1つ変えると、下の図と数字が同時に動きます。率は「1つ前の段」に対する割合です。'],
      params: params, defaults: d, presets: presets,
      groups: { rates: { title: '10個の率を1つずつ動かす（開く）', open: false } },
      draw: drawA
    });
    return true;
  }

  /* ---- 模型B: 予算を増やすと1件はどう高くなるか（飽和） ---- */
  function calcB(s) {
    var A = s.amax * (1 - Math.exp(-s.b / s.b0));
    var Ap = s.amax * (1 - Math.exp(-Math.max(0, s.b - 10000) / s.b0));
    return { A: A, avg: A > 0 ? s.b / A : NaN, marg: (s.b0 / s.amax) * Math.exp(s.b / s.b0), last: A - Ap };
  }
  /* 「いま」の札は縦の線の右か左に寄せる（真上に置くと左端で縦軸の目盛りと重なる） */
  function nowLabel(svg, xb, y, W) {
    if (xb < W / 2) txt(svg, xb + 4, y, 'いま', { size: 12, weight: '700' });
    else txt(svg, xb - 4, y, 'いま', { size: 12, anchor: 'end', weight: '700' });
  }
  function plotFrame(svg, P, ax, ay, fx, fy) {
    var i, v, x, y;
    for (i = 0; i <= ay.n; i++) {
      v = ay.step * i;
      y = P.y1 - (P.y1 - P.y0) * v / ay.max;
      line(svg, P.x0, y, P.x1, y, 'st-grid', { 'stroke-width': 1 });
      txt(svg, P.x0 - 4, y + 4, fy(v), { size: 12, anchor: 'end', cls: 's-ink2' });
    }
    for (i = 0; i <= ax.n; i++) {
      v = ax.step * i;
      x = P.x0 + (P.x1 - P.x0) * v / ax.max;
      line(svg, x, P.y1, x, P.y1 + 4, 'st-axis', { 'stroke-width': 1 });
      txt(svg, x, P.y1 + 17, fx(v), { size: 12, anchor: 'middle', cls: 's-ink2' });
    }
    line(svg, P.x0, P.y1, P.x1, P.y1, 'st-axis', { 'stroke-width': 1.5 });
  }
  function realPointsB() {
    var p1b = R('mk09.seed.c.eng.spend'), p1a = R('mk09.seed.c.eng.app'), p1c = R('mk09.seed.c.eng.cpa');
    var p2b = R('f.spend10x2'), p2a = R('f.app10x2'), p2c = R('f.cpa10x2');
    return { p1: { b: p1b, a: p1a, c: p1c }, p2: { b: p2b, a: p2a, c: p2c }, marg: R('f.marg') };
  }
  function drawB1(s, c, rp) {
    var W = 340, H = 226, P = { x0: 48, x1: 318, y0: 34, y1: 184 };
    var xm = Math.max(2e6, s.b * 1.25), ax = axisOf(xm, 4);
    var ay = axisOf(Math.max(s.amax, rp.p1.a || 0, rp.p2.a || 0) * 1.15, 4);
    var svg = svgBox(W, H, '広告費と応募数の曲線（説明用）: いまの広告費 ' + fmtMan(s.b) + '円で応募 ' + or(fmtCount(c.A), '計算不可') + '件');
    function X(b) { return P.x0 + (P.x1 - P.x0) * b / ax.max; }
    function Y(a) { return P.y1 - (P.y1 - P.y0) * a / ay.max; }
    plotFrame(svg, P, ax, ay, fmtMan, function (v) { return fmtFixed(v, 0); });
    txt(svg, 4, 13, '応募数（件）', { size: 12, cls: 's-ink2' });
    txt(svg, P.x1, H - 4, '広告費（月・円）', { size: 12, anchor: 'end', cls: 's-ink2' });
    if (s.amax <= ay.max) {
      line(svg, P.x0, Y(s.amax), P.x1, Y(s.amax), 'st-axis', { 'stroke-width': 1, 'stroke-dasharray': '5 4' });
      txt(svg, P.x1, Y(s.amax) - 4, '上限 Amax', { size: 12, anchor: 'end', cls: 's-ink2' });
    }
    var pts = [];
    for (var i = 0; i <= 100; i++) { var b = ax.max * i / 100; pts.push([X(b), Y(s.amax * (1 - Math.exp(-b / s.b0)))]); }
    poly(svg, pts, 'st-ink2', { 'stroke-width': 2 });
    if (ok(rp.p1.b) && ok(rp.p2.b) && ok(rp.p1.a) && ok(rp.p2.a)) {
      line(svg, X(rp.p2.b), Y(rp.p2.a), X(rp.p1.b), Y(rp.p1.a), 'st-violet', { 'stroke-width': 2, 'stroke-dasharray': '4 3' });
      circle(svg, X(rp.p1.b), Y(rp.p1.a), 5, 'f-blue', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
      diamond(svg, X(rp.p2.b), Y(rp.p2.a), 6, 'f-blue', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
      txt(svg, X(rp.p1.b) + 7, Y(rp.p1.a) + 17, '9月', { size: 12 });
      txt(svg, X(rp.p2.b) + 7, Y(rp.p2.a) + 17, '10月×' + adn('f.mult', '2'), { size: 12 });
    }
    var xb = X(Math.min(s.b, ax.max));
    /* 紫は限界CPAの色なので、いまの広告費の点と線は灰にする */
    line(svg, xb, P.y0, xb, P.y1, 'st-axis', { 'stroke-width': 1.5, 'stroke-dasharray': '2 3' });
    circle(svg, xb, Y(c.A), 5, 's-ink2', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
    nowLabel(svg, xb, P.y0 - 4, W);
    return svg;
  }
  function drawB2(s, c, rp) {
    var W = 340, H = 226, P = { x0: 48, x1: 318, y0: 34, y1: 184 };
    var xm = Math.max(2e6, s.b * 1.25), ax = axisOf(xm, 4);
    function avgAt(b) { if (b <= 0) return s.b0 / s.amax; var a = s.amax * (1 - Math.exp(-b / s.b0)); return a > 0 ? b / a : NaN; }
    function margAt(b) { return (s.b0 / s.amax) * Math.exp(b / s.b0); }
    var aEnd = avgAt(ax.max), real = Math.max(rp.p1.c || 0, rp.p2.c || 0);
    var top = Math.max(ok(aEnd) ? aEnd * 1.25 : 0, real * 1.3, Math.min(ok(c.marg) ? c.marg * 1.25 : Infinity, (ok(aEnd) ? aEnd : real) * 4));
    if (!ok(top) || top <= 0) top = 10000;
    var ay = axisOf(top, 4);
    var svg = svgBox(W, H, '平均CPAと限界CPAの曲線（説明用）: いまの広告費で平均 ' + or(fmtYen(c.avg), '—') + '・限界 ' + or(fmtYen(c.marg), '大きすぎ'));
    function X(b) { return P.x0 + (P.x1 - P.x0) * b / ax.max; }
    function Y(v) { return P.y1 - (P.y1 - P.y0) * v / ay.max; }
    plotFrame(svg, P, ax, ay, fmtMan, fmtMan);
    txt(svg, 4, 13, '1件あたり（円）', { size: 12, cls: 's-ink2' });
    txt(svg, P.x1, H - 4, '広告費（月・円）', { size: 12, anchor: 'end', cls: 's-ink2' });
    var pa = [], pm = [], exitX = null, i, b;
    for (i = 0; i <= 100; i++) {
      b = ax.max * i / 100;
      var av = avgAt(b);
      if (ok(av) && av <= ay.max) pa.push([X(b), Y(av)]);
      var mv = margAt(b);
      if (exitX == null) {
        if (ok(mv) && mv <= ay.max) pm.push([X(b), Y(mv)]);
        else { var bx = s.b0 * Math.log(ay.max * s.amax / s.b0); if (ok(bx) && bx > 0) { pm.push([X(bx), Y(ay.max)]); exitX = X(bx); } else exitX = X(b); }
      }
    }
    poly(svg, pa, 'st-ink2', { 'stroke-width': 2 });
    poly(svg, pm, 'st-violet', { 'stroke-width': 2.5, 'stroke-dasharray': '7 4' });
    var lastA = pa[pa.length - 1];
    if (lastA) txt(svg, lastA[0], lastA[1] - 7, '平均CPA', { size: 12, anchor: 'end', weight: '700' });
    if (exitX != null) txt(svg, Math.min(exitX + 4, P.x1 - 50), P.y0 + 12, '限界CPA', { size: 12, weight: '700' });
    else if (pm.length) { var lm = pm[pm.length - 1]; txt(svg, lm[0], lm[1] + 16, '限界CPA', { size: 12, anchor: 'end', weight: '700' }); }
    if (ok(rp.p1.b) && ok(rp.p1.c) && rp.p1.c <= ay.max) circle(svg, X(rp.p1.b), Y(rp.p1.c), 5, 'f-blue', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
    if (ok(rp.p2.b) && ok(rp.p2.c) && rp.p2.c <= ay.max) diamond(svg, X(rp.p2.b), Y(rp.p2.c), 6, 'f-blue', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
    var xb = X(Math.min(s.b, ax.max));
    line(svg, xb, P.y0, xb, P.y1, 'st-axis', { 'stroke-width': 1.5, 'stroke-dasharray': '2 3' });
    nowLabel(svg, xb, P.y0 - 4, W);
    if (ok(c.avg) && c.avg <= ay.max) circle(svg, xb, Y(c.avg), 4.5, 's-ink2');
    if (ok(c.marg) && c.marg <= ay.max) circle(svg, xb, Y(c.marg), 4.5, 'f-violet');
    else txt(svg, xb + 4, P.y0 + 28, '↑限界は枠の外', { size: 12 });
    return svg;
  }
  function drawB(s, ch, out) {
    var c = calcB(s), rp = realPointsB();
    var box = h('div', { 'class': 'kpis' });
    var as = fmtCount(c.A);
    kpi(box, '応募数（曲線の値）', as == null ? '—（計算不可）' : as + '件');
    kpi(box, '平均CPA（広告費÷応募数）', or(fmtYen(c.avg), s.b <= 0 ? '広告費0' : '計算不可'));
    kpi(box, '限界CPA（最後の1件の値段）', or(fmtYen(c.marg), '大きすぎて計算できない'));
    var ls = fmtCount(c.last);
    kpi(box, s.b >= 10000 ? '増やした最後の1万円で増える応募数' : '最後の1万円で増える応募数（広告費1万円未満）', ls == null ? '—（計算不可）' : ls + '件');
    out.appendChild(box);
    out.appendChild(h('h4', null, '広告費と応募数'));
    out.appendChild(drawB1(s, c, rp));
    out.appendChild(h('h4', null, '平均CPA と 限界CPA'));
    out.appendChild(drawB2(s, c, rp));
    var ptxt = '● 9月 SeeD エンジニア: ' + or(fmtMan(rp.p1.b), '[未取得]') + '円で ' + or(fmtFixed(rp.p1.a, 0), '[未取得]') + '件（1件 ' + or(fmtYen(rp.p1.c), '[未取得]') + '）。' +
      '◆ ' + adn('f.p10', '10月前半') + '（' + adn('f.p10_days', '15日') + '）を' + adn('f.mult', '2') + '倍した月換算: ' + or(fmtMan(rp.p2.b), '[未取得]') + '円で ' + or(fmtFixed(rp.p2.a, 0), '[未取得]') + '件（1件 ' + or(fmtYen(rp.p2.c), '[未取得]') + '）。' +
      '点線＝2点の差から出した傾き ≈' + or(fmtYen(rp.marg), '[未取得]') + '/件（推定で、因果の証明ではない）。';
    out.appendChild(h('p', { 'class': 'cav' }, ptxt));
    srcLine(out, '点は ' + ((window.AD && window.AD.meta && window.AD.meta.mk_src) || 'MK の月次広告レポート') + ' の SeeD エンジニア枠');
  }
  function setupB(root) {
    var b9 = R('mk09.seed.c.eng.spend');
    if (b9 == null) return false;
    buildSim(root, {
      id: 'simB', title: '模型B　予算を増やすと「最後の1件」は高くなる',
      intro: ['曲線は仕組みの説明用で当てはめではない・点は月ごとに条件が違う',
        'A(b)＝Amax×(1−e^(−b/b0))。平均CPA＝b÷A、限界CPA＝(b0÷Amax)×e^(b/b0)。つまみで広告費を動かして、平均と限界の差を見てください。'],
      params: [
        { key: 'b', label: '広告費（月）', unit: '円', min: 0, max: 1e8, int: true, slider: { min: 0, max: 2e6, step: 10000 } },
        { key: 'amax', label: '応募の上限 Amax', unit: '件', min: 1, max: 100000, dec: 1, group: 'shape' },
        { key: 'b0', label: '飽和の目安 b0', unit: '円', min: 10000, max: 1e8, int: true, group: 'shape' }
      ],
      defaults: { b: Math.round(b9), amax: 300, b0: 1000000 },
      groups: { shape: { title: '曲線の形（説明用の仮の値）を変える', open: false } },
      draw: drawB
    });
    return true;
  }

  /* ---- 模型C: 少ない件数の揺らぎ（√N と Wilson の区間） ---- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function poisson(lam, rnd) {
    if (lam <= 30) {
      var L = Math.exp(-lam), k = 0, p = 1;
      do { k++; p *= rnd(); } while (p > L);
      return k - 1;
    }
    var u1 = rnd() || 1e-12, u2 = rnd();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lam + Math.sqrt(lam) * z));
  }
  function drawsC(s) { var rnd = mulberry32(s.seed), a = []; for (var i = 0; i < 12; i++) a.push(poisson(s.lam, rnd)); return a; }
  function pOut(lam) {
    var lo = lam - Math.sqrt(lam), hi = lam + Math.sqrt(lam), p = Math.exp(-lam), tot = 0;
    var kmax = Math.ceil(lam + 15 * Math.sqrt(lam) + 20);
    for (var k = 0; k <= kmax; k++) { if (k > 0) p *= lam / k; if (k < lo || k > hi) tot += p; }
    return tot;
  }
  function wilson(k, n) {
    var z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n;
    var c = (p + z2 / (2 * n)) / d, hw = z / d * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { p: p, lo: Math.max(0, c - hw), hi: Math.min(1, c + hw) };
  }
  function drawC1(s, xs) {
    var W = 340, H = 212, P = { x0: 40, x1: 306, y0: 14, y1: 170 };
    var sq = Math.sqrt(s.lam), mx = Math.max.apply(null, xs);
    var ay = axisOf(Math.max(s.lam + 3 * sq, mx) * 1.05, 4);
    function Y(v) { return P.y1 - (P.y1 - P.y0) * v / ay.max; }
    function X(i) { return P.x0 + (i + 0.5) * (P.x1 - P.x0) / 12; }
    var outN = 0, lo = s.lam - sq, hi = s.lam + sq;
    xs.forEach(function (v) { if (v < lo || v > hi) outN++; });
    var svg = svgBox(W, H, '12か月の人数のばらつき: 平均 λ=' + fmtFixed(s.lam, 1) + '・帯の外 ' + outN + '/12か月');
    plotFrame(svg, P, { step: 1, n: 0, max: 1 }, ay, function () { return ''; }, function (v) { return fmtFixed(v, 0); });
    rect(svg, P.x0, Y(hi), P.x1 - P.x0, Y(Math.max(0, lo)) - Y(hi), 'f-tag');
    line(svg, P.x0, Y(s.lam), P.x1, Y(s.lam), 'st-ink2', { 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
    if (Y(Math.max(0, lo)) - Y(s.lam) >= 13) {
      txt(svg, P.x1 + 4, Y(hi) + 4, '+√λ', { size: 12, cls: 's-ink2' });
      txt(svg, P.x1 + 4, Y(s.lam) + 4, 'λ', { size: 12, weight: '700' });
      txt(svg, P.x1 + 4, Y(Math.max(0, lo)) + 4, '−√λ', { size: 12, cls: 's-ink2' });
    } else txt(svg, P.x1 + 4, Y(s.lam) + 4, 'λ±√λ', { size: 12, weight: '700' });
    xs.forEach(function (v, i) {
      var outside = v < lo || v > hi;
      if (outside) circle(svg, X(i), Y(v), 5.5, 'f-orange', { stroke: 'var(--surface)', 'stroke-width': 1.5 }); /* 図7-1 と同じく帯の外＝橙 */
      else circle(svg, X(i), Y(v), 5, 'f-surface st-ink2', { 'stroke-width': 2 });
      txt(svg, X(i), Y(v) - 9, String(v), { size: 12, anchor: 'middle', weight: outside ? '700' : null });
      txt(svg, X(i), P.y1 + 16, String(i + 1), { size: 12, anchor: 'middle', cls: 's-ink2' });
    });
    txt(svg, (P.x0 + P.x1) / 2, H - 6, '何か月目（同じ条件のまま12か月）', { size: 12, anchor: 'middle', cls: 's-ink2' });
    return { svg: svg, outN: outN };
  }
  function drawC2(s, w1, w2) {
    var W = 360, H = 118, x0 = 96, x1 = 326; /* 右に余白を取り、「100%」と長い区間ラベルを枠の中に収める */
    function X(p) { return x0 + (x1 - x0) * p; }
    var svg = svgBox(W, H, '書類通過率の95%区間（Wilson）: 8月 ' + s.k1 + '/' + s.n1 + '・9月 ' + s.k2 + '/' + s.n2);
    [0, 0.5, 1].forEach(function (p) {
      line(svg, X(p), 14, X(p), 92, 'st-grid', { 'stroke-width': 1 });
      txt(svg, X(p), 108, fmtFixed(p * 100, 0) + '%', { size: 13, anchor: 'middle', cls: 's-ink2' });
    });
    [[w1, s.k1, s.n1, '8月 SeeD', 38], [w2, s.k2, s.n2, '9月 SeeD', 78]].forEach(function (r) {
      var w = r[0], y = r[4];
      txt(svg, x0 - 8, y + 4, r[3], { anchor: 'end' });
      line(svg, X(w.lo), y, X(w.hi), y, 'st-ink2', { 'stroke-width': 3 });
      line(svg, X(w.lo), y - 6, X(w.lo), y + 6, 'st-ink2', { 'stroke-width': 2 });
      line(svg, X(w.hi), y - 6, X(w.hi), y + 6, 'st-ink2', { 'stroke-width': 2 });
      circle(svg, X(w.p), y, 5, 'f-violet', { stroke: 'var(--surface)', 'stroke-width': 1.5 });
      var label = r[1] + '/' + r[2] + '＝' + fmtFixed(w.p * 100, 0) + '%（' + fmtFixed(w.lo * 100, 0) + '〜' + fmtFixed(w.hi * 100, 0) + '%）';
      /* 390px 幅では svg が約0.9倍に縮むので 13 で描く（11px を割らない）。幅の広がった分だけ端の寄せ幅も広げる */
      var cx = Math.min(Math.max((X(w.lo) + X(w.hi)) / 2, x0 + 80), W - 80);
      txt(svg, cx, y - 10, label, { size: 13, anchor: 'middle' });
    });
    return svg;
  }
  function drawC(s, ch, out) {
    var xs = drawsC(s), sq = Math.sqrt(s.lam), po = pOut(s.lam);
    var box = h('div', { 'class': 'kpis' });
    kpi(box, '平均 λ', fmtFixed(s.lam, 1) + '人/月');
    kpi(box, '揺らぎの目安 √λ', fmtFixed(sq, 1) + '人（λの ' + fmtFixed(sq / s.lam * 100, 0) + '%）');
    var r = drawC1(s, xs);
    kpi(box, '帯の外に出た月', r.outN + '/12か月');
    kpi(box, '帯の外に出る確率（理論）', fmtFixed(po * 100, 0) + '%（12か月で平均 ' + fmtFixed(po * 12, 1) + 'か月）');
    out.appendChild(box);
    out.appendChild(h('h4', null, '同じ条件でも毎月の人数はこれだけぶれる'));
    out.appendChild(r.svg);
    out.appendChild(h('p', { 'class': 'cav' }, '帯＝λ±√λ。橙の●＝帯の外、白抜きの○＝帯の中（図7-1 と同じ色）。「12か月を引き直す」で偶然だけの別の1年が出ます。'));
    var w1 = wilson(s.k1, s.n1), w2 = wilson(s.k2, s.n2);
    out.appendChild(h('h4', null, '書類通過率の 95% 区間（Wilson）'));
    out.appendChild(drawC2(s, w1, w2));
    var overlap = w1.lo <= w2.hi && w2.lo <= w1.hi;
    out.appendChild(h('p', { 'class': 'formula' }, overlap ? '区間が重なる＝この件数では差があるとは言い切れない（目安）' : '区間が重ならない＝偶然だけでは説明しにくい差（目安・厳密な検定ではない）'));
    srcLine(out, 'k/n の初期値は SeeD の推薦→書類通過（8月・9月）。λ の初期値は 9月 SeeD の内定数と同じ規模');
  }
  function setupC(root) {
    var k1 = R('c08.seed.doc'), n1 = R('c08.seed.rec'), k2 = R('c09.seed.doc'), n2 = R('c09.seed.rec'), lam = R('c09.seed.offer');
    if (k1 == null || !n1 || k2 == null || !n2 || !lam) return false;
    function fixK(ns, key) {
      if (key === 'n1' && ns.k1 > ns.n1) { ns.k1 = ns.n1; return '推薦より書類通過が多くなるので、8月の書類通過を ' + ns.n1 + ' にしました'; }
      if (key === 'n2' && ns.k2 > ns.n2) { ns.k2 = ns.n2; return '推薦より書類通過が多くなるので、9月の書類通過を ' + ns.n2 + ' にしました'; }
      return '';
    }
    buildSim(root, {
      id: 'simC', title: '模型C　少ない件数は偶然でこれだけ動く',
      intro: ['λ は「本当の平均」。毎月の人数はそこから偶然でぶれます。下の k/n には SeeD の実数が入っています。'],
      params: [
        { key: 'lam', label: '平均の人数 λ', unit: '人/月', min: 1, max: 200, dec: 1, slider: { min: 1, max: 200, step: 1 } },
        { key: 'k1', label: '8月 SeeD 書類通過 k', unit: '人', int: true, min: 0, max: function (s) { return s.n1; }, group: 'ci' },
        { key: 'n1', label: '8月 SeeD 推薦 n', unit: '人', int: true, min: 1, max: 100000, group: 'ci' },
        { key: 'k2', label: '9月 SeeD 書類通過 k', unit: '人', int: true, min: 0, max: function (s) { return s.n2; }, group: 'ci' },
        { key: 'n2', label: '9月 SeeD 推薦 n', unit: '人', int: true, min: 1, max: 100000, group: 'ci' }
      ],
      defaults: { lam: lam, seed: 20261022, k1: k1, n1: n1, k2: k2, n2: n2 },
      groups: { ci: { title: '区間の k/n（推薦→書類通過）を変える', open: true } },
      extras: [{ label: '12か月を引き直す', key: 'seed', run: function (ns) { ns.seed = (ns.seed + 1) >>> 0; return ns; } }],
      fix: fixK,
      draw: drawC
    });
    return true;
  }

  window.AD_SIM = { readNum: readNum, calcA: calcA, calcB: calcB, wilson: wilson, pOut: pOut };

  function init() {
    var boxes = document.querySelectorAll('div.sim[data-sim]');
    for (var i = 0; i < boxes.length; i++) {
      var root = boxes[i], kind = root.getAttribute('data-sim'), done = false;
      try {
        if (window.AD && window.AD.raw) {
          if (kind === 'A') done = setupA(root);
          else if (kind === 'B') done = setupB(root);
          else if (kind === 'C') done = setupC(root);
        }
      } catch (e) { done = false; }
      if (!done) {
        root.innerHTML = '';
        root.appendChild(h('p', null, '数字ファイル（data.js）が読めなかったので、模型を表示できません。'));
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
