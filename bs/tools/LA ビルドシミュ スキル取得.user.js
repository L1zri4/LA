// ==UserScript==
// @name         LA ビルドシミュ スキル取得
// @namespace    la-us.buildsim
// @version      1.0.0
// @description  LAビルドシミュレータにゲームの最新スキル一覧を供給（毎日6:00/18:00 JSTに再取得・キャッシュ）
// @match        file:///*la-build-sim*
// @match        http://*/*la-build-sim*
// @match        https://*/*la-build-sim*
// @match        https://rarirupj.com/leciar/thread*
// @connect      rarirupj.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var SKILLS_URL = 'https://rarirupj.com/leciar/thread?page=skills';
  var KEY = 'skills-cache';  // { rows: [[名前,使用条件,取得条件,効果],...], at: epoch ms }
  var MIN_ROWS = 50;
  var H12 = 12 * 3600e3, OFS = 9 * 3600e3; // 境界 = 6:00 / 18:00 JST
  function lastBoundary(t) { return Math.floor((t - OFS) / H12) * H12 + OFS; }

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function extract(doc) {
    var out = [];
    doc.querySelectorAll('.catalog-data-row').forEach(function (tr) {
      var td = tr.querySelectorAll('td');
      if (td.length >= 4) out.push([0, 1, 2, 3].map(function (i) { return norm(td[i].textContent); }));
    });
    return out;
  }
  function save(rows) {
    var c = { rows: rows, at: Date.now() };
    GM_setValue(KEY, JSON.stringify(c));
    return c;
  }
  function load() {
    try { var c = JSON.parse(GM_getValue(KEY, 'null')); return c && c.rows && c.rows.length >= MIN_ROWS ? c : null; }
    catch (e) { return null; }
  }

  /* ---- ゲームのスキル一覧ページを開いたとき：ついでにキャッシュ更新 ---- */
  if (location.hostname === 'rarirupj.com') {
    if (new URLSearchParams(location.search).get('page') !== 'skills') return;
    var rows = extract(document);
    if (rows.length >= MIN_ROWS) save(rows);
    return;
  }

  /* ---- シミュレータ側 ---- */
  if (!document.getElementById('skill-data')) return; // 別ページに誤マッチした場合は何もしない

  function post(msg) { window.postMessage(msg, '*'); }
  var busy = false;

  function fetchGame(cb) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: SKILLS_URL,
      timeout: 30000,
      onload: function (r) {
        if (r.status !== 200) return cb('HTTP ' + r.status);
        var rows = extract(new DOMParser().parseFromString(r.responseText, 'text/html'));
        if (rows.length < MIN_ROWS) return cb('スキル表が見つかりません（ゲームにログインしているか確認）');
        cb(null, save(rows));
      },
      onerror: function () { cb('通信エラー'); },
      ontimeout: function () { cb('タイムアウト'); }
    });
  }

  function handle(force) {
    var c = load();
    if (c && !force && c.at >= lastBoundary(Date.now())) {
      post({ type: 'la-sim:skills', rows: c.rows, at: c.at });
      return;
    }
    if (busy) return;
    busy = true;
    fetchGame(function (err, fresh) {
      busy = false;
      if (err) {
        post({ type: 'la-sim:error', msg: err });
        if (c) post({ type: 'la-sim:skills', rows: c.rows, at: c.at }); // 失敗時は古いキャッシュで代用
        return;
      }
      post({ type: 'la-sim:skills', rows: fresh.rows, at: fresh.at });
    });
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'la-sim:request') handle(!!d.force);
  });
  post({ type: 'la-sim:bridge-ready', version: '1.0.0' });
})();
