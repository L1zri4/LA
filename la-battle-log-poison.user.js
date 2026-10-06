// ==UserScript==
// @name         LA 戦闘詳細に被毒列を追加
// @namespace    la-us.poison
// @version      1.0.2
// @description  戦闘詳細テーブルのダメージ欄に「被毒」を追加
// @author       unknown
// @match        https://rarirupj.com/leciar/log?id=*
// @updateURL    https://github.com/L1zri4/LA/raw/refs/heads/main/la-battle-log-poison.user.js
// @downloadURL  https://github.com/L1zri4/LA/raw/refs/heads/main/la-battle-log-poison.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const POISON_RE = /^(.*) は 猛毒 により ([\d,]+) のダメージを受けた/;

  function addColumn(table, poison) {
    table.dataset.poison = '1';

    const th = document.createElement('th');
    th.textContent = '被毒';
    th.title = '猛毒により受けたダメージの合計（「被」には含まれない）';
    table.querySelector('thead tr.col-row th:nth-child(2)').after(th);
    [...table.querySelectorAll('thead tr.group-row th')].find(h => h.textContent.trim() === 'ダメージ').colSpan += 1;

    for (const tr of table.querySelectorAll('tbody tr')) {
      const tds = tr.children;
      if (tds.length === 1) { tds[0].colSpan += 1; continue; }
      const td = document.createElement('td');
      if (!tr.classList.contains('skill-detail-row')) {
        const icon = tds[0].querySelector('.job-icon');
        const v = poison.get(tds[0].textContent.replace(icon ? icon.textContent : '', '').trim()) || 0;
        td.className = v ? 'val-poison' : 'zero';
        td.textContent = v.toLocaleString('ja-JP');
      }
      tds[2].after(td);
    }
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .battle-summary-table .val-poison{color:#e86348}
    @media (min-width:1200px){.battle-summary{--w:max(100%, min(1000px, min(100vw, 1600px) - 640px));width:var(--w);max-width:none;margin-left:calc((100% - var(--w)) / 2)}}
  </style>`);

  const html = window.roundSections
    ? roundSections.map(r => r.isPurged ? r.html : r.el.innerHTML).join('')
    : document.body.innerHTML;
  const poison = new Map();
  for (const el of new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.depth-result')) {
    const m = el.textContent.trim().match(POISON_RE);
    if (m) poison.set(m[1], (poison.get(m[1]) || 0) + Number(m[2].replace(/,/g, '')));
  }
  const apply = () => document.querySelectorAll('.battle-summary-table:not([data-poison])').forEach(t => addColumn(t, poison));
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
})();
