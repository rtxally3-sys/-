/* ============================================================
 * save.js — セーブデータ（iPhoneの中に自動保存）
 *
 * ブラウザの「localStorage」という、サイトごとの小さなメモ帳に保存する。
 *
 * ★あとでフィールドを足してもセーブが消えないための約束：
 *   1. 保存場所の名前（KEY）は絶対に変えない
 *   2. データの項目は「足す」だけ。名前を変えたり消したりしない
 *   3. 形を変える必要が出たら SAVE_VERSION を上げて、
 *      migrate() に「古い形 → 新しい形」の変換を書く
 *   4. 読みこみ時に normalize() が足りない項目を自動でおぎなう
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF;
  const KEY = 'hoshifuda_save';   // ← 変えない！
  const SAVE_VERSION = 1;

  const Save = HF.Save = { data: null };

  function firstFieldId() { return HF.fieldList()[0].id; }

  // まっさらな新規データ
  Save.fresh = function () {
    const cards = {};
    HF.starter.deck.forEach(function (id) { cards[id] = (cards[id] || 0) + 1; });
    return {
      v: SAVE_VERSION,
      started: false,            // オープニングを見たか
      money: HF.starter.money,
      cards: cards,              // 持っているカード {id: 枚数}
      deck: HF.starter.deck.slice(), // いまのデッキ [id × 20]
      wins: {},                  // 勝った回数 {人物id: 回数}
      field: firstFieldId(),     // いまいるフィールド
      pos: null,                 // マップ上の位置 {x, y, dir}
      flags: {},                 // そのほかの出来事メモ
      stats: { battles: 0, packs: 0 }
    };
  };

  // 古いバージョンのデータを新しい形に直す（今はバージョン1だけなので何もしない）
  function migrate(d) {
    // 例： if (d.v === 1) { d.newThing = ...; d.v = 2; }
    d.v = SAVE_VERSION;
    return d;
  }

  // どんなデータが来ても「遊べる正しい形」にして返す
  Save.normalize = function (raw) {
    const base = Save.fresh();
    if (!raw || typeof raw !== 'object') return base;
    const d = migrate(Object.assign({}, raw));
    const out = base;

    out.started = !!d.started;
    if (typeof d.money === 'number' && isFinite(d.money)) out.money = Math.max(0, Math.floor(d.money));
    if (d.cards && typeof d.cards === 'object') {
      out.cards = {};
      Object.keys(d.cards).forEach(function (id) {
        const n = Math.floor(Number(d.cards[id]));
        if (n > 0) out.cards[id] = n;
      });
    }
    if (d.wins && typeof d.wins === 'object') out.wins = Object.assign({}, d.wins);
    if (d.flags && typeof d.flags === 'object') out.flags = Object.assign({}, d.flags);
    if (d.stats && typeof d.stats === 'object') out.stats = Object.assign(out.stats, d.stats);
    if (typeof d.field === 'string' && HF.fields[d.field]) {
      out.field = d.field;
      if (d.pos && typeof d.pos.x === 'number' && typeof d.pos.y === 'number') {
        out.pos = { x: d.pos.x, y: d.pos.y, dir: d.pos.dir || 'down' };
      }
    }

    // デッキ：知らないカード・持っていない枚数ぶんは外して、20枚になるよう持ち札からおぎなう
    const used = {};
    const deck = [];
    (Array.isArray(d.deck) ? d.deck : []).forEach(function (id) {
      if (!HF.cards[id] || deck.length >= HF.DECK_SIZE) return;
      const have = out.cards[id] || 0;
      if ((used[id] || 0) < Math.min(have, HF.MAX_COPIES)) { deck.push(id); used[id] = (used[id] || 0) + 1; }
    });
    if (deck.length < HF.DECK_SIZE) {
      const pool = Object.keys(out.cards).filter(function (id) { return HF.cards[id]; })
        .sort(function (a, b) { return HF.cards[a].cost - HF.cards[b].cost; });
      let progress = true;
      while (deck.length < HF.DECK_SIZE && progress) {
        progress = false;
        for (let i = 0; i < pool.length && deck.length < HF.DECK_SIZE; i++) {
          const id = pool[i];
          if ((used[id] || 0) < Math.min(out.cards[id], HF.MAX_COPIES)) { deck.push(id); used[id] = (used[id] || 0) + 1; progress = true; }
        }
      }
    }
    if (deck.length < HF.DECK_SIZE) {
      // それでも足りない（ふつうは起きない）→ 最初のデッキを配り直す
      HF.starter.deck.forEach(function (id) { out.cards[id] = Math.max(out.cards[id] || 0, HF.starter.deck.filter(function (x) { return x === id; }).length); });
      out.deck = HF.starter.deck.slice();
    } else {
      out.deck = deck;
    }
    return out;
  };

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  Save.exists = function () {
    const ls = storage();
    try { return !!(ls && ls.getItem(KEY)); } catch (e) { return false; }
  };

  Save.load = function () {
    const ls = storage();
    let raw = null;
    try { raw = ls ? JSON.parse(ls.getItem(KEY)) : null; } catch (e) { raw = null; }
    Save.data = Save.normalize(raw);
    return Save.data;
  };

  // 保存。うまくいけば true
  Save.save = function () {
    const ls = storage();
    if (!ls || !Save.data) return false;
    try { ls.setItem(KEY, JSON.stringify(Save.data)); return true; } catch (e) { return false; }
  };

  Save.reset = function () {
    Save.data = Save.fresh();
    Save.save();
    return Save.data;
  };

  /* ---------- バックアップ（文字にして書き出す／読みこむ） ---------- */
  Save.exportCode = function () {
    const json = JSON.stringify(Save.data);
    return 'HOSHI1:' + root.btoa(unescape(encodeURIComponent(json)));
  };
  Save.importCode = function (code) {
    try {
      const m = String(code).trim().match(/^HOSHI1:([A-Za-z0-9+/=]+)$/);
      if (!m) return false;
      const obj = JSON.parse(decodeURIComponent(escape(root.atob(m[1]))));
      if (!obj || typeof obj !== 'object' || !obj.cards) return false;
      Save.data = Save.normalize(obj);
      Save.save();
      return true;
    } catch (e) { return false; }
  };

  /* ---------- よく使う操作 ---------- */
  Save.addCard = function (id, n) {
    const d = Save.data;
    d.cards[id] = (d.cards[id] || 0) + (n || 1);
  };
  Save.winsOf = function (npcId) { return Save.data.wins[npcId] || 0; };
})(typeof window !== 'undefined' ? window : globalThis);
