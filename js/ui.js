/* ============================================================
 * ui.js — 画面の共通部品
 * 画面の切りかえ、カードの見た目、会話ウィンドウ、お知らせ窓など。
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF;
  const UI = HF.UI = {};

  UI.$ = function (sel, el) { return (el || document).querySelector(sel); };
  UI.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  UI.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  UI.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  };
  UI.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /* ---------- アイコン（コードで描く小さな絵） ---------- */
  const ICONS = {
    heart: 'M8 14.2 C2 9.6 .8 6.6 2.4 4.2 C4 2 6.8 2.4 8 4.7 C9.2 2.4 12 2 13.6 4.2 C15.2 6.6 14 9.6 8 14.2 Z',
    sword: 'M14 1 L15 2 L8.6 10.4 L5.6 7.4 Z M4.2 8 L8 11.8 L7 12.8 L5.8 11.6 L3.2 14.2 L1.8 12.8 L4.4 10.2 L3.2 9 Z',
    shield: 'M8 1.3 L13.6 3.4 V8 C13.6 11 11 13.6 8 14.9 C5 13.6 2.4 11 2.4 8 V3.4 Z',
    pierce: 'M1 6.6 H9.4 V3.2 L15.2 8 L9.4 12.8 V9.4 H1 Z',
    spark: 'M8 .8 L9.9 6.1 L15.2 8 L9.9 9.9 L8 15.2 L6.1 9.9 L.8 8 L6.1 6.1 Z',
    bolt: 'M9.6 .8 L2.8 9 H7.4 L6.4 15.2 L13.2 7 H8.6 Z',
    star: 'M8 1 L10.1 5.7 L15.2 6.3 L11.4 9.7 L12.5 14.8 L8 12.2 L3.5 14.8 L4.6 9.7 L.8 6.3 L5.9 5.7 Z',
    cards: 'M3 3.5 H10 V13.5 H3 Z M11.2 4.6 L13.8 5.3 L11.9 12.9 L11.2 12.7 Z',
    coin: 'M8 1.5 A6.5 6.5 0 1 0 8 14.5 A6.5 6.5 0 1 0 8 1.5 Z M8 4 L9.2 6.6 L12 7 L10 9 L10.5 11.8 L8 10.4 L5.5 11.8 L6 9 L4 7 L6.8 6.6 Z'
  };
  UI.icon = function (name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="' + ICONS[name] + '"/></svg>';
  };

  /* ---------- 画面の切りかえ ---------- */
  const screens = {};   // 名前 → {el, onShow, onHide}
  let current = null;
  UI.addScreen = function (name, hooks) {
    const el = UI.h('<section class="screen" id="scr-' + name + '"></section>');
    UI.$('#app').appendChild(el);
    screens[name] = Object.assign({ el: el }, hooks || {});
    return el;
  };
  UI.show = function (name, arg) {
    if (current && screens[current]) {
      screens[current].el.classList.remove('active');
      if (screens[current].onHide) screens[current].onHide();
    }
    current = name;
    screens[name].el.classList.add('active');
    if (screens[name].onShow) screens[name].onShow(arg);
  };
  UI.current = function () { return current; };

  /* ---------- カードの見た目 ---------- */
  // opt: {unit: 場のモンスターの今の数値, big: 説明文つき, cls: 追加クラス, attrs: 追加属性}
  UI.cardHTML = function (id, opt) {
    opt = opt || {};
    const c = HF.cards[id];
    if (!c) return '<div class="card unknown"><div class="c-name">？？？</div></div>';
    const u = opt.unit;
    const cls = ['card', c.type, 'r' + c.rarity];
    if (opt.big) cls.push('big');
    if (opt.cls) cls.push(opt.cls);
    let kw = '';
    (c.keywords || []).forEach(function (k) { kw += '<span class="kw kw-' + k + '">' + UI.icon(k === 'guard' ? 'shield' : 'pierce') + '</span>'; });
    if (c.type === 'monster' && c.onPlay) kw += '<span class="kw kw-onplay">' + UI.icon('spark') + '</span>';
    let stars = '';
    for (let i = 0; i < c.rarity; i++) stars += UI.icon('star');
    let html = '<div class="' + cls.join(' ') + '" data-card="' + id + '" ' + (opt.attrs || '') + '>' +
      '<div class="c-art">' + (HF.art[id] || '') + '</div>' +
      '<div class="c-rar">' + stars + '</div>' +
      (kw ? '<div class="c-kw">' + kw + '</div>' : '') +
      '<div class="c-name">' + UI.esc(c.name) + '</div>';
    if (opt.big) html += '<div class="c-text">' + UI.esc(HF.cardText(c)) + '</div>';
    if (c.type === 'monster') {
      const atk = u ? u.atk : c.atk, hp = u ? u.hp : c.hp;
      const atkCls = u && u.atk > c.atk ? ' up' : '';
      const hpCls = u ? (u.hp < u.maxHp ? ' down' : (u.hp > c.hp ? ' up' : '')) : '';
      html += '<div class="c-atk' + atkCls + '">' + UI.icon('sword') + '<b>' + atk + '</b></div>' +
        '<div class="c-hp' + hpCls + '">' + UI.icon('heart') + '<b>' + hp + '</b></div>';
    } else {
      html += '<div class="c-type">まほう</div>';
    }
    html += '<div class="c-cost">' + c.cost + '</div></div>';
    return html;
  };

  // カードの1行説明（コスト・数値・効果）
  UI.cardLine = function (id) {
    const c = HF.cards[id];
    const stat = c.type === 'monster' ? '攻撃' + c.atk + ' / HP' + c.hp : 'まほう';
    return '<b>' + UI.esc(c.name) + '</b>　<span class="dim">コスト' + c.cost + '・' + stat + '</span><br>' + UI.esc(HF.cardText(c));
  };

  /* ---------- お知らせ窓（モーダル） ---------- */
  // buttons: [{label, cls}]  →  押されたボタンの番号を返す
  UI.modal = function (html, buttons, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      buttons = buttons || [{ label: 'OK' }];
      const el = UI.h('<div class="modal"><div class="modal-box ' + (opt.cls || '') + '"><div class="modal-body">' + html + '</div><div class="modal-btns"></div></div></div>');
      const box = UI.$('.modal-btns', el);
      buttons.forEach(function (b, i) {
        const btn = UI.h('<button class="btn ' + (b.cls || '') + '">' + b.label + '</button>');
        btn.addEventListener('click', function () {
          if (b.keep && b.onClick) { b.onClick(el); return; }
          el.remove();
          resolve(i);
        });
        box.appendChild(btn);
      });
      UI.$('#app').appendChild(el);
      if (opt.onOpen) opt.onOpen(el);
    });
  };

  UI.cardDetail = function (id, extraHtml) {
    return UI.modal('<div class="detail-card" style="--w:210px">' + UI.cardHTML(id, { big: true }) + '</div>' + (extraHtml || ''), [{ label: 'とじる' }], { cls: 'slim' });
  };

  /* ---------- ちいさなお知らせ（トースト） ---------- */
  UI.toast = function (msg, ms) {
    const el = UI.h('<div class="toast">' + msg + '</div>');
    UI.$('#app').appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, ms || 1600);
    setTimeout(function () { el.remove(); }, (ms || 1600) + 400);
  };

  /* ---------- 会話ウィンドウ ---------- */
  let dlg = null;
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = UI.h('<div class="dialog hidden"><div class="dlg-box">' +
      '<div class="dlg-head"><img class="dlg-face" alt=""><span class="dlg-name"></span></div>' +
      '<div class="dlg-text"></div><div class="dlg-next">▼ タップでつぎへ</div><div class="dlg-choices"></div></div></div>');
    UI.$('#app').appendChild(dlg);
    return dlg;
  }
  UI.dialogOpen = function () { return !!dlg && !dlg.classList.contains('hidden'); };
  // 話している人物がかくれないよう、会話ウィンドウを画面の上に出すかどうか
  UI.setDialogTop = function (top) { ensureDialog().classList.toggle('top', !!top); };

  function setSpeaker(who) {
    const d = ensureDialog();
    const face = UI.$('.dlg-face', d), name = UI.$('.dlg-name', d);
    if (who && who.name) {
      name.textContent = who.name;
      UI.$('.dlg-head', d).style.display = '';
      if (who.look) { face.src = HF.Chars.portraitURL(who.look); face.style.display = ''; }
      else face.style.display = 'none';
    } else {
      UI.$('.dlg-head', d).style.display = 'none';
    }
  }

  // せりふを順番に表示。タップで次へ。 who: {name, look} か null（ナレーション）
  UI.say = function (who, lines) {
    const d = ensureDialog();
    setSpeaker(who);
    UI.$('.dlg-choices', d).innerHTML = '';
    UI.$('.dlg-next', d).style.display = '';
    d.classList.remove('hidden');
    let i = 0;
    const text = UI.$('.dlg-text', d);
    return new Promise(function (resolve) {
      function showLine() { text.textContent = lines[i]; }
      function next() {
        i++;
        if (i >= lines.length) {
          d.removeEventListener('click', next);
          d.classList.add('hidden');
          resolve();
        } else showLine();
      }
      showLine();
      // 開いたタップがそのまま「次へ」にならないよう、少し待ってから受けつける
      setTimeout(function () { d.addEventListener('click', next); }, 120);
    });
  };

  // えらぶ。 options: ['はい','いいえ'] → えらんだ番号
  UI.choose = function (who, prompt, options) {
    const d = ensureDialog();
    setSpeaker(who);
    UI.$('.dlg-text', d).textContent = prompt;
    UI.$('.dlg-next', d).style.display = 'none';
    const box = UI.$('.dlg-choices', d);
    box.innerHTML = '';
    d.classList.remove('hidden');
    return new Promise(function (resolve) {
      options.forEach(function (label, i) {
        const b = UI.h('<button class="btn ' + (i === 0 ? 'primary' : '') + '">' + label + '</button>');
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          d.classList.add('hidden');
          box.innerHTML = '';
          resolve(i);
        });
        box.appendChild(b);
      });
    });
  };
})();
