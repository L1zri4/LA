// ==UserScript==
// @name         LA 戦闘詳細拡張
// @namespace    la-us.result
// @version      1.1.0
// @description  戦闘詳細画面のスキル名を標準化
// @author       -
// @match        https://rarirupj.com/leciar/log*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SKILL_URL = '/leciar/thread?page=skills';
  const ITEM_URL = '/leciar/thread?page=items';
  const SKILL_CACHE_KEY = 'la-btl-skill-catalog-v2';
  const ITEM_CACHE_KEY = 'la-btl-item-catalog-v2';
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  const NO_TOOLTIP = new Set(['通常攻撃', 'チェインスキル']);

  const CSS = `
.la-sx-cell { cursor: help; }
.la-sx-cell .la-sx-nm { border-bottom: 1px dotted rgba(255,255,255,.22); }
.la-sx-cell.la-sx-renamed .la-sx-nm { border-bottom-color: rgba(255,215,0,.6); }
.la-sx-cell.la-sx-nodata .la-sx-nm { border-bottom: none; }

.la-sx-tip {
  position: fixed; z-index: 2147483600;
  box-sizing: border-box; width: max-content; max-width: 340px; min-width: 220px;
  padding: 10px 12px;
  background: rgba(8,10,14,.96); color: #e8e8ee;
  border: 1px solid rgba(255,255,255,.28); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.6);
  font: 12px/1.65 sans-serif; text-align: left; white-space: normal;
  pointer-events: none; opacity: 0; transition: opacity .12s ease;
}
.la-sx-tip.la-sx-show { opacity: 1; }
.la-sx-tip .la-sx-name { font-size: 14px; font-weight: bold; color: #9cf; }
.la-sx-tip .la-sx-group {
  display: inline-block; margin-left: 6px; padding: 0 6px;
  font-size: 10px; font-weight: normal; color: #bcd;
  border: 1px solid rgba(255,255,255,.25); border-radius: 3px; vertical-align: 2px;
}
.la-sx-tip .la-sx-alias { font-size: 11px; color: #9ab; margin-top: 2px; }
.la-sx-tip dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 10px; margin: 8px 0 0; }
.la-sx-tip dt { color: #8fdba8; font-size: 11px; white-space: nowrap; }
.la-sx-tip dd { margin: 0; color: #dfe; word-break: break-word; }
.la-sx-tip dl.la-sx-sub { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.12); }
.la-sx-tip dl.la-sx-sub dt { color: #8a93a0; }
.la-sx-tip dl.la-sx-sub dd { color: #a8b0bb; }
.la-sx-tip .la-sx-note { margin-top: 6px; color: #d9a; font-size: 11px; }
.la-sx-tip .la-sx-src {
  margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.12);
  color: #8a93a0; font-size: 10.5px;
}
`;

  function injectStyle() {
    const s = document.createElement('style');
    s.id = 'la-sx-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  const sq = (t) => (t || '').replace(/\s+/g, ' ').trim();

  const GROUP_LABEL = {
    BASIC: '条件なし', TANK: 'TANK', DPS: 'DPS', HEAL: 'HEAL', SUP: 'SUP',
    ATK: '攻撃', AGI: '敏捷', DEX: '器用', DEF: '生命', MND: '精神', LUK: '幸運',
    SKILLBOOK: 'スキルブック'
  };

  function groupLabel(g) {
    if (!g) return '';
    if (GROUP_LABEL[g]) return GROUP_LABEL[g];
    const m = g.match(/^(ATK|AGI|DEX|DEF|MND|LUK)(ATK|AGI|DEX|DEF|MND|LUK)$/);
    if (m) return GROUP_LABEL[m[1]] + '-' + GROUP_LABEL[m[2]];
    return g;
  }

  function baseName(name) {
    return (name || '')
      .replace(/\s*Lv\.?\s*\d+\s*$/i, '')
      .replace(/\s*\d+\s*$/, '')
      .trim();
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !c.t || !c.d) return null;
      if (Date.now() - c.t > CACHE_TTL) return null;
      if (!Object.keys(c.d).length) return null;
      return c.d;
    } catch (e) { return null; }
  }

  function writeCache(key, d) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
  }

  async function fetchDoc(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function parseSkillCatalog(doc) {
    const data = {};
    doc.querySelectorAll('.skill-catalog tr.catalog-data-row, tr.catalog-data-row').forEach((tr) => {
      const td = tr.querySelectorAll('td');
      if (td.length < 4) return;
      const name = sq(td[0].textContent);
      if (!name || data[name]) return;
      data[name] = {
        cond: sq(td[1].textContent),
        req: sq(td[2].textContent),
        eff: sq(td[3].textContent),
        group: tr.getAttribute('data-group') || ''
      };
    });
    return data;
  }

  function parseItemCatalog(doc) {
    const data = {};
    doc.querySelectorAll('span.tooltip-container').forEach((sp) => {
      const tt = sp.querySelector('.tooltip-text');
      if (!tt) return;

      const raw = sq(tt.textContent);
      if (!raw) return;

      const clone = sp.cloneNode(true);
      clone.querySelectorAll('.tooltip-text').forEach((n) => n.remove());
      const key = baseName(sq(clone.textContent));
      if (!key || data[key]) return;

      const m = raw.match(/^【([^】]*)】\s*(.*)$/);
      data[key] = m
        ? { cond: sq(m[1]), eff: sq(m[2]) || '—' }
        : { cond: '', eff: raw };
    });
    return data;
  }

  let skillCatalog = null;
  let itemCatalog = null;
  let loadError = null;

  async function loadCatalogs() {
    const cs = readCache(SKILL_CACHE_KEY);
    const ci = readCache(ITEM_CACHE_KEY);
    if (cs) skillCatalog = cs;
    if (ci) itemCatalog = ci;

    const jobs = [];

    if (!skillCatalog) {
      jobs.push(
        fetchDoc(SKILL_URL).then((doc) => {
          const d = parseSkillCatalog(doc);
          if (!Object.keys(d).length) throw new Error('スキル表を抽出できませんでした');
          skillCatalog = d;
          writeCache(SKILL_CACHE_KEY, d);
        }).catch((e) => {
          loadError = 'スキル一覧: ' + (e && e.message ? e.message : String(e));
        })
      );
    }

    if (!itemCatalog) {
      jobs.push(
        fetchDoc(ITEM_URL).then((doc) => {
          const d = parseItemCatalog(doc);
          if (!Object.keys(d).length) throw new Error('アイテム表を抽出できませんでした');
          itemCatalog = d;
          writeCache(ITEM_CACHE_KEY, d);
        }).catch((e) => {
          loadError = (loadError ? loadError + ' / ' : '') +
            'アイテム一覧: ' + (e && e.message ? e.message : String(e));
        })
      );
    }

    if (jobs.length) await Promise.all(jobs);
  }

  const catalogsReady = () => !!(skillCatalog && itemCatalog);

  function lookup(name) {
    if (!name) return null;

    if (skillCatalog) {
      if (skillCatalog[name]) return Object.assign({ source: 'skill' }, skillCatalog[name]);
      const b = baseName(name);
      if (b !== name && skillCatalog[b]) return Object.assign({ source: 'skill' }, skillCatalog[b]);
    }

    if (itemCatalog) {
      const b = baseName(name);
      const hit = itemCatalog[name] || itemCatalog[b];
      if (hit) return Object.assign({ source: 'item' }, hit);
    }

    return null;
  }

  function cleanActor(text) {
    return sq(text)
      .replace(/\s*の\s*(?:自動行動|行動)\s*！?\s*$/, '')
      .replace(/[！!]\s*$/, '')
      .trim();
  }

  function findActorName(el) {
    const pt = el.closest('.passive-text');
    if (pt) {
      const a = pt.querySelector(':scope > .actor');
      if (a) return cleanActor(a.textContent);
    }
    const turn = el.closest('section.turn, .turn');
    if (turn) {
      const a = turn.querySelector(':scope > .actor');
      if (a) return cleanActor(a.textContent);
    }
    return null;
  }

  function buildUsage() {
    const byActor = new Map();
    const global = new Map();

    document.querySelectorAll('.skill-name, .skill-name-enemy').forEach((el) => {
      const dn = el.querySelector('.d-name');
      const std = dn ? sq(dn.textContent).replace(/[《》]/g, '').trim() : '';

      const clone = el.cloneNode(true);
      clone.querySelectorAll('.d-name').forEach((n) => n.remove());
      const custom = sq(clone.textContent).replace(/[！!]\s*$/, '').trim();
      if (!custom) return;

      const actor = findActorName(el);
      if (actor) {
        let list = byActor.get(actor);
        if (!list) { list = []; byActor.set(actor, list); }
        const hit = list.find((e) => e.custom === custom && e.std === std);
        if (hit) hit.count++;
        else list.push({ custom: custom, std: std, count: 1 });
      }

      if (std && std !== custom) {
        if (global.has(custom)) {
          if (global.get(custom) !== std) global.set(custom, null);
        } else {
          global.set(custom, std);
        }
      }
    });

    return { byActor, global };
  }

  function resolveStd(usage, actor, shown, count, nth) {
    const list = actor ? usage.byActor.get(actor) : null;
    if (list) {
      const cands = list.filter((e) => e.custom === shown);
      if (cands.length === 1) return cands[0].std || null;
      if (cands.length > 1) {
        const byCount = cands.filter((e) => e.count === count);
        if (byCount.length === 1) return byCount[0].std || null;
        const pick = cands[nth] || cands[0];
        return pick.std || null;
      }
    }
    const g = usage.global.get(shown);
    return g || null;
  }

  const CELL_RE = /^\s*┗\s*(.+?)\s*\((\d+)\)\s*$/;

  function unitNameOf(tr) {
    const td = tr.querySelector('td.summary-name-cell');
    if (!td) return null;
    return sq(td.textContent).replace(/^■\s*/, '').replace(/\s+/g, '').trim();
  }

  function applySummary(usage) {
    const tbody = document.querySelector('.battle-summary-table tbody');
    if (!tbody) return false;

    let actor = null;
    const seen = new Map();

    tbody.querySelectorAll('tr').forEach((tr) => {
      if (!tr.classList.contains('skill-detail-row')) {
        const n = unitNameOf(tr);
        if (n) actor = n;
        return;
      }

      const cell = tr.querySelector('td.skill-name-cell');
      if (!cell) return;

      const raw = cell.dataset.laSx === '1'
        ? '┗ ' + (cell.dataset.laShown || '') + ' (' + (cell.dataset.laCount || '0') + ')'
        : (cell.textContent || '');

      const m = raw.match(CELL_RE);
      if (!m) return;

      const shown = m[1];
      const count = Number(m[2]);

      const key = (actor || '') + '\u0000' + shown;
      const nth = seen.get(key) || 0;
      seen.set(key, nth + 1);

      if (cell.dataset.laSx === '1') return;

      const std = resolveStd(usage, actor, shown, count, nth);
      const finalName = (std && std !== shown) ? std : shown;

      cell.dataset.laSx = '1';
      cell.dataset.laName = finalName;
      cell.dataset.laShown = shown;
      cell.dataset.laCount = String(count);
      if (std && std !== shown) cell.dataset.laAlias = shown;
      if (actor) cell.dataset.laActor = actor;

      if (!NO_TOOLTIP.has(finalName)) {
        cell.classList.add('la-sx-cell');
        if (std && std !== shown) cell.classList.add('la-sx-renamed');
        if (!lookup(finalName)) cell.classList.add('la-sx-nodata');
      }

      cell.textContent = '';
      cell.appendChild(document.createTextNode('┗ '));
      const nm = document.createElement('span');
      nm.className = 'la-sx-nm';
      nm.textContent = finalName;
      cell.appendChild(nm);
      cell.appendChild(document.createTextNode(' (' + count + ')'));
    });

    return true;
  }

  let tip = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'la-sx-tip';
    document.body.appendChild(tip);
    return tip;
  }

  function row(dl, label, value) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function buildTipContent(cell) {
    const name = cell.dataset.laName || '';
    const alias = cell.dataset.laAlias || '';
    const info = lookup(name);

    const frag = document.createDocumentFragment();

    const h = document.createElement('div');
    h.className = 'la-sx-name';
    h.textContent = name;
    if (info && info.group) {
      const g = document.createElement('span');
      g.className = 'la-sx-group';
      g.textContent = groupLabel(info.group);
      h.appendChild(g);
    }
    frag.appendChild(h);

    if (alias) {
      const a = document.createElement('div');
      a.className = 'la-sx-alias';
      a.textContent = '表示名：' + alias;
      frag.appendChild(a);
    }

    if (info) {
      const dl = document.createElement('dl');
      row(dl, '使用条件', info.cond || '—');
      row(dl, '効果', info.eff || '—');
      frag.appendChild(dl);

      if (info.source === 'skill' && info.req) {
        const sub = document.createElement('dl');
        sub.className = 'la-sx-sub';
        row(sub, '取得条件', info.req);
        frag.appendChild(sub);
      }

      if (info.source === 'item') {
        const src = document.createElement('div');
        src.className = 'la-sx-src';
        src.textContent = '出典：アイテム効果';
        frag.appendChild(src);
      }
    } else {
      const n = document.createElement('div');
      n.className = 'la-sx-note';
      n.textContent = catalogsReady()
        ? '現時点で詳細不明のスキルです'
        : 'スキル/アイテム一覧を取得できませんでした' + (loadError ? '：' + loadError : '');
      frag.appendChild(n);
    }

    return frag;
  }

  function placeTip(rect) {
    tip.style.left = '-9999px';
    tip.style.top = '0px';
    tip.classList.add('la-sx-show');

    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const pad = 8;
    const gap = 12;

    let left = rect.left - w - gap;
    if (left < pad) {
      const right = rect.right + gap;
      left = Math.min(right, window.innerWidth - w - pad);
      if (left < pad) left = pad;
    }

    let top = rect.top + rect.height / 2 - h / 2;
    top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }

  function showTip(cell) {
    ensureTip();
    tip.textContent = '';
    tip.appendChild(buildTipContent(cell));
    placeTip(cell.getBoundingClientRect());
  }

  function hideTip() {
    if (tip) tip.classList.remove('la-sx-show');
  }

  function bindTip() {
    document.addEventListener('mouseover', (e) => {
      const cell = e.target.closest && e.target.closest('td.skill-name-cell.la-sx-cell');
      if (!cell) return;
      showTip(cell);
    });
    document.addEventListener('mouseout', (e) => {
      const cell = e.target.closest && e.target.closest('td.skill-name-cell.la-sx-cell');
      if (!cell) return;
      if (e.relatedTarget && cell.contains(e.relatedTarget)) return;
      hideTip();
    });
    window.addEventListener('scroll', hideTip, true);
    window.addEventListener('resize', hideTip);
  }

  let usage = null;

  function run() {
    if (!document.querySelector('.battle-summary-table tbody')) return false;
    if (!usage) usage = buildUsage();
    return applySummary(usage);
  }

  async function main() {
    injectStyle();
    bindTip();

    await loadCatalogs();

    if (!run()) {
      const mo = new MutationObserver(() => { if (run()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 30000);
    } else {
      const host = document.querySelector('.battle-summary') || document.body;
      const mo2 = new MutationObserver(() => run());
      mo2.observe(host, { childList: true, subtree: true });
    }
  }

  main();
})();
