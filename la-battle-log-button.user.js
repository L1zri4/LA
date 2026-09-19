// ==UserScript==
// @name         LA 戦闘ログボタン追加
// @namespace    la-us.battlelog
// @version      1.0.0
// @description  プロフに「戦闘ログ」ボタンを追加
// @author       unknown
// @match        https://rarirupj.com/leciar/profile*
// @updateURL    https://github.com/L1zri4/LA/raw/refs/heads/main/la-battle-log-button.user.js
// @downloadURL  https://github.com/L1zri4/LA/raw/refs/heads/main/la-battle-log-button.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  function getEno() {
    var fromQuery = new URLSearchParams(location.search).get('ENo');
    if (fromQuery) return fromQuery;

    var hidden = document.querySelector('.profile-relation input[name="target"]');
    if (hidden && hidden.value) return hidden.value;

    return null;
  }

  var container = document.querySelector('.profile-relation');
  var eno = container && getEno();
  if (!eno) return;

  var a = document.createElement('a');
  a.className = 'button la-battlelog-button';
  a.style.lineHeight = '1.15';
  a.textContent = '戦闘ログ';
  a.href = 'https://rarirupj.com/leciar/logs?target=' + encodeURIComponent(eno) + '&title=&mode=member&results=';

  container.insertBefore(a, container.firstChild);
})();
