/* ============================================================
 * 自動テスト（開発用・ゲーム本体には不要）
 *   実行： node tests/sim.js
 * コンピューター同士で何千回も対戦させて、
 *   ・ルールの計算がエラーなく最後まで動くか
 *   ・データ（デッキ枚数、カードIDなど）に間違いがないか
 *   ・各相手の強さ（勝率）がちょうどいいか
 * を確かめる。
 * ============================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');

// index.html に書いてある順番どおりにデータ系のファイルを読みこむ
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1])
  .filter(s => /js\/(core|battle|ai|save)\.js$|js\/fields\/[^/]+\.js$/.test(s) && !/-art\.js$/.test(s));
scripts.forEach(s => require(path.join(root, s)));
const HF = globalThis.HF;
const B = HF.Battle;

let failed = 0;
function check(cond, msg) { if (!cond) { failed++; console.error('  ✗ ' + msg); } }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 1. データのチェック ---------- */
console.log('■ データのチェック');
const allNpcIds = new Set();
check(HF.starter.deck.length === HF.DECK_SIZE, '最初のデッキが' + HF.DECK_SIZE + '枚ではない');
Object.values(HF.cards).forEach(c => {
  check(c.cost >= 1, c.id + ': コストは1以上にする');
  check([1, 2, 3].includes(c.rarity), c.id + ': rarity は 1〜3');
  check(c.type === 'monster' ? (c.atk >= 0 && c.hp >= 1) : !!c.effect, c.id + ': 数値か効果がない');
  check(HF.cardText(c).length > 0, c.id + ': 説明文が作れない');
});
Object.values(HF.packs).forEach(p => p.cards.forEach(id => check(!!HF.cards[id], p.id + ': 存在しないカード ' + id)));
HF.fieldList().forEach(f => {
  const w = f.map[0].length;
  f.map.forEach((row, y) => check(row.length === w, f.id + ': マップ' + y + '行目の長さがちがう'));
  f.npcs.forEach(n => {
    check(!allNpcIds.has(n.id), '人物IDが重複: ' + n.id);
    allNpcIds.add(n.id);
    check(n.id.startsWith(f.id + '_'), n.id + ': IDはフィールドIDで始める');
    check('.,='.includes(f.map[n.y][n.x]), n.id + ': 歩けない場所に立っている');
    if (n.deck) {
      const d = HF.expandDeck(n.deck);
      check(d.length === HF.DECK_SIZE, n.id + ': デッキが' + d.length + '枚');
      Object.entries(n.deck).forEach(([id, k]) => check(k <= HF.MAX_COPIES, n.id + ': ' + id + ' が' + k + '枚'));
    }
    (n.packs || []).forEach(id => check(!!HF.packs[id], n.id + ': 存在しないパック ' + id));
    (n.rewardCards || []).forEach(id => check(!!HF.cards[id], n.id + ': 存在しない賞品カード ' + id));
  });
});
console.log('  カード ' + Object.keys(HF.cards).length + '種類 / フィールド ' + HF.fieldList().length + 'つ');

/* ---------- 2. 自動対戦 ---------- */
function playGame(pDeck, npc, seed, pSkill) {
  const st = B.create({ pDeck, eDeck: HF.expandDeck(npc.deck), pLife: HF.PLAYER_LIFE, eLife: npc.life, rng: mulberry32(seed) });
  let side = 'p', guard = 0;
  while (!st.winner && guard++ < 200) {
    B.startTurn(st, side);
    let n = 0;
    while (!st.winner && n++ < 30) {
      const a = HF.AI.choose(st, side, side === 'p' ? pSkill : npc.skill);
      if (a.type === 'end') break;
      const ev = B.playCard(st, side, a.hand, a.lane);
      // 何も起きなかった＝AIとルールが食いちがっている
      if (!ev.length) { failed++; if (failed < 5) console.error('  ✗ AIが使えない手を選んだ'); break; }
    }
    for (let i = 0; i < B.LANES; i++) B.attackLane(st, side, i);
    for (const s of ['p', 'e']) {
      const S = st.sides[s];
      if (S.life < 0 || S.life > S.maxLife || S.energy < 0 || S.hand.length > B.HAND_MAX) {
        failed++; console.error('  ✗ おかしな数値', s, S.life, S.energy, S.hand.length); return st;
      }
    }
    side = B.other(side);
  }
  check(!!st.winner, 'バトルが終わらなかった (seed ' + seed + ')');
  return st;
}

