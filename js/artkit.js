/* ============================================================
 * artkit.js — カードの絵をコードで描くための小道具
 * 絵は SVG（図形を文字で書く形式）。100×64 の枠の中に描く。
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF;
  const K = HF.artKit = {};

  // 図形を短く書くための関数
  K.c = function (x, y, r, fill, extra) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" ' + (extra || '') + '/>'; };
  K.e = function (x, y, rx, ry, fill, extra) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" ' + (extra || '') + '/>'; };
  K.p = function (d, fill, extra) { return '<path d="' + d + '" fill="' + (fill || 'none') + '" ' + (extra || '') + '/>'; };
  K.poly = function (pts, fill, extra) { return '<polygon points="' + pts + '" fill="' + fill + '" ' + (extra || '') + '/>'; };
  K.line = function (d, color, w) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>'; };
  // 目（黒目＋ハイライト）
  K.eye = function (x, y, r) {
    r = r || 3;
    return K.c(x, y, r, '#2a2233') + K.c(x + r * 0.3, y - r * 0.35, r * 0.38, '#fff');
  };
  K.eyes = function (x1, x2, y, r) { return K.eye(x1, y, r) + K.eye(x2, y, r); };
  // きらきら
  K.spark = function (x, y, s, color) {
    return K.p('M' + x + ' ' + (y - s) + ' L' + (x + s * 0.3) + ' ' + (y - s * 0.3) + ' L' + (x + s) + ' ' + y + ' L' + (x + s * 0.3) + ' ' + (y + s * 0.3) +
      ' L' + x + ' ' + (y + s) + ' L' + (x - s * 0.3) + ' ' + (y + s * 0.3) + ' L' + (x - s) + ' ' + y + ' L' + (x - s * 0.3) + ' ' + (y - s * 0.3) + ' Z', color || '#fff');
  };

  // 背景
  const BG = {
    meadow: '<rect width="100" height="64" fill="#bfe8ff"/>' + K.e(22, 14, 12, 5, '#fff', 'opacity=".8"') + K.e(80, 9, 9, 4, '#fff', 'opacity=".7"') +
      K.e(20, 62, 46, 20, '#a5dc86') + K.e(78, 64, 48, 18, '#8fd070') + K.e(50, 70, 80, 14, '#7cc35f'),
    sky: '<rect width="100" height="64" fill="#9fd3ff"/><rect y="40" width="100" height="24" fill="#c9e9ff"/>' +
      K.e(18, 50, 16, 6, '#fff', 'opacity=".85"') + K.e(84, 44, 14, 5, '#fff', 'opacity=".8"') + K.e(70, 12, 10, 4, '#fff', 'opacity=".6"'),
    storm: '<rect width="100" height="64" fill="#6f9fd8"/><rect y="42" width="100" height="22" fill="#8fb8e6"/>' +
      K.line('M4 14 Q30 4 52 12', '#cfe4ff', 1.6) + K.line('M50 56 Q74 62 96 50', '#cfe4ff', 1.6) + K.e(16, 54, 15, 5, '#dbe9fb', 'opacity=".8"'),
    magic: '<rect width="100" height="64" fill="#5a4a9c"/>' + K.c(50, 32, 30, '#7566c2') + K.c(50, 32, 20, '#8f81d8') +
      K.spark(14, 12, 4, '#ffe9a8') + K.spark(88, 50, 3.5, '#ffe9a8') + K.spark(84, 12, 2.5, '#fff') + K.spark(12, 52, 2.5, '#fff')
  };

  K.scene = function (bg, inner) {
    return '<svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + (BG[bg] || BG.meadow) + inner + '</svg>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
