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

  async function convert(file) {
    const v = checkItem();
    if (!v.ok) { $('result').replaceChildren(); return; }       // 内容品が不正なうちは変換しない
    settings.item = v.item;
    settings.honorific = $('honorific').value;
    await ClickpostUI.saveSettings({ item: settings.item, honorific: settings.honorific });
    const res = await ClickpostUI.convertFile(file, settings);
    ClickpostUI.renderResult($('result'), res);
  }

  async function pick(file) {
    if (!file) return;
    lastFile = file;
    await convert(file);
  }

  $('file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';                                           // 同じファイルをもう一度選んでも change が出るように
    await pick(f);
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => pick(e.dataTransfer.files[0]));
  // 枠の外に落としても、ブラウザがファイルを開いてしまわないように
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); if (!drop.contains(e.target)) pick(e.dataTransfer.files[0]); });

  $('item').addEventListener('input', () => { checkItem(); if (lastFile && checkItem().ok) convert(lastFile); });
  $('honorific').addEventListener('change', () => { if (lastFile) convert(lastFile); else ClickpostUI.saveSettings({ honorific: $('honorific').value }); });
})();
