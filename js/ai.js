/* ============================================================
 * ai.js — 相手（コンピューター）の考え方
 * 「使えるカード×置き場所」をぜんぶ点数づけして、いちばん良い手をえらぶ。
 * skill（0〜1）が低い相手ほど、ときどき気まぐれな手を打つ。
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF;
  const B = HF.Battle;
  const AI = HF.AI = {};

  function unitValue(u) {
    return u.atk * 1.2 + u.hp + (u.guard ? 1.5 : 0);
  }

  function effectScore(st, side, e, ctx) {
    const S = st.sides[side], O = st.sides[B.other(side)];
    function dmgScore(u, n) {
      if (!u) return -1;
      const d = Math.max(0, n - (u.guard ? 1 : 0));
      if (d <= 0) return -1;
      return d >= u.hp ? unitValue(u) + 1.5 : d * 0.6;
    }
    switch (e.kind) {
      case 'damage':
        if (e.target === 'enemyMonster') return dmgScore(O.lanes[ctx.target], e.n);
        if (e.target === 'front') return O.lanes[ctx.lane] ? Math.max(0, dmgScore(O.lanes[ctx.lane], e.n)) : 0;
        if (e.target === 'allEnemies') {
          let s = 0, n = 0;
          O.lanes.forEach(function (u) { if (u) { s += Math.max(0, dmgScore(u, e.n)); n++; } });
          return n >= 2 || s >= 4 ? s : s - 2;
        }
        if (e.target === 'enemyPlayer') return e.n * 1.2 + (O.life <= e.n ? 100 : 0);
        return 0;
      case 'heal': {
        const gain = Math.min(e.n, S.maxLife - S.life);
        if (gain <= 0) return -1;
        return gain * 0.7 + (S.life <= 7 ? 2.5 : 0) - (gain < e.n ? 1 : 0);
      }
      case 'draw':
        return S.hand.length <= 5 && S.deck.length >= e.n ? 1.5 + e.n * 0.8 : -1;
      case 'buff': {
        function one(u, lane) {
          if (!u) return 0;
          let s = (e.atk || 0) * 1.1 + (e.hp || 0) * 0.7;
          if (e.atk && !O.lanes[lane]) s += e.atk * 0.8; // 正面ががら空きなら攻撃アップがよく効く
          return s;
        }
        if (e.target === 'allyMonster') return one(S.lanes[ctx.target], ctx.target) - 0.5;
        let s = 0;
        S.lanes.forEach(function (u, i) {
          if (e.target === 'otherAllies' && i === ctx.lane) return;
          s += one(u, i);
        });
        return s;
      }
    }
    return 0;
  }

  // そのレーンにそのモンスターがいることの「ありがたさ」
  function laneValue(atk, hp, guard, pierce, front, foeLife) {
    let v = (atk * 1.2 + hp + (guard ? 1.5 : 0)) * 0.45;
    if (front) {
      const need = front.hp + (front.guard ? 1 : 0);
      v += front.atk * 1.4;                           // 敵の攻撃を体で止める
      if (atk >= need) {
        v += 2 + front.atk * 0.5;                     // そのまま倒せる
        if (pierce) v += (atk - need) * 1.3 + (foeLife <= atk - need ? 100 : 0);
      } else {
        v += Math.max(0, atk - (front.guard ? 1 : 0)) * 0.4;
        if (front.atk - (guard ? 1 : 0) >= hp) v -= 1.5; // 次のターンにやられる
      }
    } else {
      v += atk * 1.3 + (foeLife <= atk ? 100 : 0);    // がら空きなら直接ダメージ
    }
    return v;
  }

  function monsterScore(st, side, c, lane) {
    const S = st.sides[side], O = st.sides[B.other(side)];
    const mine = S.lanes[lane], front = O.lanes[lane];
    const kw = c.keywords || [];
    let s = laneValue(c.atk, c.hp, kw.indexOf('guard') >= 0, kw.indexOf('pierce') >= 0, front, O.life);
    // 味方と入れかえる：強くなるぶんだけが得（カード1枚ぶんの損を引く）
    if (mine) s -= laneValue(mine.atk, mine.hp, mine.guard, mine.pierce, front, O.life) + 1.5;
    if (c.onPlay) s += effectScore(st, side, c.onPlay, { lane: lane });
    return s;
  }

  // いまできる行動を全部ならべて点数をつける
  AI.options = function (st, side) {
    const S = st.sides[side];
    const out = [];
    for (let i = 0; i < S.hand.length; i++) {
      const info = B.playInfo(st, side, i);
      if (!info.ok) continue;
      const c = HF.cards[S.hand[i]];
      if (c.type === 'monster') {
        info.targets.forEach(function (lane) {
          out.push({ type: 'play', hand: i, lane: lane, score: monsterScore(st, side, c, lane) });
        });
      } else if (info.mode === 'none') {
        out.push({ type: 'play', hand: i, lane: -1, score: effectScore(st, side, c.effect, {}) });
      } else {
        info.targets.forEach(function (lane) {
          out.push({ type: 'play', hand: i, lane: lane, score: effectScore(st, side, c.effect, { target: lane }) });
        });
      }
    }
    return out;
  };

  // 次の一手を決める。{type:'play', hand, lane} か {type:'end'}
  AI.choose = function (st, side, skill) {
    const rng = st.rng || Math.random;
    const opts = AI.options(st, side).filter(function (o) { return o.score > 0.3; });
    if (!opts.length) return { type: 'end' };
    if (rng() > skill) return opts[Math.floor(rng() * opts.length)]; // 気まぐれ
    opts.sort(function (a, b) { return b.score - a.score; });
    return opts[0];
  };
})(typeof window !== 'undefined' ? window : globalThis);
