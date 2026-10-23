/* 広告運用の勉強サイト・共通の動き（配色・今ここ・用語リンク・クイズ）。file:// で動く素のスクリプト。 */
(function () {
  'use strict';
  var KEY = 'adops-theme';
  function readTheme() {
    try { var t = window.localStorage.getItem(KEY); return (t === 'light' || t === 'dark') ? t : 'auto'; }
    catch (e) { return 'auto'; }
  }
  function applyTheme(t) {
    var el = document.documentElement;
    if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  }
  applyTheme(readTheme());

  var THEME_LABEL = { auto: '配色: 自動', light: '配色: 明るい', dark: '配色: 暗い' };
  var THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };

  function setupTheme() {
    var btn = document.querySelector('.theme-btn');
    if (!btn) return;
    var cur = readTheme();
    btn.textContent = THEME_LABEL[cur];
    btn.addEventListener('click', function () {
      cur = THEME_NEXT[cur] || 'auto';
      applyTheme(cur);
      try { if (cur === 'auto') window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, cur); } catch (e) { /* 保存できなくても表示は切り替わる */ }
      btn.textContent = THEME_LABEL[cur];
    });
  }

  /* ---- 今ここ（ミニ地図） ---- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NODES = [
    { k: 'spend', t: '広告費', role: 'mk' },
    { k: 'click', t: 'クリック', role: 'media' },
    { k: 'app', t: '応募', role: 'mk' },
    { k: 'valid', t: '有効応募', role: 'mk' },
    { k: 'iv', t: '面談', role: 'gn' },
    { k: 'rec', t: '推薦', role: 'gn' },
    { k: 'acc', t: '承諾', role: 'gn' },
    { k: 'fee', t: '紹介料', role: 'co' }
  ];
  var ROLE_NAME = { mk: 'MK', media: '媒体の自動', gn: 'Gooner', co: '企業' };

  function el(name, attrs, text) {
    var e = document.createElementNS(SVGNS, name);
    for (var a in attrs) if (Object.prototype.hasOwnProperty.call(attrs, a)) e.setAttribute(a, attrs[a]);
    if (text != null) e.textContent = text;
    return e;
  }

  function buildHere(nav) {
    var keys = (nav.getAttribute('data-here') || '').split(',').map(function (s) { return s.replace(/^\s+|\s+$/g, ''); });
    var all = keys.length === 1 && keys[0] === 'all'; /* 目次ページ＝強調せず全体を見せる */
    var W = 360, nw = 76, nh = 32, gap = (W - 8 - nw * 4) / 3;
    var y1 = 20, y2 = 76, H = 132; /* 2段目の下の「▲今ここ」が枠から出ない高さ */
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'here-title' });
    var names = [];
    NODES.forEach(function (n) { if (keys.indexOf(n.k) >= 0) names.push(n.t); });
    svg.appendChild(el('title', { id: 'here-title' }, all ? '全体の流れ（広告費から紹介料まで8段）' : '全体の流れの中の今ここ: ' + (names.join('・') || 'なし')));
    var defs = el('defs', {});
    var mk = el('marker', { id: 'here-ah', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto' });
    mk.appendChild(el('path', { d: 'M0,0 L8,4 L0,8 z', 'class': 'arrowhead' }));
    defs.appendChild(mk);
    svg.appendChild(defs);
    function pos(i) {
      if (i < 4) return { x: 4 + i * (nw + gap), y: y1 };
      var j = 7 - i; /* 2段目は右から左へ（蛇行） */
      return { x: 4 + j * (nw + gap), y: y2 };
    }
    for (var i = 0; i < NODES.length - 1; i++) {
      var a = pos(i), b = pos(i + 1), line;
      if (i === 3) line = el('line', { x1: a.x + nw / 2, y1: a.y + nh, x2: b.x + nw / 2, y2: b.y - 2, 'class': 'arrow', 'marker-end': 'url(#here-ah)' });
      else if (i < 3) line = el('line', { x1: a.x + nw, y1: a.y + nh / 2, x2: b.x - 2, y2: b.y + nh / 2, 'class': 'arrow', 'marker-end': 'url(#here-ah)' });
      else line = el('line', { x1: a.x, y1: a.y + nh / 2, x2: b.x + nw + 2, y2: b.y + nh / 2, 'class': 'arrow', 'marker-end': 'url(#here-ah)' });
      svg.appendChild(line);
    }
    NODES.forEach(function (n, idx) {
      var p = pos(idx), on = keys.indexOf(n.k) >= 0;
      var g = el('g', {});
      g.appendChild(el('rect', { x: p.x, y: p.y, width: nw, height: nh, rx: 6, 'class': 'n-' + n.role + (on ? ' n-here' : '') }));
      var t = el('text', { x: p.x + nw / 2, y: p.y + nh / 2 + 4.5, 'text-anchor': 'middle', 'font-size': '13', 'font-weight': on ? '700' : '400' }, n.t);
      g.appendChild(t);
      if (on) {
        var ly = idx < 4 ? p.y - 6 : p.y + nh + 15;
        g.appendChild(el('text', { x: p.x + nw / 2, y: ly, 'text-anchor': 'middle', 'font-size': '12', 'font-weight': '700' }, idx < 4 ? '▼今ここ' : '▲今ここ'));
      }
      svg.appendChild(g);
    });
    nav.innerHTML = '';
    nav.appendChild(svg);
    var cap = document.createElement('p');
    cap.className = 'here-cap';
    var roles = [];
    ['media', 'mk', 'gn', 'co'].forEach(function (r) {
      roles.push('<span class="role ' + (r === 'co' ? 'co' : r) + '">' + ROLE_NAME[r] + '</span>');
    });
    cap.innerHTML = (all ? '全体（この小さな地図が各章の頭に出ます）' : '今ここ: <b>' + (names.join('・') || '—') + '</b>') + '　<span class="legend">' + roles.join('') + '</span>';
    nav.appendChild(cap);
  }

  /* ---- 用語集への自動リンク（各ページの最初の1回だけ。英字の略語は早見表の行 ab-* へ、日本語の語は定義へ） ---- */
  var GLOSS = [
    ['内定承諾単価', 'cpacc'], ['承諾単価', 'cpacc'], ['平均紹介料', 'avgfee'], ['紹介料', 'fee'], ['内定承諾', 'acc'], ['承諾', 'acc'],
    ['内定', 'offer'], ['企業面接', 'iv3'], ['書類選考通過', 'doc'], ['書類通過', 'doc'], ['推薦', 'rec'],
    ['共有面談', 'iv2'], ['新規面談', 'iv1'], ['面談設定', 'set'], ['設定可能応募', 'settable'], ['有効応募', 'valid'],
    ['応募単価', 'cpa'], ['CPA', 'ab-cpa'], ['応募率', 'cvr'], ['CVR', 'ab-cvr'], ['CTR', 'ab-ctr'], ['クリック単価', 'cpc'],
    ['CPC', 'ab-cpc'], ['表示回数', 'imp'], ['ROAS', 'ab-roas'], ['損益分岐', 'breakeven'], ['オークション', 'auction'],
    ['入札', 'bid'], ['限界CPA', 'marginal'], ['平均CPA', 'marginal'], ['限界ROAS', 'mroas'], ['飽和', 'saturation'],
    ['新着効果', 'fresh'], ['スポンサー求人', 'sponsored'], ['無料掲載', 'organic'], ['キャンペーン', 'campaign'],
    ['アカウント', 'account'], ['原稿', 'posting'], ['暦月', 'calmonth'], ['KPI シート', 'kpisheet'], ['KPI月', 'kpimonth'], ['KPI', 'ab-kpi'], ['KGI', 'ab-kgi'], ['集計期間', 'period'],
    ['遅れ', 'lag'], ['打ち切り', 'censor'], ['信頼区間', 'ci'], ['Wilson', 'ab-wilson'], ['揺らぎ', 'noise'],
    ['増分', 'incr'], ['A/Bテスト', 'ab'], ['A/B', 'ab-abtest'], ['KKT', 'ab-kkt'], ['段の単価', 'stepcost'], ['跳ねる段', 'jump'], ['10倍の目盛り', 'logscale'],
    ['角の解', 'corner'], ['前後比較', 'prepost'], ['ホールドアウト', 'holdout'], ['ポアソン分布', 'poisson'], ['弾力性', 'elasticity'], ['日予算', 'budget'], ['ファネル', 'funnel'],
    ['有効率', 'rates'], ['承諾率', 'rates'], ['消化', 'spend'], ['応募開始率', 'startrate'], ['応募完了率', 'startrate'],
    ['MK', 'ab-mk'], ['CA', 'ab-ca'], ['Gooner', 'gooner'], ['求人ボックス', 'kbox'], ['求人BOX', 'ab-kbox'], ['Indeed', 'indeed'], ['SeeD', 'ab-seed']
  ];
  window.AD_GLOSS = GLOSS;
  var SKIP = 'figure, .quiz-block, details.src, .sim, nav, a, span[data-n], code, h1, h2, h3, .tag, table, header, footer, dl.gl, .here-cap, button, label';

  function coveredByLonger(s, i, term) {
    for (var g = 0; g < GLOSS.length; g++) {
      var L = GLOSS[g][0];
      if (L.length <= term.length) continue;
      var k = L.indexOf(term);
      while (k >= 0) {
        if (i - k >= 0 && s.substr(i - k, L.length) === L) return true;
        k = L.indexOf(term, k + 1);
      }
    }
    return false;
  }

  function textNodes(root) {
    var out = [];
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue || !/\S/.test(n.nodeValue)) continue;
      var p = n.parentNode;
      if (p && p.closest && p.closest(SKIP)) continue;
      out.push(n);
    }
    return out;
  }

  function linkGlossary() {
    if (document.body.getAttribute('data-page') === 'glossary') return;
    var main = document.querySelector('main');
    if (!main) return;
    var sorted = GLOSS.slice().sort(function (a, b) { return b[0].length - a[0].length; });
    var done = {};
    /* 本文に手で張ったリンクがある語は、同じページでもう張らない */
    var hand = {};
    main.querySelectorAll('a[href^="glossary.html#"]').forEach(function (a) {
      hand[a.getAttribute('href').split('#')[1]] = true;
    });
    sorted.forEach(function (pair) {
      var term = pair[0], id = pair[1];
      if (hand[id] || done[id + '|' + term]) return;
      var nodes = textNodes(main);
      for (var x = 0; x < nodes.length; x++) {
        var s = nodes[x].nodeValue, i = s.indexOf(term);
        while (i >= 0 && coveredByLonger(s, i, term)) i = s.indexOf(term, i + 1);
        if (i < 0) continue;
        var node = nodes[x];
        var after = node.splitText(i);
        after.splitText(term.length);
        var a = document.createElement('a');
        a.className = 'gl';
        a.href = 'glossary.html#' + id;
        a.title = '用語集へ';
        a.textContent = term;
        after.parentNode.replaceChild(a, after);
        done[id + '|' + term] = true;
        break;
      }
    });
  }

  /* ---- クイズ（最初に押した1回で答えと理由を出す） ---- */
  function setupQuiz(q) {
    var opts = q.querySelectorAll('button.opt');
    var marks = ['A', 'B', 'C', 'D'];
    var okMark = '';
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('data-mark', marks[i]);
      if (opts[i].getAttribute('data-ok') === '1') okMark = marks[i];
    }
    var answered = false;
    function reveal(chosen) {
      if (answered) return;
      answered = true;
      for (var j = 0; j < opts.length; j++) {
        var b = opts[j];
        b.setAttribute('aria-pressed', b === chosen ? 'true' : 'false');
        if (b.getAttribute('data-ok') === '1') b.classList.add('ok');
        else if (b === chosen) b.classList.add('ng');
        var why = b.parentNode.querySelector('.why');
        if (why) why.hidden = false;
      }
      var ans = q.querySelector('.ans');
      if (ans) {
        var v = ans.querySelector('.verdict');
        if (v) v.textContent = chosen.getAttribute('data-ok') === '1' ? '正解。' : '不正解（正解は ' + okMark + '）。';
        ans.hidden = false;
      }
    }
    for (var k = 0; k < opts.length; k++) {
      opts[k].addEventListener('click', function (ev) { reveal(ev.currentTarget); });
    }
  }

  /* ---- 早見表: 狭い幅で畳んだ 読み・日本語・式 を開く ---- */
  function setupAbbrMore() {
    var btns = document.querySelectorAll('button.abbr-more');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (ev) {
        var b = ev.currentTarget;
        var tbl = b.closest('table');
        var open = !tbl.classList.contains('open');
        tbl.classList.toggle('open', open);
        b.setAttribute('aria-pressed', open ? 'true' : 'false');
        b.textContent = open ? '読み・日本語・式を畳む' : '読み・日本語・式も出す';
      });
    }
  }

  function init() {
    setupTheme();
    setupAbbrMore();
    var nav = document.querySelector('nav.here[data-here]');
    if (nav) buildHere(nav);
    linkGlossary();
    var qs = document.querySelectorAll('.quiz');
    for (var i = 0; i < qs.length; i++) setupQuiz(qs[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
