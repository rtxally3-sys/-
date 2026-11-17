/* ============================================================
 * core.js — ゲーム全体の「土台」
 * カード・パック・フィールドを登録する箱と、共通の小道具。
 * 画面には一切さわらない（テスト用にNode.jsでも動く）。
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF = root.HF || {};

  HF.VERSION = '0.1.0';
  HF.DECK_SIZE = 20;   // デッキの枚数
  HF.MAX_COPIES = 3;   // 同じカードを入れられる枚数
  HF.PLAYER_LIFE = 15; // プレイヤーのライフ

  HF.cards = {};   // カードID → カードの定義
  HF.packs = {};   // パックID → パックの定義
  HF.fields = {};  // フィールドID → フィールドの定義
  HF.art = {};     // カードID → 絵（SVGの文字列）
  HF.starter = null; // 最初のデッキ（field1.js で設定）

  HF.registerCards = function (setId, list) {
    list.forEach(function (c) {
      if (HF.cards[c.id]) throw new Error('カードIDが重複: ' + c.id);
      c.set = setId;
      HF.cards[c.id] = c;
    });
  };
  HF.registerPack = function (p) {
    if (HF.packs[p.id]) throw new Error('パックIDが重複: ' + p.id);
    HF.packs[p.id] = p;
  };
  HF.registerField = function (f) {
    if (HF.fields[f.id]) throw new Error('フィールドIDが重複: ' + f.id);
    HF.fields[f.id] = f;
  };
  HF.fieldList = function () {
    return Object.keys(HF.fields).map(function (k) { return HF.fields[k]; })
      .sort(function (a, b) { return a.order - b.order; });
  };

  // {カードID: 枚数} → [カードID, カードID, ...]
  HF.expandDeck = function (obj) {
    const out = [];
    Object.keys(obj).forEach(function (id) {
      if (!HF.cards[id]) throw new Error('存在しないカード: ' + id);
      for (let i = 0; i < obj[id]; i++) out.push(id);
    });
    return out;
  };

  /* ---------- カードの説明文（効果データから自動で作る） ---------- */
  HF.KEYWORDS = {
    pierce: { name: 'つらぬき', desc: '敵を倒して余ったダメージが相手のライフにとどく' },
    guard: { name: 'ガード', desc: '受けるダメージが1へる' }
  };

  function buffText(e) {
    const parts = [];
    if (e.atk) parts.push('攻撃+' + e.atk);
    if (e.hp) parts.push('HP+' + e.hp);
    return parts.join('・');
  }

  HF.effectText = function (e) {
    switch (e.kind) {
      case 'damage':
        if (e.target === 'enemyMonster') return '敵モンスター1体に' + e.n + 'ダメージ';
        if (e.target === 'front') return '正面の敵モンスターに' + e.n + 'ダメージ';
        if (e.target === 'allEnemies') return '敵モンスター全員に' + e.n + 'ダメージ';
        if (e.target === 'enemyPlayer') return '相手のライフに' + e.n + 'ダメージ';
        break;
      case 'heal': return '自分のライフを' + e.n + '回復';
      case 'draw': return 'カードを' + e.n + '枚引く';
      case 'buff':
        if (e.target === 'allyMonster') return '味方モンスター1体を' + buffText(e);
        if (e.target === 'otherAllies') return 'ほかの味方全員を' + buffText(e);
        if (e.target === 'allAllies') return '味方全員を' + buffText(e);
        break;
    }
    return '';
  };

  // カード1枚の説明文
  HF.cardText = function (c) {
    const parts = [];
    (c.keywords || []).forEach(function (k) {
      parts.push('【' + HF.KEYWORDS[k].name + '】' + HF.KEYWORDS[k].desc);
    });
    if (c.type === 'monster' && c.onPlay) parts.push('出たとき：' + HF.effectText(c.onPlay));
    if (c.type === 'spell') parts.push(HF.effectText(c.effect));
    return parts.join('。') || '（とくべつな効果はない）';
  };

  /* ---------- パックを開ける ---------- */
  HF.rollPack = function (pack, rng) {
    rng = rng || Math.random;
    const byRarity = { 1: [], 2: [], 3: [] };
    pack.cards.forEach(function (id) { byRarity[HF.cards[id].rarity].push(id); });
    function pick(r) {
      let list = byRarity[r];
      if (!list.length) list = pack.cards;
      return list[Math.floor(rng() * list.length)];
    }
    const out = [];
    for (let i = 0; i < pack.size; i++) {
      const x = rng();
      if (i === pack.size - 1) out.push(pick(x < 0.8 ? 2 : 3));      // 最後の1枚は★2以上
      else out.push(pick(x < 0.70 ? 1 : (x < 0.95 ? 2 : 3)));
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
