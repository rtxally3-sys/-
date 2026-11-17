/* ============================================================
 * battle.js — バトルのルール（計算だけ。画面にはさわらない）
 *
 * side は 'p'（プレイヤー）か 'e'（相手）。
 * どの関数も「何が起きたか」のリスト（events）を返すので、
 * 画面側はそれを見てアニメーションを出す。
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF;
  const B = HF.Battle = {};

  B.MAX_ENERGY = 6;  // エネルギーの上限
  B.HAND_MAX = 7;    // 手札の上限
  B.START_HAND = 4;  // 最初の手札
  B.LANES = 3;       // レーンの数

  B.other = function (s) { return s === 'p' ? 'e' : 'p'; };

  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 最初の手札に「コスト2以下のモンスター」が1枚は入るように配る（事故防止のやさしさ）
  function dealOpening(deck, rng) {
    for (let tries = 0; tries < 8; tries++) {
      shuffle(deck, rng);
      const hand = deck.slice(-B.START_HAND);
      if (hand.some(function (id) { const c = HF.cards[id]; return c.type === 'monster' && c.cost <= 2; })) break;
    }
  }

  B.create = function (o) {
    const rng = o.rng || Math.random;
    function mk(deckIds, life) {
      const deck = deckIds.slice();
      dealOpening(deck, rng);
      const S = { life: life, maxLife: life, energy: 0, maxEnergy: 0, deck: deck, hand: [], lanes: [null, null, null], discard: [] };
      for (let i = 0; i < B.START_HAND; i++) S.hand.push(S.deck.pop());
      return S;
    }
    return {
      turn: 0, active: null, winner: null, rng: rng, uid: 0,
      sides: { p: mk(o.pDeck, o.pLife || 20), e: mk(o.eDeck, o.eLife || 20) }
    };
  };

  /* ---------- 内部の小さな処理 ---------- */
  function drawCard(st, side, ev) {
    const S = st.sides[side];
    if (!S.deck.length) return false;
    const id = S.deck.pop();
    if (S.hand.length >= B.HAND_MAX) { S.discard.push(id); ev.push({ t: 'burn', side: side, card: id }); }
    else { S.hand.push(id); ev.push({ t: 'draw', side: side, card: id }); }
    return true;
  }

  function hurtPlayer(st, side, n, ev) {
    const S = st.sides[side];
    S.life = Math.max(0, S.life - n);
    ev.push({ t: 'life', side: side, delta: -n });
    if (S.life <= 0 && !st.winner) { st.winner = B.other(side); ev.push({ t: 'win', side: st.winner }); }
  }

  function hurtUnit(st, side, lane, n, ev) {
    const S = st.sides[side];
    const u = S.lanes[lane];
    if (!u) return;
    const dmg = Math.max(0, n - (u.guard ? 1 : 0));
    u.hp -= dmg;
    const dead = u.hp <= 0;
    ev.push({ t: 'hit', side: side, lane: lane, dmg: dmg, dead: dead, card: u.card });
    if (dead) { S.lanes[lane] = null; S.discard.push(u.card); }
  }

  function lanesWithUnits(S) {
    const out = [];
    for (let i = 0; i < B.LANES; i++) if (S.lanes[i]) out.push(i);
    return out;
  }

  function applyEffect(st, side, e, ctx, ev) {
    const S = st.sides[side], os = B.other(side), O = st.sides[os];
    switch (e.kind) {
      case 'damage':
        if (e.target === 'enemyMonster') hurtUnit(st, os, ctx.target, e.n, ev);
        else if (e.target === 'front') hurtUnit(st, os, ctx.lane, e.n, ev);
        else if (e.target === 'allEnemies') lanesWithUnits(O).forEach(function (i) { hurtUnit(st, os, i, e.n, ev); });
        else if (e.target === 'enemyPlayer') hurtPlayer(st, os, e.n, ev);
        break;
      case 'heal': {
        const before = S.life;
        S.life = Math.min(S.maxLife, S.life + e.n);
        ev.push({ t: 'life', side: side, delta: S.life - before });
        break;
      }
      case 'draw':
        for (let i = 0; i < e.n; i++) drawCard(st, side, ev);
        break;
      case 'buff': {
        let lanes = [];
        if (e.target === 'allyMonster') lanes = [ctx.target];
        else if (e.target === 'otherAllies') lanes = lanesWithUnits(S).filter(function (i) { return i !== ctx.lane; });
        else if (e.target === 'allAllies') lanes = lanesWithUnits(S);
        lanes.forEach(function (i) {
          const u = S.lanes[i];
          if (!u) return;
          u.atk += e.atk || 0;
          u.hp += e.hp || 0;
          u.maxHp += e.hp || 0;
          ev.push({ t: 'buff', side: side, lane: i, atk: e.atk || 0, hp: e.hp || 0 });
        });
        break;
      }
    }
  }

  /* ---------- ターン開始：エネルギー回復＋1枚引く ---------- */
  B.startTurn = function (st, side) {
    const ev = [];
    if (st.winner) return ev;
    st.active = side;
    st.turn++;
    const S = st.sides[side];
    S.maxEnergy = Math.min(B.MAX_ENERGY, S.maxEnergy + 1);
    S.energy = S.maxEnergy;
    if (!drawCard(st, side, ev)) {
      // 山札切れ：引くかわりにライフが1へる（試合が終わらなくなるのを防ぐ）
      ev.push({ t: 'fatigue', side: side });
      hurtPlayer(st, side, 1, ev);
    }
    return ev;
  };

  /* ---------- そのカードを今使えるか？どこに使えるか？ ---------- */
  B.playInfo = function (st, side, handIdx) {
    const S = st.sides[side], O = st.sides[B.other(side)];
    const c = HF.cards[S.hand[handIdx]];
    if (!c || st.winner) return { ok: false, reason: '' };
    if (c.cost > S.energy) return { ok: false, reason: 'エネルギーがたりない' };
    if (c.type === 'monster') return { ok: true, mode: 'lane', targets: [0, 1, 2] };
    const e = c.effect;
    if (e.target === 'enemyMonster' || e.target === 'allEnemies') {
      const t = lanesWithUnits(O);
      if (!t.length) return { ok: false, reason: '敵モンスターがいない' };
      return e.target === 'enemyMonster' ? { ok: true, mode: 'enemy', targets: t } : { ok: true, mode: 'none', targets: [] };
    }
    if (e.target === 'allyMonster' || e.target === 'allAllies') {
      const t = lanesWithUnits(S);
      if (!t.length) return { ok: false, reason: '味方モンスターがいない' };
      return e.target === 'allyMonster' ? { ok: true, mode: 'ally', targets: t } : { ok: true, mode: 'none', targets: [] };
    }
    if (e.kind === 'heal' && S.life >= S.maxLife) return { ok: false, reason: 'ライフがへっていない' };
    return { ok: true, mode: 'none', targets: [] };
  };

  /* ---------- カードを使う ---------- */
  B.playCard = function (st, side, handIdx, lane) {
    const ev = [];
    const info = B.playInfo(st, side, handIdx);
    if (!info.ok) return ev;
    if (info.mode !== 'none' && info.targets.indexOf(lane) < 0) return ev;
    const S = st.sides[side];
    const id = S.hand[handIdx];
    const c = HF.cards[id];
    S.energy -= c.cost;
    S.hand.splice(handIdx, 1);
    ev.push({ t: 'play', side: side, card: id, lane: lane, mode: info.mode });

    if (c.type === 'monster') {
      const old = S.lanes[lane];
      if (old) { S.discard.push(old.card); ev.push({ t: 'replace', side: side, lane: lane, card: old.card }); }
      const kw = c.keywords || [];
      S.lanes[lane] = {
        uid: ++st.uid, card: id, atk: c.atk, hp: c.hp, maxHp: c.hp,
        guard: kw.indexOf('guard') >= 0, pierce: kw.indexOf('pierce') >= 0
      };
      ev.push({ t: 'summon', side: side, lane: lane, card: id });
      if (c.onPlay) applyEffect(st, side, c.onPlay, { lane: lane }, ev);
    } else {
      applyEffect(st, side, c.effect, { target: lane }, ev);
      S.discard.push(id);
    }
    return ev;
  };

  /* ---------- 攻撃：正面にモンスターがいればそれを、いなければ相手本人を ---------- */
  B.canAttack = function (st, side, lane) {
    const u = st.sides[side].lanes[lane];
    return !!u && u.atk > 0 && !st.winner;
  };

  B.attackLane = function (st, side, lane) {
    const ev = [];
    if (!B.canAttack(st, side, lane)) return ev;
    const u = st.sides[side].lanes[lane];
    const os = B.other(side);
    const target = st.sides[os].lanes[lane];
    ev.push({ t: 'attack', side: side, lane: lane, target: target ? 'unit' : 'player' });
    if (target) {
      const need = target.hp + (target.guard ? 1 : 0); // 倒すのに必要なダメージ
      hurtUnit(st, os, lane, u.atk, ev);
      // 【つらぬき】倒して余ったダメージは相手のライフへ
      if (u.pierce && u.atk > need) hurtPlayer(st, os, u.atk - need, ev);
    } else {
      hurtPlayer(st, os, u.atk, ev);
    }
    return ev;
  };
})(typeof window !== 'undefined' ? window : globalThis);
