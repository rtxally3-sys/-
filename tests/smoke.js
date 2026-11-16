/* ============================================================
 * 通しプレイの自動テスト（開発用・ゲーム本体には不要）
 *   準備： このフォルダで  python3 -m http.server 8765  を動かしておく
 *   実行： node tests/smoke.js [スクリーンショットの保存先フォルダ]
 * ブラウザを自動操作して「はじめから → バトル → ショップ → デッキ →
 * 再読みこみ（セーブ確認）→ ボス撃破 → 門」までを実際にタップして確かめる。
 * Playwright という自動操作の道具が必要（Claude Code の環境には入っている）。
 * ============================================================ */
'use strict';
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const shotDir = process.argv[2] || null;
const W = Number(process.env.VW) || 390, H = Number(process.env.VH) || 664;

let failed = 0;
function check(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { failed++; console.error('  ✗ ' + msg); } }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  const shot = async name => { if (shotDir) await page.screenshot({ path: shotDir + '/' + name + '.png' }); };
  const wait = ms => page.waitForTimeout(ms);
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('hoshifuda_save')));
  const fast = () => page.evaluate(() => { const s = window.setTimeout; HF.UI.sleep = ms => new Promise(r => s(r, ms / 12)); });
  const dialogOpen = () => page.evaluate(() => HF.UI.dialogOpen());
  // 会話をタップで最後まで送る（選択肢が出たら止まる）
  async function skipDialog() {
    for (let i = 0; i < 30; i++) {
      await wait(160);
      const s = await page.evaluate(() => ({ open: HF.UI.dialogOpen(), choice: !!document.querySelector('.dlg-choices button') }));
      if (!s.open || s.choice) return;
      await page.tap('.dialog');
    }
  }
  async function tapTile(x, y) {
    const d = await page.evaluate(() => { const r = document.querySelector('#scr-map canvas').getBoundingClientRect(); return Object.assign({ left: r.left, top: r.top, h: r.height }, HF.Map.debug()); });
    const py = (y + 0.5) * d.ts - d.cam.y;
    if (py < 0 || py > d.h) throw new Error('マス(' + x + ',' + y + ')が画面の外');
    await page.touchscreen.tap(d.left + (x + 0.5) * d.ts - d.cam.x, d.top + py);
  }
  async function waitIdle() {
    for (let i = 0; i < 100; i++) { await wait(100); if (!(await page.evaluate(() => HF.Map.debug().moving))) { await wait(250); return; } }
  }
  // 人のところへ行って話す（画面外なら近くまで歩いてから）
  async function talkTo(x, y, via) {
    if (via) { await tapTile(via[0], via[1]); await waitIdle(); }
    await tapTile(x, y);
    for (let i = 0; i < 80; i++) { await wait(100); if (await dialogOpen()) return; }
    throw new Error('話しかけられなかった (' + x + ',' + y + ')');
  }
  // バトルを自動で進める。mode: 'win'（相手のライフを1にして勝つ）/ 'play'（ふつうに戦う）/ 'giveup'
  async function battle(mode) {
    await page.waitForSelector('#scr-battle.active');
    await fast();
    if (mode === 'win') await page.evaluate(() => { HF.BattleUI.debug().st.sides.e.life = 1; });
    for (let i = 0; i < 2000; i++) {
      const s = await page.evaluate(() => { const d = HF.BattleUI.debug(); return { busy: d.busy, result: !!document.querySelector('.b-result') }; });
      if (s.result) break;
      if (s.busy) { await wait(25); continue; }
      if (mode === 'giveup') { await page.tap('#b-giveup'); await wait(100); await page.tap('.modal-btns .btn:nth-child(2)'); continue; }
      const a = await page.evaluate(() => {
        const d = HF.BattleUI.debug();
        const a = HF.AI.choose(d.st, 'p', 1);
        if (a.type === 'end') return a;
        return { type: 'play', hand: a.hand, lane: a.lane, mode: HF.Battle.playInfo(d.st, 'p', a.hand).mode };
      });
      if (a.type === 'end') { await page.tap('#b-end'); continue; }
      await page.tap('.hand-card[data-hand="' + a.hand + '"]');
      if (a.mode === 'none') await page.tap('#b-use');
      else await page.tap('.slot[data-side="' + (a.mode === 'enemy' ? 'e' : 'p') + '"][data-lane="' + a.lane + '"]');
    }
    const win = await page.evaluate(() => document.querySelector('.b-result').classList.contains('win'));
    return win;
  }
  // 会話の「バトルする！」をおす（はじめての時に出るルール説明もとじる）
  async function accept() {
    await page.tap('.dlg-choices .btn.primary');
    await wait(250);
    if (await page.$('.modal')) { if (shotDir) await shot('05b-tutorial'); await page.tap('.modal-btns .btn'); }
  }
  async function closeResult() { await page.tap('.b-result .btn'); await skipDialog(); await skipDialog(); }

  /* ---------- 1. はじめから ---------- */
  console.log('■ はじめから');
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await wait(300);
  await shot('01-title');
  await page.tap('[data-act="new"]');
  await wait(300);
  await shot('02-intro');
  await skipDialog();
  let sv = await save();
  check(sv && sv.started === true && sv.money === 100 && sv.deck.length === 20, 'オープニング後にセーブされている');
  await shot('03-map');

  /* ---------- 2. 会話・ボスの条件 ---------- */
  console.log('■ 会話');
  await talkTo(3, 11);
  await shot('04-elder');
  await skipDialog();
  await talkTo(4, 1, [4, 4]);
  await shot('05-boss-locked');
  await skipDialog();
  check(!(await page.evaluate(() => document.querySelector('#scr-battle.active'))), 'ボスには まだ挑戦できない');

  /* ---------- 3. バトル（ふつうに戦う） ---------- */
  console.log('■ バトル');
  await talkTo(2, 8, [4, 7]);
  await skipDialog();
  await accept();
  await page.waitForSelector('#scr-battle.active');
  await wait(1200);
  await shot('06-battle-start');
  // 1ターン目に出せるカードがあれば、えらんだ状態を撮る（コスト1がない手札のこともある）
  if (await page.$('.hand-card.playable')) {
    await page.tap('.hand-card.playable');
    await wait(200);
    await shot('07-battle-select');
  }
  await page.evaluate(() => { HF.BattleUI.debug().st.sides.e.life = 4; }); // テストを短くするため相手のライフをへらす
  let win = await battle('play');
  await wait(300);
  await shot('08-battle-result');
  if (!win) { // 運わるく負けたら、もう一度（こんどは確実に勝つ）
    await closeResult();
    await talkTo(2, 8); await skipDialog(); await accept();
    win = await battle('win');
  }
  await closeResult();
  sv = await save();
  check(sv.wins.f1_moko === 1 && sv.money === 180, 'モコに勝って 80G もらえた (所持金 ' + sv.money + ')');

  /* ---------- 4. ショップ ---------- */
  console.log('■ ショップ');
  await talkTo(7, 10, [5, 10]);
  await skipDialog();
  await page.waitForSelector('#scr-shop.active');
  await shot('09-shop');
  await page.tap('[data-act="list"]');
  await wait(300);
  await shot('10-pack-list');
  await page.tap('.modal-btns .btn');
  await page.tap('[data-act="buy"]');
  await wait(1600);
  await shot('11-pack-open');
  sv = await save();
  const total = Object.values(sv.cards).reduce((a, b) => a + b, 0);
  check(sv.money === 80 && total === 25, 'パックを買って お金が100へり、カードが5枚ふえた');
  await page.tap('.modal-btns .btn.primary');
  check(await page.evaluate(() => document.querySelector('[data-act="buy"]').disabled), 'お金がたりないと買えない');

  /* ---------- 5. デッキ ---------- */
  console.log('■ デッキ');
  await page.tap('#scr-shop [data-act="deck"]');
  await page.waitForSelector('#scr-deck.active');
  await shot('12-deck');
  const newId = await page.evaluate(() => { const d = HF.Save.data; return Object.keys(d.cards).find(id => d.deck.indexOf(id) < 0); });
  await page.evaluate(() => document.querySelector('.deck-row[data-id="f1_koronezumi"]').scrollIntoView());
  await page.tap('.deck-row[data-id="f1_koronezumi"] .minus');
  check(await page.evaluate(() => document.querySelector('[data-act="ok"]').disabled), '19枚では けっていできない');
  await page.evaluate(id => document.querySelector('.deck-row[data-id="' + id + '"]').scrollIntoView(), newId);
  await page.tap('.deck-row[data-id="' + newId + '"] .plus');
  await shot('13-deck-edited');
  await page.tap('[data-act="ok"]');
  sv = await save();
  check(sv.deck.length === 20 && sv.deck.includes(newId) && sv.deck.filter(x => x === 'f1_koronezumi').length === 2, 'デッキの入れかえが保存された');

  /* ---------- 6. 再読みこみしてもセーブが残る ---------- */
  console.log('■ セーブ');
  const before = JSON.stringify(await save());
  await page.reload();
  await wait(300);
  await shot('14-title-continue');
  check(!!(await page.$('[data-act="continue"]')), '「つづきから」が出る');
  await page.tap('[data-act="continue"]');
  await wait(300);
  check(JSON.stringify(await save()) === before, '再読みこみしてもデータが変わらない');
  const pos = await page.evaluate(() => HF.Map.debug());
  check(pos.x === 7 && pos.y === 11 || (pos.x === 6 && pos.y === 10) || (pos.x === 8 && pos.y === 10), 'ふだ屋の前から再開 (' + pos.x + ',' + pos.y + ')');

  /* ---------- 7. 負けてもへらない ---------- */
  console.log('■ 負け・こうさん');
  await talkTo(6, 5, [5, 7]);
  await skipDialog();
  await accept();
  win = await battle('giveup');
  await wait(200);
  await shot('15-lose');
  await closeResult();
  sv = await save();
  check(!win && sv.money === 80 && !sv.wins.f1_kai, 'こうさん＝負け。お金はへらない');

  /* ---------- 8. のこりの2人 → ボス ---------- */
  console.log('■ ボスまで');
  await talkTo(6, 5); await skipDialog(); await accept();
  check(await battle('win'), 'カイに勝つ'); await closeResult();
  await talkTo(2, 5, [4, 6]); await skipDialog(); await accept();
  check(await battle('win'), 'リリに勝つ'); await closeResult();
  check((await page.evaluate(() => document.querySelector('.hud-goal').textContent)).includes('ハルカゼ'), '目標が「ボスにいどもう」に変わる');
  await talkTo(4, 1, [4, 3]); await skipDialog();
  await shot('16-boss-talk');
  await accept();
  await page.waitForSelector('#scr-battle.active');
  await wait(1200);
  await shot('17-boss-battle');
  check(await battle('win'), 'ボスに勝つ');
  await wait(300);
  await shot('18-boss-result');
  await closeResult();
  sv = await save();
  check(sv.wins.f1_boss === 1 && sv.cards.f1_midoriojika >= 1 && sv.money === 80 + 100 + 100 + 300, 'ボスのごほうび（300G＋カード）');
  await wait(300);
  await shot('19-gate-open');

  /* ---------- 9. 門 ---------- */
  console.log('■ 門');
  await tapTile(4, 0);
  for (let i = 0; i < 50; i++) { await wait(100); if (await dialogOpen()) break; }
  await shot('20-gate');
  await skipDialog();
  const p2 = await page.evaluate(() => HF.Map.debug());
  check(p2.x === 4 && p2.y === 1, '次のフィールドは準備中なので門の手前にもどる');
  check((await save()).field === 'f1', 'フィールドは f1 のまま');

  /* ---------- 10. そのほかの画面 ---------- */
  console.log('■ そのほかの画面');
  await page.tap('[data-act="help"]'); await wait(200); await shot('21-help');
  await page.tap('#scr-help [data-act="back"]');
  await page.tap('[data-act="settings"]'); await wait(200); await shot('22-settings');
  await page.tap('[data-act="export"]'); await wait(200);
  const code = await page.evaluate(() => document.querySelector('textarea.code').value);
  check(/^HOSHI1:/.test(code), 'バックアップの文字が出る');
  await page.tap('.modal-btns .btn:nth-child(2)');
  const ok = await page.evaluate(c => { const m = HF.Save.data.money; HF.Save.data.money = 1; const r = HF.Save.importCode(c); return r && HF.Save.data.money === m; }, code);
  check(ok, 'バックアップから元にもどせる');

  check(errs.length === 0, 'エラーが出ていない' + (errs.length ? '\n' + errs.join('\n') : ''));
  await browser.close();
  if (failed) { console.error('\n✗ 失敗 ' + failed + '件'); process.exit(1); }
  console.log('\n✓ すべてOK');
})().catch(e => { console.error(e); process.exit(1); });
