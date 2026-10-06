/* ページ版: CSV を選ぶ／ドロップ → 変換 → ダウンロードのリンクと、入れなかった注文の一覧を出す。拡張のポップアップ（popup.js）と同じ動き。外へは通信しない。 */
(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const settings = await ClickpostUI.loadSettings();
  $('item').value = settings.item;
  $('honorific').value = settings.honorific;
  let lastFile = null;

  function checkItem() {
    const v = ClickpostCore.validateItem($('item').value);
    $('itemErr').textContent = v.ok ? '' : v.message;
    return v;
  }

  async function convert(file, extra) {
    $('result').replaceChildren();                                 // 前の結果とボタンは必ず消す（内容品の欄とファイルの中身がずれないように）
    const v = checkItem();
    if (!v.ok) return;                                              // 内容品が不正なうちは変換しない
    settings.item = v.item;
    settings.honorific = $('honorific').value;
    await ClickpostUI.saveSettings({ item: settings.item, honorific: settings.honorific });
    let res;
    try { res = await ClickpostUI.convertFile(file, settings); }
    catch (e) { $('result').append(ClickpostUI.el('p', { class: 'msg ng', 'data-testid': 'result-error', text: 'ファイルを読めませんでした。もう一度選び直してください' })); return; }
    ClickpostUI.renderResult($('result'), res);
    if (extra) $('result').prepend(ClickpostUI.el('p', { class: 'msg warn', 'data-testid': 'multi-notice', text: `ファイルは1つずつ変換します。先頭の「${file.name}」だけを変換しました（ほかの${extra}つは、順に選び直してください）` }));
  }

  async function pick(files) {
    const file = files && files[0];
    if (!file) return;
    lastFile = file;
    await convert(file, files.length - 1);
  }

  $('file').addEventListener('change', async (e) => {
    const f = Array.from(e.target.files);
    e.target.value = '';                                           // 同じファイルをもう一度選んでも change が出るように
    await pick(f);
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => pick(Array.from(e.dataTransfer.files)));
  // 枠の外に落としても、ブラウザがファイルを開いてしまわないように
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); if (!drop.contains(e.target)) pick(Array.from(e.dataTransfer.files)); });

  $('item').addEventListener('input', () => { if (lastFile) convert(lastFile); else checkItem(); });
  $('honorific').addEventListener('change', () => { if (lastFile) convert(lastFile); else ClickpostUI.saveSettings({ honorific: $('honorific').value }); });
})();
