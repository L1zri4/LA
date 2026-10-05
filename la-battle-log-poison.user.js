// ==UserScript==
// @name         LA 戦闘詳細に被毒列を追加
// @namespace    la-us.poison
// @version      1.0.0
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

  function collectPoison(battle) {
    const sum = new Map();
    for (const el of battle.querySelectorAll('.depth-result')) {
      const m = el.textContent.trim().match(POISON_RE);
      if (m) sum.set(m[1], (sum.get(m[1]) || 0) + Number(m[2].replace(/,/g, '')));
    }
    return sum;
  }

  function unitName(cell) {
    const link = cell.querySelector('.battle-unit-profile-link');
    if (link) return link.textContent.trim();
    const icon = cell.querySelector('.job-icon');
    return cell.textContent.replace(icon ? icon.textContent : '', '').trim();
  }

  function addColumn(details) {
    const table = details.querySelector('table.battle-summary-table');
    if (!table || table.dataset.poisonCol) return;
    table.dataset.poisonCol = '1';

    const battle = details.closest('section.battle') || document;
    const poison = collectPoison(battle);

    const groupTh = [...table.querySelectorAll('thead tr.group-row th')].find(th => th.textContent.trim() === 'ダメージ');
    groupTh.colSpan += 1;
    const takenTh = table.querySelector('thead tr.col-row th:nth-child(2)');
    const th = document.createElement('th');
    th.textContent = '被毒';
    th.title = '猛毒により受けたダメージの合計（「被」には含まれない）';
    takenTh.after(th);

    for (const tr of table.querySelectorAll('tbody tr')) {
      const tds = tr.children;
      if (tds.length === 1) { tds[0].colSpan += 1; continue; }
      const td = document.createElement('td');
      if (tr.classList.contains('skill-detail-row')) {
        td.className = 'zero';
      } else {
        const v = poison.get(unitName(tds[0])) || 0;
        td.className = v ? 'val-poison' : 'val-poison zero';
        td.textContent = v.toLocaleString('ja-JP');
      }
      tds[2].after(td);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .battle-summary-table .val-poison{color:#e86348}
    @media (min-width:1200px){
      .battle-summary{
        --w:max(100%, min(1000px, min(100vw, 1600px) - 640px));
        width:var(--w);max-width:none;margin-left:calc((100% - var(--w)) / 2);
      }
    }`;
  document.head.appendChild(style);

  document.querySelectorAll('details.battle-summary').forEach(addColumn);
})();
