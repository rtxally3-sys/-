/* ============================================================
 * battle-ui.js — バトル画面
 * ルールの計算は battle.js、相手の考えは ai.js。
 * ここは「見せる」「タップを受けつける」だけを担当する。
 *
 * 操作：手札のカードをタップ → 光った場所をタップ → 「こうげき！」でターン終了
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF, UI = HF.UI, B = HF.Battle;
  const BU = HF.BattleUI = {};

  let root, st, npc, onResult, resolveEnd;
  let sel = null;      // えらんでいる手札の番号
  let busy = true;     // アニメ中・相手のターン中は操作できない
  let peek = null;     // 場のカードをタップして説明を見ているとき {side, lane}
  let finished = false;

  BU.init = function () {
    root = UI.addScreen('battle', { onShow: layout });
    root.addEventListener('click', onClick);
    window.addEventListener('resize', function () { if (UI.current() === 'battle') { layout(); render(); } });
  };

  /* ---------- バトル開始 ---------- */
  // opts.onResult(win) → 結果画面に出す文（HTML）を返す
  BU.start = function (theNpc, opts) {
    npc = theNpc;
    onResult = opts.onResult;
    st = B.create({
      pDeck: HF.Save.data.deck, eDeck: HF.expandDeck(npc.deck),
      pLife: HF.PLAYER_LIFE, eLife: npc.life
    });
    sel = null; peek = null; busy = true; finished = false;
    root.innerHTML =
      '<div class="b-top">' +
      '<img class="b-face" alt="" src="' + HF.Chars.portraitURL(npc.look) + '">' +
      '<div class="b-who"><div class="b-name">' + UI.esc(npc.name) + '</div><div class="b-sub" id="b-esub"></div></div>' +
      '<div class="b-life" id="life-e">' + UI.icon('heart') + '<b></b></div></div>' +
      '<div class="b-field">' +
      '<div class="b-row" id="row-e">' + slots('e') + '</div>' +
      '<div class="b-mid"><span>▲ 相手</span><span id="b-turn"></span><span>じぶん ▼</span></div>' +
      '<div class="b-row" id="row-p">' + slots('p') + '</div></div>' +
      '<div class="b-me">' +
      '<div class="b-life" id="life-p">' + UI.icon('heart') + '<b></b></div>' +
      '<div class="b-energy" id="b-energy"></div>' +
      '<div class="b-deckn" id="b-deckn"></div>' +
      '<button class="b-giveup" id="b-giveup">こうさん</button></div>' +
      '<div class="b-info" id="b-info"></div>' +
      '<div class="b-hand" id="b-hand"></div>' +
      '<button class="btn primary b-end" id="b-end">こうげき！（ターン終了）</button>' +
      '<div class="b-banner" id="b-banner"></div>';
    UI.show('battle');
    layout();
    render();
    return new Promise(function (resolve) {
      resolveEnd = resolve;
      beginPlayerTurn(true);
    });
  };

  function slots(side) {
    let s = '';
    for (let i = 0; i < B.LANES; i++) s += '<div class="slot" data-side="' + side + '" data-lane="' + i + '"></div>';
    return s;
  }
  function slotEl(side, lane) { return UI.$('.slot[data-side="' + side + '"][data-lane="' + lane + '"]', root); }

  /* ---------- 大きさの計算（どのiPhoneでも1画面におさまるように） ---------- */
  function layout() {
    if (!root) return;
    const W = root.clientWidth, H = root.clientHeight;
    if (!W || !H) return;
    const handW = Math.max(54, Math.min(76, (W - 20) / 5.25));
    const handH = handW * 1.36;
    const fixed = 56 + 22 + 46 + 66 + (handH + 22) + 62 + 18; // 上の帯・中央・自分の帯・説明・手札・ボタン・すきま
    const laneByH = (H - fixed) / 2 / 1.36;
    const laneW = Math.max(60, Math.min(124, (W - 40) / 3, laneByH));
    root.style.setProperty('--laneW', laneW.toFixed(1) + 'px');
    root.style.setProperty('--handW', handW.toFixed(1) + 'px');
  }

  /* ---------- 画面を今の状態に合わせて描き直す ---------- */
  function render(opt) {
    opt = opt || {};
    const P = st.sides.p, E = st.sides.e;
    UI.$('#life-p b', root).textContent = P.life;
    UI.$('#life-e b', root).textContent = E.life;
    UI.$('#b-esub', root).innerHTML = '手札 ' + E.hand.length + '　山札 ' + E.deck.length + '　' + UI.icon('bolt') + E.energy + '/' + E.maxEnergy;
    let pips = '';
    for (let i = 0; i < B.MAX_ENERGY; i++) pips += '<i class="' + (i < P.energy ? 'on' : (i < P.maxEnergy ? 'used' : '')) + '"></i>';
    UI.$('#b-energy', root).innerHTML = UI.icon('bolt') + '<span class="pips">' + pips + '</span><b>' + P.energy + '</b>';
    UI.$('#b-deckn', root).textContent = '山札 ' + P.deck.length;
    UI.$('#b-turn', root).textContent = 'ターン ' + Math.ceil(Math.max(1, st.turn) / 2);

    const info = sel != null ? B.playInfo(st, 'p', sel) : null;
    ['e', 'p'].forEach(function (side) {
      for (let i = 0; i < B.LANES; i++) {
        const el = slotEl(side, i);
        const u = st.sides[side].lanes[i];
        el.innerHTML = u ? UI.cardHTML(u.card, { unit: u }) : '<div class="slot-empty"></div>';
        let target = false;
        if (info && info.ok && !busy) {
          if (info.mode === 'lane' && side === 'p') target = true;
          if (info.mode === 'enemy' && side === 'e' && info.targets.indexOf(i) >= 0) target = true;
          if (info.mode === 'ally' && side === 'p' && info.targets.indexOf(i) >= 0) target = true;
        }
        el.classList.toggle('target', target);
        el.classList.toggle('peek', !!peek && peek.side === side && peek.lane === i);
      }
    });

    // 手札（多いときは少し重ねる）
    const hand = UI.$('#b-hand', root);
    const n = P.hand.length;
    const handW = parseFloat(root.style.getPropertyValue('--handW')) || 64;
    const avail = root.clientWidth - 16;
    const gap = n > 1 ? Math.min(6, (avail - n * handW) / (n - 1)) : 0;
    let html = '';
    P.hand.forEach(function (id, i) {
      const ok = !busy && B.playInfo(st, 'p', i).ok;
      const cls = (ok ? 'playable' : 'dim') + (sel === i ? ' selected' : '') + (opt.newFrom != null && i >= opt.newFrom ? ' drawn' : '');
      html += '<div class="hand-card ' + cls + '" data-hand="' + i + '" style="' + (i ? 'margin-left:' + gap.toFixed(1) + 'px' : '') + '">' + UI.cardHTML(id) + '</div>';
    });
    hand.innerHTML = html;

    UI.$('#b-end', root).disabled = busy;
    UI.$('#b-giveup', root).disabled = busy;
    renderInfo(info);
  }

  function renderInfo(info) {
    const el = UI.$('#b-info', root);
    const P = st.sides.p;
    if (peek) {
      const u = st.sides[peek.side].lanes[peek.lane];
      if (u) { el.innerHTML = '<div class="info-card">' + UI.cardLine(u.card) + '</div>'; return; }
      peek = null;
    }
    if (sel != null && P.hand[sel]) {
      const id = P.hand[sel];
      let hint = '';
      if (busy) hint = '';
      else if (!info.ok) hint = '<span class="warn">いまは使えない：' + info.reason + '</span>';
      else if (info.mode === 'lane') hint = '<span class="go">▶ 光っているレーンをタップして出そう</span>';
      else if (info.mode === 'enemy') hint = '<span class="go">▶ ねらう敵モンスターをタップ</span>';
      else if (info.mode === 'ally') hint = '<span class="go">▶ 強くしたい味方をタップ</span>';
      else hint = '<button class="btn primary small" id="b-use">このカードをつかう</button>';
      el.innerHTML = '<div class="info-card">' + UI.cardLine(id) + '</div><div class="info-hint">' + hint + '</div>';
      return;
    }
    let msg;
    if (busy) msg = st.active === 'e' ? '相手のターン…' : '';
    else {
      const any = P.hand.some(function (_, i) { return B.playInfo(st, 'p', i).ok; });
      msg = any ? '手札のカードをタップしてえらぼう。<span class="dim">左上の数字がコスト（必要なエネルギー）</span>'
        : '使えるカードがない。<b>「こうげき！」</b>をおしてターンを終わろう';
    }
    el.innerHTML = '<div class="info-msg">' + msg + '</div>';
  }

  function say(html) { UI.$('#b-info', root).innerHTML = '<div class="info-msg">' + html + '</div>'; }

  /* ---------- えんしゅつ ---------- */
  function floatText(target, text, cls) {
    if (!target) return;
    const f = UI.h('<div class="float ' + (cls || '') + '">' + text + '</div>');
    target.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }
  function shake(el) {
    if (!el || !el.animate) return;
    el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 260 });
  }
  function banner(text) {
    const el = UI.$('#b-banner', root);
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // アニメをやり直すためのおまじない
    el.classList.add('show');
  }

  // 起きた出来事（events）を画面に出す
  async function fx(ev) {
    let shown = false;
    ev.forEach(function (e) {
      if (e.t === 'hit') {
        const s = slotEl(e.side, e.lane);
        floatText(s, e.dmg > 0 ? '-' + e.dmg : 'ガード!', e.dmg > 0 ? 'dmg' : 'buff');
        shake(s);
        if (e.dead) { const g = UI.h('<div class="poof"></div>'); s.appendChild(g); setTimeout(function () { g.remove(); }, 500); }
        shown = true;
      } else if (e.t === 'life' && e.delta !== 0) {
        const l = UI.$('#life-' + e.side, root);
        floatText(l, (e.delta > 0 ? '+' : '') + e.delta, e.delta > 0 ? 'heal' : 'dmg');
        if (e.delta < 0) { shake(l); if (e.side === 'p') { root.classList.add('hurt'); setTimeout(function () { root.classList.remove('hurt'); }, 300); } }
        shown = true;
      } else if (e.t === 'summon') {
        const cardEl = UI.$('.card', slotEl(e.side, e.lane));
        if (cardEl && cardEl.animate) cardEl.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 260 });
        shown = true;
      } else if (e.t === 'buff') {
        const parts = [];
        if (e.atk) parts.push('攻+' + e.atk);
        if (e.hp) parts.push('HP+' + e.hp);
        floatText(slotEl(e.side, e.lane), parts.join(' '), 'buff');
        shown = true;
      } else if (e.t === 'burn' && e.side === 'p') {
        UI.toast('手札がいっぱいで「' + HF.cards[e.card].name + '」は捨てられた');
      } else if (e.t === 'fatigue') {
        UI.toast((e.side === 'p' ? 'じぶん' : '相手') + 'の山札がなくなった！ ライフ-1');
      }
    });
    if (shown) await UI.sleep(380);
  }

  async function lunge(side, lane) {
    const cardEl = UI.$('.card', slotEl(side, lane));
    if (!cardEl || !cardEl.animate) return;
    const d = side === 'p' ? -1 : 1;
    cardEl.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + d * 34 + '%) scale(1.06)' }, { transform: 'translateY(0)' }], { duration: 300, easing: 'ease-in-out' });
    await UI.sleep(170);
  }

  /* ---------- ターンの流れ ---------- */
  async function beginPlayerTurn(first) {
    banner(first ? 'バトル スタート！' : 'きみのターン');
    await UI.sleep(first ? 900 : 500);
    const before = st.sides.p.hand.length;
    const ev = B.startTurn(st, 'p');
    busy = false;
    render({ newFrom: before });
    await fx(ev);
    if (st.winner) finish();
  }

  async function attackPhase(side) {
    for (let i = 0; i < B.LANES; i++) {
      if (!B.canAttack(st, side, i)) continue;
      await lunge(side, i);
      const ev = B.attackLane(st, side, i);
      render();
      await fx(ev);
      if (st.winner) return;
      await UI.sleep(90);
    }
  }

  async function enemyTurn() {
    banner('相手のターン');
    await UI.sleep(950);
    let ev = B.startTurn(st, 'e');
    render();
    await fx(ev);
    if (st.winner) return;
    for (let guard = 0; guard < 20; guard++) {
      const a = HF.AI.choose(st, 'e', npc.skill);
      if (a.type === 'end') break;
      const id = st.sides.e.hand[a.hand];
      say('<b>相手のカード：</b>' + UI.cardLine(id));
      const pop = UI.h('<div class="b-reveal" style="--w:150px">' + UI.cardHTML(id, { big: true }) + '</div>');
      root.appendChild(pop);
      await UI.sleep(1100);
      pop.remove();
      ev = B.playCard(st, 'e', a.hand, a.lane);
      render();
      say('<b>相手のカード：</b>' + UI.cardLine(id));
      await fx(ev);
      if (st.winner) return;
      await UI.sleep(250);
    }
    say('相手のこうげき！');
    await UI.sleep(300);
    await attackPhase('e');
  }

  async function endTurn() {
    if (busy || finished) return;
    busy = true; sel = null; peek = null;
    render();
    say('きみのこうげき！');
    await attackPhase('p');
    if (st.winner) return finish();
    await enemyTurn();
    if (st.winner) return finish();
    await beginPlayerTurn(false);
  }

  async function play(handIdx, lane) {
    if (busy || finished) return;
    busy = true; sel = null; peek = null;
    const ev = B.playCard(st, 'p', handIdx, lane);
    render();
    await fx(ev);
    if (st.winner) return finish();
    busy = false;
    render();
  }

  /* ---------- タップの受けつけ ---------- */
  function onClick(ev) {
    if (!st || finished) return;
    const t = ev.target;
    if (t.closest('#b-end')) { endTurn(); return; }
    if (t.closest('#b-use')) { if (sel != null) play(sel, -1); return; }
    if (t.closest('#b-giveup')) { giveUp(); return; }

    const hc = t.closest('.hand-card');
    if (hc) {
      const i = Number(hc.dataset.hand);
      peek = null;
      sel = sel === i ? null : i;
      render();
      return;
    }
    const slot = t.closest('.slot');
    if (slot) {
      const side = slot.dataset.side, lane = Number(slot.dataset.lane);
      if (sel != null && !busy) {
        const info = B.playInfo(st, 'p', sel);
        const want = info.ok && ((info.mode === 'lane' && side === 'p') ||
          (info.mode === 'enemy' && side === 'e' && info.targets.indexOf(lane) >= 0) ||
          (info.mode === 'ally' && side === 'p' && info.targets.indexOf(lane) >= 0));
        if (want) { play(sel, lane); return; }
      }
      // 場のカードをタップ → 説明を見る
      if (st.sides[side].lanes[lane]) {
        sel = null;
        peek = peek && peek.side === side && peek.lane === lane ? null : { side: side, lane: lane };
        render();
      }
      return;
    }
    if (sel != null || peek) { sel = null; peek = null; render(); }
  }

  async function giveUp() {
    if (busy || finished) return;
    const r = await UI.modal('<h3>こうさんする？</h3><p>このバトルは負けになります。<br>（お金やカードはへりません）</p>', [{ label: 'つづける', cls: 'primary' }, { label: 'こうさんする' }]);
    if (r === 1 && !finished) { st.winner = 'e'; finish(); }
  }

  /* ---------- けっか ---------- */
  async function finish() {
    if (finished) return;
    finished = true; busy = true;
    render();
    const win = st.winner === 'p';
    say(win ? '勝負あり！' : '負けてしまった…');
    await UI.sleep(700);
    const rewardHtml = onResult(win) || '';
    const el = UI.h('<div class="b-result ' + (win ? 'win' : 'lose') + '"><div class="res-box">' +
      '<div class="res-title">' + (win ? 'かち！' : 'まけ…') + '</div>' +
      '<div class="res-body">' + rewardHtml + '</div>' +
      '<button class="btn primary">もどる</button></div></div>');
    root.appendChild(el);
    UI.$('button', el).addEventListener('click', function (ev) {
      ev.stopPropagation();
      resolveEnd({ win: win });
    });
  }

  // テスト用：いまのバトルの状態をのぞく
  BU.debug = function () { return { st: st, busy: busy, finished: finished, sel: sel }; };
})();