// パックを何個か開けて、手に入ったカードでデッキをちょっと強くした想定のデッキ
function upgradedDeck(packs, seed) {
  const rng = mulberry32(seed);
  const owned = {};
  HF.starter.deck.forEach(id => owned[id] = (owned[id] || 0) + 1);
  const got = [];
  for (let i = 0; i < packs; i++) HF.rollPack(HF.packs.f1_pack, rng).forEach(id => got.push(id));
  const deck = HF.starter.deck.slice();
  // 弱いカードから順に、手に入れたカードと入れかえる（かんたんな自動デッキ作り）
  const weak = ['f1_koronezumi', 'f1_haneusa', 'f1_yakusou', 'f1_tsunohitsuji', 'f1_tanpopon'];
  const count = {};
  got.sort((a, b) => HF.cards[b].rarity - HF.cards[a].rarity).forEach(id => {
    count[id] = (count[id] || 0);
    if (count[id] >= HF.MAX_COPIES) return;
    for (const w of weak) {
      const i = deck.indexOf(w);
      if (i >= 0) { deck[i] = id; count[id]++; return; }
    }
  });
  return deck;
}

console.log('■ 自動対戦（プレイヤー役もコンピューター。勝率はめやす）');
const N = 1500;
const f1 = HF.fields.f1;
const duelists = f1.npcs.filter(n => n.deck);
let turnsTotal = 0, games = 0;
[0, 1, 3, 6].forEach(packs => {
  const line = [];
  duelists.forEach(npc => {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const deck = packs ? upgradedDeck(packs, 1000 + i) : HF.starter.deck;
      const st = playGame(deck, npc, i * 7 + 1, 0.85);
      if (st.winner === 'p') wins++;
      turnsTotal += st.turn; games++;
    }
    line.push(npc.name + ' ' + Math.round(wins / N * 100) + '%');
  });
  console.log('  パック' + packs + '個ぶん強化: ' + line.join(' / '));
});
console.log('  1試合の平均ターン数（両者合計）: ' + (turnsTotal / games).toFixed(1));

/* ---------- 3. セーブデータのチェック ---------- */
if (HF.Save) {
  console.log('■ セーブデータのチェック');
  const fresh = HF.Save.fresh();
  check(fresh.deck.length === HF.DECK_SIZE, '新規データのデッキ枚数');
  // 古い・こわれたデータを読みこんでも落ちないこと
  const old = HF.Save.normalize({ v: 1, money: 250, cards: { f1_koronezumi: 3, zzz_unknown: 2 }, deck: ['f1_koronezumi', 'zzz_unknown'], wins: { f1_moko: 1 } });
  check(old.money === 250, 'お金が引きつがれる');
  check(old.wins.f1_moko === 1, '勝利記録が引きつがれる');
  check(old.deck.length === HF.DECK_SIZE, 'こわれたデッキは20枚に直る (' + old.deck.length + ')');
  check(old.deck.every(id => HF.cards[id]), '知らないカードはデッキから外れる');
  check(old.cards.zzz_unknown === 2, '知らないカードの所持データは消さずに残す');
  check(HF.Save.normalize(null).deck.length === HF.DECK_SIZE, 'null でも新規データになる');
  check(HF.Save.normalize({ field: 'f99' }).field === 'f1', '知らないフィールドは最初のフィールドに戻す');
}

if (failed) { console.error('\n✗ 失敗 ' + failed + '件'); process.exit(1); }
console.log('\n✓ すべてOK');
