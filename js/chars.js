/* ============================================================
 * chars.js — 人物の絵（コードで描くちびキャラ）
 * マップ上の姿と、会話・バトルで出る顔アイコンを同じ関数で描く。
 *
 * look（見た目の設定）:
 *   skin 肌 / hair かみ / shirt 服
 *   cap ぼうし / hat むぎわら帽子 / crown かんむり / bun おだんご
 *   beard ひげ / scarf マフラー / apron エプロン / cape マント / flower 花かざり
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF;
  const Chars = HF.Chars = {};

  Chars.PLAYER = { skin: '#f7d3ae', hair: '#5b3a1e', shirt: '#e8503a', cap: '#2f7fe0' };

  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
  }

  // (x, y) を左上とする s×s のマスの中に人物を描く。phase は歩きアニメ（0〜1）、止まっているときは null
  Chars.draw = function (ctx, x, y, s, L, dir, phase) {
    const cx = x + s / 2;
    const walking = phase != null;
    const sw = walking ? Math.sin(phase * Math.PI * 2) : 0;
    const bob = walking ? -Math.abs(sw) * s * 0.03 : 0;
    const side = dir === 'left' ? -1 : (dir === 'right' ? 1 : 0);

    // かげ
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ell(ctx, cx, y + s * 0.93, s * 0.27, s * 0.07);

    // マント（正面のときは体のうしろ）
    if (L.cape && dir !== 'up') {
      ctx.fillStyle = L.cape;
      rr(ctx, cx - s * 0.27, y + s * 0.5 + bob, s * 0.54, s * 0.4, s * 0.08);
    }

    // 足
    ctx.fillStyle = '#4a3a2c';
    rr(ctx, cx - s * 0.17, y + s * 0.82 - Math.max(0, sw) * s * 0.06, s * 0.14, s * 0.1, s * 0.04);
    rr(ctx, cx + s * 0.03, y + s * 0.82 - Math.max(0, -sw) * s * 0.06, s * 0.14, s * 0.1, s * 0.04);

    // 体
    ctx.fillStyle = L.shirt;
    rr(ctx, cx - s * 0.22, y + s * 0.52 + bob, s * 0.44, s * 0.34, s * 0.1);
    if (L.apron && dir !== 'up') {
      ctx.fillStyle = L.apron;
      rr(ctx, cx - s * 0.13 + side * s * 0.05, y + s * 0.6 + bob, s * 0.26, s * 0.25, s * 0.05);
    }
    if (L.cape && dir === 'up') {
      ctx.fillStyle = L.cape;
      rr(ctx, cx - s * 0.25, y + s * 0.52 + bob, s * 0.5, s * 0.38, s * 0.08);
    }
    if (L.scarf) {
      ctx.fillStyle = L.scarf;
      rr(ctx, cx - s * 0.2, y + s * 0.52 + bob, s * 0.4, s * 0.09, s * 0.04);
      if (dir !== 'up') rr(ctx, cx + (side || 1) * -s * 0.16 - s * 0.04, y + s * 0.56 + bob, s * 0.08, s * 0.16, s * 0.03);
    }

    // 頭
    const hy = y + s * 0.36 + bob, hr = s * 0.25;
    ctx.fillStyle = L.skin;
    ell(ctx, cx, hy, hr, hr);

    // かみ
    ctx.fillStyle = L.hair;
    if (dir === 'up') {
      ell(ctx, cx, hy - hr * 0.04, hr * 1.05, hr * 1.02);
    } else {
      ctx.beginPath();
      ctx.arc(cx, hy, hr * 1.05, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(cx + hr * 0.6, hy - hr * 0.55, cx, hy - hr * 0.35);
      ctx.quadraticCurveTo(cx - hr * 0.6, hy - hr * 0.55, cx - hr * 1.05, hy);
      ctx.fill();
      if (side) { // 横向き：後ろがみ
        ctx.beginPath();
        ctx.ellipse(cx - side * hr * 0.62, hy + hr * 0.05, hr * 0.5, hr * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (L.bun) ell(ctx, cx, hy - hr * 1.15, hr * 0.38, hr * 0.34);

    // 顔
    if (dir !== 'up') {
      ctx.fillStyle = '#2a2233';
      const ey = hy + hr * 0.18, er = Math.max(1, hr * 0.13);
      if (side) {
        ell(ctx, cx + side * hr * 0.5, ey, er, er * 1.25);
      } else {
        ell(ctx, cx - hr * 0.42, ey, er, er * 1.25);
        ell(ctx, cx + hr * 0.42, ey, er, er * 1.25);
      }
      if (L.beard) {
        ctx.fillStyle = '#f2f2f2';
        ell(ctx, cx + side * hr * 0.3, hy + hr * 0.78, hr * (side ? 0.5 : 0.7), hr * 0.42);
      }
      if (!side) {
        ctx.fillStyle = 'rgba(255,120,120,.35)';
        ell(ctx, cx - hr * 0.68, hy + hr * 0.48, hr * 0.17, hr * 0.12);
        ell(ctx, cx + hr * 0.68, hy + hr * 0.48, hr * 0.17, hr * 0.12);
      }
    }

    // かぶりもの
    if (L.cap) {
      ctx.fillStyle = L.cap;
      ctx.beginPath(); ctx.arc(cx, hy - hr * 0.2, hr * 1.02, Math.PI, Math.PI * 2); ctx.fill();
      if (dir === 'down') rr(ctx, cx - hr * 0.8, hy - hr * 0.32, hr * 1.6, hr * 0.26, hr * 0.12);
      else if (side) rr(ctx, cx + (side > 0 ? 0 : -hr * 1.35), hy - hr * 0.32, hr * 1.35, hr * 0.24, hr * 0.1);
    }
    if (L.hat) {
      ctx.fillStyle = L.hat;
      ell(ctx, cx, hy - hr * 0.42, hr * 1.5, hr * 0.36);
      ctx.beginPath(); ctx.arc(cx, hy - hr * 0.5, hr * 0.82, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      rr(ctx, cx - hr * 0.82, hy - hr * 0.66, hr * 1.64, hr * 0.16, hr * 0.05);
    }
    if (L.crown) {
      ctx.fillStyle = L.crown;
      const t = hy - hr * 0.78, w = hr * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, t); ctx.lineTo(cx - w / 2, t - hr * 0.6); ctx.lineTo(cx - w / 4, t - hr * 0.28);
      ctx.lineTo(cx, t - hr * 0.72); ctx.lineTo(cx + w / 4, t - hr * 0.28); ctx.lineTo(cx + w / 2, t - hr * 0.6);
      ctx.lineTo(cx + w / 2, t); ctx.closePath(); ctx.fill();
    }
    if (L.flower && dir !== 'up') {
      const fx = cx + (side ? -side : 1) * hr * 0.78, fy = hy - hr * 0.62, fr = hr * 0.2;
      ctx.fillStyle = L.flower;
      for (let i = 0; i < 5; i++) ell(ctx, fx + Math.cos(i * 1.257) * fr, fy + Math.sin(i * 1.257) * fr, fr * 0.75, fr * 0.75);
      ctx.fillStyle = '#ffe27a';
      ell(ctx, fx, fy, fr * 0.6, fr * 0.6);
    }
  };

  // 顔アイコン（画像のURL）を作る。同じ見た目は使い回す
  const cache = {};
  Chars.portraitURL = function (look) {
    const key = JSON.stringify(look);
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#cdeccc';
    ctx.beginPath(); ctx.arc(64, 70, 58, 0, Math.PI * 2); ctx.fill();
    Chars.draw(ctx, -36, -14, 200, look, 'down', null);
    cache[key] = cv.toDataURL('image/png');
    return cache[key];
  };
})();
