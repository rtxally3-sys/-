/* ============================================================
 * map.js — フィールド（マップ）を歩く画面
 * 行きたいマスをタップ → そこまで自動で歩く。
 * 人や看板をタップ → となりまで歩いて話しかける。
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF, UI = HF.UI, Chars = HF.Chars, Save = HF.Save;
  const M = HF.Map = {};

  const WALKABLE = '.,=';
  const STEP_MS = 150;        // 1マス歩く時間
  const VIEW_COLS = 9;        // 画面に入る横のマス数

  let root, cv, ctx, field, grid, mapW, mapH;
  let ts = 40, viewW = 0, viewH = 0, dpr = 1;
  let player = { x: 0, y: 0, dir: 'down', fx: 0, fy: 0, path: [], t: 0, moving: false, phase: 0 };
  let onArrive = null;        // 歩き終わったら呼ぶ
  let marker = null;          // タップした場所の目印
  let raf = 0, last = 0, time = 0;
  let locked = false;         // 会話中などは操作できない

  /* ---------- 画面の骨組み ---------- */
  M.init = function () {
    root = UI.addScreen('map', { onShow: start, onHide: stop });
    root.innerHTML =
      '<header class="hud"><div class="hud-field"></div><div class="hud-money">' + UI.icon('coin') + '<b></b></div></header>' +
      '<div class="hud-goal"></div>' +
      '<div class="map-wrap"><canvas></canvas></div>' +
      '<nav class="mapbar">' +
      '<button class="btn" data-act="deck">' + UI.icon('cards') + 'デッキ</button>' +
      '<button class="btn" data-act="help">あそびかた</button>' +
      '<button class="btn" data-act="settings">せってい</button></nav>';
    cv = UI.$('canvas', root);
    ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      const r = cv.getBoundingClientRect();
      tap(ev.clientX - r.left, ev.clientY - r.top);
    });
    UI.$('.mapbar', root).addEventListener('click', function (ev) {
      const b = ev.target.closest('button');
      if (!b || locked || UI.dialogOpen()) return;
      stopWalking();
      if (b.dataset.act === 'deck') UI.show('deck');
      if (b.dataset.act === 'help') UI.show('help');
      if (b.dataset.act === 'settings') UI.show('settings');
    });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
  };

  /* ---------- フィールドに入る ---------- */
  M.enter = function (fieldId, spawn) {
    field = HF.fields[fieldId];
    grid = field.map;
    mapH = grid.length; mapW = grid[0].length;
    const s = spawn || field.start;
    player.x = s.x; player.y = s.y; player.dir = s.dir || 'down';
    if (!canStand(player.x, player.y)) { player.x = field.start.x; player.y = field.start.y; }
    player.fx = player.x; player.fy = player.y;
    player.path = []; player.moving = false; onArrive = null; marker = null;
    Save.data.field = fieldId;
    savePos();
    M.refreshHud();
  };
  M.field = function () { return field; };
  M.lock = function (v) { locked = v; };

  function savePos() {
    Save.data.pos = { x: player.x, y: player.y, dir: player.dir };
    Save.save();
  }

  M.refreshHud = function () {
    if (!root || !field) return;
    UI.$('.hud-field', root).textContent = field.name;
    UI.$('.hud-money b', root).textContent = Save.data.money + ' G';
    UI.$('.hud-goal', root).textContent = HF.Game.goalText(field);
  };

  /* ---------- マスの情報 ---------- */
  function tileAt(x, y) {
    if (y < 0 || y >= mapH || x < 0 || x >= mapW) return 'T';
    return grid[y][x];
  }
  function npcPos(n) {
    if (n.posAfterWin && Save.winsOf(n.id) > 0) return n.posAfterWin;
    return n;
  }
  function npcAt(x, y) {
    for (let i = 0; i < field.npcs.length; i++) {
      const p = npcPos(field.npcs[i]);
      if (p.x === x && p.y === y) return field.npcs[i];
    }
    return null;
  }
  function exitAt(x, y) {
    const ex = field.exits || [];
    for (let i = 0; i < ex.length; i++) if (ex[i].x === x && ex[i].y === y) return ex[i];
    return null;
  }
  function exitOpen(ex) { return !ex.requires || Save.winsOf(ex.requires) > 0; }
  function canStand(x, y) {
    const t = tileAt(x, y);
    if (npcAt(x, y)) return false;
    if (t === 'G') { const ex = exitAt(x, y); return !!ex && exitOpen(ex); }
    return WALKABLE.indexOf(t) >= 0;
  }

  /* ---------- 道さがし（いちばん近い道を見つける） ---------- */
  // goalFn(x, y) が true になるマスまでの道順を返す。行けないときは null
  function findPath(sx, sy, goalFn) {
    const prev = {};
    const key = function (x, y) { return x + ',' + y; };
    const queue = [[sx, sy]];
    prev[key(sx, sy)] = null;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (queue.length) {
      const cur = queue.shift();
      if (goalFn(cur[0], cur[1])) {
        const path = [];
        let k = key(cur[0], cur[1]), node = cur;
        while (prev[k]) { path.unshift(node); node = prev[k]; k = key(node[0], node[1]); }
        return path;
      }
      for (let i = 0; i < 4; i++) {
        const nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        if (prev[key(nx, ny)] !== undefined || !canStand(nx, ny)) continue;
        prev[key(nx, ny)] = cur;
        queue.push([nx, ny]);
      }
    }
    return null;
  }

  function faceToward(tx, ty) {
    const dx = tx - player.x, dy = ty - player.y;
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) player.dir = dy > 0 ? 'down' : 'up';
  }

  function stopWalking() { player.path = []; onArrive = null; }

  function walkTo(goalFn, then) {
    const path = findPath(player.moving ? player.path0x : player.x, player.moving ? player.path0y : player.y, goalFn);
    if (!path) return false;
    player.path = path;
    onArrive = then || null;
    if (!player.moving && !path.length) arrive();
    return true;
  }

  /* ---------- タップ ---------- */
  function tap(px, py) {
    if (locked || UI.dialogOpen()) return;
    const cam = camera();
    const tx = Math.floor((px + cam.x) / ts), ty = Math.floor((py + cam.y) / ts);
    if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return;
    marker = { x: tx, y: ty, t: 0 };

    const npc = npcAt(tx, ty);
    const ex = exitAt(tx, ty);
    if (npc) { // 人：となりまで歩いて話す
      walkTo(function (x, y) { return Math.abs(x - tx) + Math.abs(y - ty) === 1; }, function () {
        faceToward(tx, ty);
        HF.Game.talk(npc);
      });
    } else if (ex && !exitOpen(ex)) { // しまっている門
      walkTo(function (x, y) { return Math.abs(x - tx) + Math.abs(y - ty) === 1; }, function () {
        faceToward(tx, ty);
        HF.Game.closedExit(ex);
      });
    } else if (canStand(tx, ty)) {
      walkTo(function (x, y) { return x === tx && y === ty; });
    } else {
      marker = null;
    }
  }

  // キーボード（パソコンで動作確認するとき用）
  function onKey(ev) {
    if (UI.current() !== 'map' || locked || UI.dialogOpen() || player.moving) return;
    const d = { ArrowUp: [0, -1, 'up'], ArrowDown: [0, 1, 'down'], ArrowLeft: [-1, 0, 'left'], ArrowRight: [1, 0, 'right'] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    const tx = player.x + d[0], ty = player.y + d[1];
    player.dir = d[2];
    const npc = npcAt(tx, ty), ex = exitAt(tx, ty);
    if (npc) HF.Game.talk(npc);
    else if (ex && !exitOpen(ex)) HF.Game.closedExit(ex);
    else if (canStand(tx, ty)) walkTo(function (x, y) { return x === tx && y === ty; });
  }

  // NPCが話しかけられたとき、プレイヤーのほうを向く
  M.faceNpcToPlayer = function (npc) {
    const p = npcPos(npc);
    const dx = player.x - p.x, dy = player.y - p.y;
    npc._dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };

  // プレイヤーが画面の下のほうにいるか（会話ウィンドウを上に出す判断に使う）
  M.playerIsLow = function () {
    if (!viewH) return false;
    return (player.fy + 0.5) * ts - camera().y > viewH * 0.52;
  };

  // プレイヤーを1マス戻す（行き止まりの門など）
  M.stepBack = function () {
    const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[player.dir];
    const nx = player.x + d[0], ny = player.y + d[1];
    if (canStand(nx, ny)) { player.x = nx; player.y = ny; player.fx = nx; player.fy = ny; savePos(); }
  };

  /* ---------- 動きの更新 ---------- */
  function arrive() {
    player.moving = false;
    savePos();
    const ex = exitAt(player.x, player.y);
    const cb = onArrive;
    onArrive = null;
    if (ex && exitOpen(ex)) { HF.Game.useExit(ex); return; }
    if (cb) cb();
  }

  function update(dt) {
    time += dt;
    if (marker) { marker.t += dt; if (marker.t > 600) marker = null; }
    if (!player.moving && player.path.length) {
      const next = player.path.shift();
      if (!canStand(next[0], next[1])) { player.path = []; arrive(); return; }
      player.fromX = player.x; player.fromY = player.y;
      player.path0x = next[0]; player.path0y = next[1];
      faceToward(next[0], next[1]);
      player.moving = true; player.t = 0;
    }
    if (player.moving) {
      player.t += dt;
      const k = Math.min(1, player.t / STEP_MS);
      player.fx = player.fromX + (player.path0x - player.fromX) * k;
      player.fy = player.fromY + (player.path0y - player.fromY) * k;
      player.phase = (player.phase + dt / (STEP_MS * 2)) % 1;
      if (k >= 1) {
        player.x = player.path0x; player.y = player.path0y;
        player.fx = player.x; player.fy = player.y;
        player.moving = false;
        if (!player.path.length) arrive();
      }
    }
  }

  /* ---------- 画面サイズ ---------- */
  function resize() {
    if (!cv || UI.current() !== 'map') return;
    const wrap = cv.parentElement;
    viewW = wrap.clientWidth; viewH = wrap.clientHeight;
    if (!viewW || !viewH) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    ts = Math.floor(viewW / VIEW_COLS);
    cv.width = Math.round(viewW * dpr); cv.height = Math.round(viewH * dpr);
    cv.style.width = viewW + 'px'; cv.style.height = viewH + 'px';
  }

  function camera() {
    const mw = mapW * ts, mh = mapH * ts;
    let x = (player.fx + 0.5) * ts - viewW / 2, y = (player.fy + 0.5) * ts - viewH / 2;
    x = mw <= viewW ? (mw - viewW) / 2 : Math.max(0, Math.min(mw - viewW, x));
    y = mh <= viewH ? (mh - viewH) / 2 : Math.max(0, Math.min(mh - viewH, y));
    return { x: Math.round(x), y: Math.round(y) };
  }

  /* ---------- 絵を描く ---------- */
  function rnd(x, y, i) {
    const n = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function rect(c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(c, x, y, r) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  function drawGrass(x, y, px, py) {
    rect((x + y) % 2 ? '#86cf70' : '#8dd477', px, py, ts, ts);
    ctx.strokeStyle = '#6fbb5c'; ctx.lineWidth = Math.max(1, ts * 0.04); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const gx = px + (0.15 + rnd(x, y, i) * 0.7) * ts, gy = py + (0.25 + rnd(x, y, i + 9) * 0.6) * ts;
      ctx.beginPath(); ctx.moveTo(gx - ts * 0.05, gy); ctx.lineTo(gx - ts * 0.02, gy - ts * 0.09);
      ctx.moveTo(gx + ts * 0.05, gy); ctx.lineTo(gx + ts * 0.02, gy - ts * 0.09); ctx.stroke();
    }
  }

  function drawTile(t, x, y, px, py) {
    switch (t) {
      case '.': drawGrass(x, y, px, py); break;
      case ',': {
        drawGrass(x, y, px, py);
        const cols = ['#fff', '#ffe27a', '#ff9fb5', '#fff'];
        for (let i = 0; i < 4; i++) {
          const fx = px + (0.18 + rnd(x, y, i + 20) * 0.64) * ts, fy = py + (0.18 + rnd(x, y, i + 30) * 0.64) * ts;
          circ(cols[i], fx, fy, ts * 0.075);
          circ('#f5a623', fx, fy, ts * 0.03);
        }
        break;
      }
      case '=': {
        rect('#e9d3a0', px, py, ts, ts);
        for (let i = 0; i < 4; i++) circ('#d9c088', px + rnd(x, y, i + 40) * ts * 0.8 + ts * 0.1, py + rnd(x, y, i + 50) * ts * 0.8 + ts * 0.1, ts * 0.04);
        // 草とのさかい目
        ctx.fillStyle = '#86cf70';
        const e = ts * 0.08;
        if (tileAt(x, y - 1) !== '=' && tileAt(x, y - 1) !== 'G') ctx.fillRect(px, py, ts, e);
        if (tileAt(x, y + 1) !== '=') ctx.fillRect(px, py + ts - e, ts, e);
        if (tileAt(x - 1, y) !== '=') ctx.fillRect(px, py, e, ts);
        if (tileAt(x + 1, y) !== '=') ctx.fillRect(px + ts - e, py, e, ts);
        break;
      }
      case 'T': {
        rect('#6dba5c', px, py, ts, ts);
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.beginPath(); ctx.ellipse(px + ts / 2, py + ts * 0.9, ts * 0.34, ts * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        rect('#8a5a34', px + ts * 0.42, py + ts * 0.58, ts * 0.16, ts * 0.32);
        circ('#3f9a50', px + ts / 2, py + ts * 0.4, ts * 0.38);
        circ('#3f9a50', px + ts * 0.28, py + ts * 0.5, ts * 0.22);
        circ('#3f9a50', px + ts * 0.72, py + ts * 0.5, ts * 0.22);
        circ('#5cb86a', px + ts * 0.42, py + ts * 0.3, ts * 0.17);
        break;
      }
      case 'W': {
        rect('#5db5e8', px, py, ts, ts);
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, ts * 0.045); ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          const wx = px + (0.2 + rnd(x, y, i + 60) * 0.4) * ts + Math.sin(time / 700 + x + y + i) * ts * 0.06;
          const wy = py + (0.3 + i * 0.4) * ts;
          ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + ts * 0.1, wy - ts * 0.06, wx + ts * 0.2, wy); ctx.stroke();
        }
        ctx.fillStyle = '#3d94c8';
        const e = ts * 0.1;
        if (tileAt(x, y - 1) !== 'W') ctx.fillRect(px, py, ts, e);
        if (tileAt(x - 1, y) !== 'W') ctx.fillRect(px, py, e, ts);
        break;
      }
      case 'R': {
        rect('#6dba5c', px, py, ts, ts * 0.2);
        rect('#d9534f', px, py + ts * 0.15, ts, ts * 0.85);
        rect('#e8736f', px, py + ts * 0.15, ts, ts * 0.14);
        ctx.strokeStyle = '#b8403c'; ctx.lineWidth = Math.max(1, ts * 0.04);
        ctx.beginPath();
        ctx.moveTo(px, py + ts * 0.58); ctx.lineTo(px + ts, py + ts * 0.58);
        ctx.moveTo(px + ts * 0.5, py + ts * 0.3); ctx.lineTo(px + ts * 0.5, py + ts * 0.58);
        ctx.moveTo(px + ts * 0.25, py + ts * 0.58); ctx.lineTo(px + ts * 0.25, py + ts);
        ctx.moveTo(px + ts * 0.75, py + ts * 0.58); ctx.lineTo(px + ts * 0.75, py + ts);
        ctx.stroke();
        break;
      }
      case 'H': {
        rect('#f6e7c4', px, py, ts, ts);
        rect('#d9c59a', px, py + ts * 0.86, ts, ts * 0.14);
        rect('#7a5a3a', px + ts * 0.24, py + ts * 0.22, ts * 0.52, ts * 0.46);
        rect('#9fd8ff', px + ts * 0.29, py + ts * 0.27, ts * 0.42, ts * 0.36);
        rect('#7a5a3a', px + ts * 0.48, py + ts * 0.27, ts * 0.04, ts * 0.36);
        break;
      }
      case 'D': {
        rect('#f6e7c4', px, py, ts, ts);
        rect('#8a5a34', px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.8);
        rect('#a8703a', px + ts * 0.26, py + ts * 0.26, ts * 0.48, ts * 0.74);
        circ('#ffd24a', px + ts * 0.64, py + ts * 0.64, ts * 0.05);
        // かんばん
        rect('#fff4d6', px + ts * 0.1, py - ts * 0.02, ts * 0.8, ts * 0.24);
        ctx.fillStyle = '#b8403c'; ctx.font = 'bold ' + Math.round(ts * 0.2) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ふだ屋', px + ts / 2, py + ts * 0.11);
        break;
      }
      case 'G': {
        const ex = exitAt(x, y);
        const open = ex && exitOpen(ex);
        rect('#6dba5c', px, py, ts, ts);
        rect(open ? '#e9d3a0' : '#8a5a34', px + ts * 0.14, py + ts * 0.22, ts * 0.72, ts * 0.78);
        if (open) {
          rect('#f7ecc8', px + ts * 0.14, py + ts * 0.22, ts * 0.72, ts * 0.2);
        } else {
          ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = Math.max(1, ts * 0.05);
          ctx.beginPath();
          ctx.moveTo(px + ts * 0.5, py + ts * 0.22); ctx.lineTo(px + ts * 0.5, py + ts);
          ctx.moveTo(px + ts * 0.14, py + ts * 0.6); ctx.lineTo(px + ts * 0.86, py + ts * 0.6);
          ctx.stroke();
          circ('#ffd24a', px + ts * 0.42, py + ts * 0.72, ts * 0.045);
          circ('#ffd24a', px + ts * 0.58, py + ts * 0.72, ts * 0.045);
        }
        rect('#9aa0a8', px, py + ts * 0.12, ts * 0.18, ts * 0.88);
        rect('#9aa0a8', px + ts * 0.82, py + ts * 0.12, ts * 0.18, ts * 0.88);
        rect('#b6bcc3', px - ts * 0.04, py + ts * 0.04, ts * 1.08, ts * 0.2);
        circ('#ffd24a', px + ts / 2, py + ts * 0.14, ts * 0.07);
        break;
      }
      default: rect('#6dba5c', px, py, ts, ts);
    }
  }

  function drawBadge(text, color, px, py) {
    const bob = Math.sin(time / 300) * ts * 0.04;
    const bx = px + ts / 2, by = py - ts * 0.16 + bob, r = ts * 0.2;
    circ('rgba(0,0,0,.2)', bx, by + ts * 0.03, r);
    circ('#fff', bx, by, r);
    ctx.fillStyle = color; ctx.font = 'bold ' + Math.round(ts * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx, by + ts * 0.02);
  }

  function draw() {
    const cam = camera();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#4f9a4a';
    ctx.fillRect(0, 0, viewW, viewH);
    const x0 = Math.max(0, Math.floor(cam.x / ts)), x1 = Math.min(mapW - 1, Math.floor((cam.x + viewW) / ts));
    const y0 = Math.max(0, Math.floor(cam.y / ts)), y1 = Math.min(mapH - 1, Math.floor((cam.y + viewH) / ts));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(grid[y][x], x, y, x * ts - cam.x, y * ts - cam.y);

    // タップした場所の目印
    if (marker) {
      const k = marker.t / 600;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc((marker.x + 0.5) * ts - cam.x, (marker.y + 0.5) * ts - cam.y, ts * (0.15 + k * 0.3), 0, Math.PI * 2); ctx.stroke();
    }

    // 人物（上にいる人から順に描く）
    const list = field.npcs.map(function (n) { const p = npcPos(n); return { y: p.y, npc: n, p: p }; });
    list.push({ y: player.fy, player: true });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) {
      if (o.player) {
        Chars.draw(ctx, player.fx * ts - cam.x, player.fy * ts - cam.y - ts * 0.12, ts, Chars.PLAYER, player.dir, player.moving ? player.phase : null);
        return;
      }
      const n = o.npc, px = o.p.x * ts - cam.x, py = o.p.y * ts - cam.y - ts * 0.12;
      Chars.draw(ctx, px, py, ts, n.look, n._dir || o.p.dir || 'down', null);
      const wins = Save.winsOf(n.id);
      if (n.kind === 'shop') drawBadge('G', '#e09b00', px, py);
      else if (n.kind === 'talk') drawBadge('?', '#2f7fe0', px, py);
      else if (!wins) drawBadge('!', n.kind === 'boss' ? '#8e44ad' : '#e8503a', px, py);
      else drawBadge('★', '#e0a800', px, py);
    });
  }

  function loop(t) {
    const dt = Math.min(50, t - last || 16);
    last = t;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    M.refreshHud();
    resize();
    setTimeout(resize, 60);
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); }

  // テスト・デバッグ用：いまの状態をのぞく
  M.debug = function () { return { x: player.x, y: player.y, dir: player.dir, moving: player.moving || player.path.length > 0, ts: ts, cam: camera() }; };
})();
