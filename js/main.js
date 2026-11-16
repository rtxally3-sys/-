/* ============================================================
 * main.js — ゲーム全体の進行役
 * 起動、会話→バトル→ごほうび、フィールドの移動など。
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF, UI = HF.UI, Save = HF.Save, Map = HF.Map;
  const Game = HF.Game = {};

  /* ---------- 起動 ---------- */
  // 画面の高さをiPhoneの「いま見えている範囲」にぴったり合わせる
  function fitHeight() {
    document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px');
  }

  Game.boot = function () {
    fitHeight();
    window.addEventListener('resize', fitHeight);
    window.addEventListener('orientationchange', function () { setTimeout(fitHeight, 300); });
    Save.load();
    HF.Screens.initTitle();
    Map.init();
    HF.BattleUI.init();
    HF.Screens.initDeck();
    HF.Screens.initShop();
    HF.Screens.initHelp();
    HF.Screens.initSettings();
    UI.show('title');
    // 画面を閉じる・切りかえるときにも念のため保存
    document.addEventListener('visibilitychange', function () { if (document.hidden) Save.save(); });
    window.addEventListener('pagehide', function () { Save.save(); });
    // ピンチやダブルタップでの拡大を止める（操作ミス防止）
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    // リストの中以外では、画面全体が指でずれないようにする
    document.addEventListener('touchmove', function (e) {
      if (!e.target.closest('.scroll, .modal-body, textarea')) e.preventDefault();
    }, { passive: false });
  };

  Game.newGame = async function () {
    Save.reset();
    const f = HF.fieldList()[0];
    Map.enter(f.id, f.start);
    UI.show('map');
    Map.lock(true);
    UI.setDialogTop(true);
    await UI.say(null, f.intro);
    Map.lock(false);
    Save.data.started = true;
    Save.save();
  };

  Game.continueGame = function () {
    Map.enter(Save.data.field, Save.data.pos);
    UI.show('map');
  };

  /* ---------- いまの目標（画面上部に出す文） ---------- */
  Game.goalText = function (field) {
    const boss = field.npcs.filter(function (n) { return n.kind === 'boss'; })[0];
    if (!boss) return '';
    if (Save.winsOf(boss.id)) {
      const ex = (field.exits || []).filter(function (e) { return e.requires === boss.id; })[0];
      return ex && HF.fields[ex.to] ? 'もくひょう：門をくぐって 次のフィールドへ' : 'このフィールドはクリア！ 次のフィールドは じゅんび中';
    }
    const req = boss.requires || [];
    const done = req.filter(function (id) { return Save.winsOf(id) > 0; }).length;
    if (done < req.length) return 'もくひょう：' + field.name + 'の' + req.length + '人に勝とう（' + done + '/' + req.length + '）';
    return 'もくひょう：' + boss.name + 'に いどもう！';
  };

  /* ---------- 人に話しかける ---------- */
  let talking = false;
  Game.talk = async function (npc) {
    if (talking) return;
    talking = true;
    Map.lock(true);
    Map.faceNpcToPlayer(npc);
    UI.setDialogTop(Map.playerIsLow());
    try {
      if (npc.kind === 'talk') {
        await UI.say(npc, npc.lines);
      } else if (npc.kind === 'shop') {
        await UI.say(npc, npc.lines);
        UI.show('shop', npc);
      } else {
        await duel(npc);
      }
    } finally {
      talking = false;
      Map.lock(false);
      Map.refreshHud();
    }
  };

  async function duel(npc) {
    const wins = Save.winsOf(npc.id);
    const field = Map.field();
    const req = npc.requires || [];
    const left = req.filter(function (id) { return !Save.winsOf(id); }).length;
    if (left > 0) {
      await UI.say(npc, npc.talk.locked.concat(['（あと ' + left + '人に 勝つ必要がある）']));
      return;
    }
    await UI.say(npc, wins ? npc.talk.again : npc.talk.before);
    const c = await UI.choose(npc, 'バトルする？' + (wins ? '' : '　（負けても お金やカードは へらないよ）'), ['バトルする！', 'やめておく']);
    if (c !== 0) return;

    // はじめてのバトルの前に、ルールを短く説明する
    if (!Save.data.flags.tutorialBattle) {
      await UI.modal('<h3>バトルのきほん</h3><ol class="tut">' +
        '<li>手札のカードをタップ → <b>光ったレーン</b>をタップで、モンスターを出せる。</li>' +
        '<li>カード左上の数字が<b>コスト</b>。エネルギー' + UI.icon('bolt') + 'のぶんだけ出せる（毎ターン回復して、少しずつふえる）。</li>' +
        '<li><b>「こうげき！」</b>ボタンで、自分のモンスター全員が<b>正面を攻撃</b>してターン終了。</li>' +
        '<li>正面に敵がいなければ、<b>相手のライフ</b>を直接へらせる。0にしたら勝ち！</li></ol>' +
        '<p class="dim small">くわしくは マップ画面の「あそびかた」で いつでも見られるよ。</p>', [{ label: 'わかった！', cls: 'primary' }]);
      Save.data.flags.tutorialBattle = true;
      Save.save();
    }

    const wasAllDone = bossReady(field);
    let first = false;
    const res = await HF.BattleUI.start(npc, {
      onResult: function (win) {
        const d = Save.data;
        d.stats.battles = (d.stats.battles || 0) + 1;
        if (!win) {
          Save.save();
          return '<p>お金やカードは へらないよ。</p><p class="dim">デッキを見なおしたり、ふだ屋でパックを買ったりして、もういちど挑戦しよう！</p>';
        }
        first = !d.wins[npc.id];
        d.wins[npc.id] = (d.wins[npc.id] || 0) + 1;
        const money = first ? npc.reward : npc.rematch;
        d.money += money;
        let html = '<p class="res-money">' + UI.icon('coin') + ' +' + money + ' G</p>';
        if (first) html += '<p class="dim">はじめて勝ったボーナスつき！</p>';
        if (first && npc.rewardCards) {
          npc.rewardCards.forEach(function (id) { Save.addCard(id, 1); });
          html += '<p>ごほうびカードを手に入れた！</p><div class="res-cards" style="--w:96px">' + npc.rewardCards.map(function (id) { return UI.cardHTML(id); }).join('') + '</div>';
        }
        Save.save();
        return html;
      }
    });

    UI.show('map');
    Map.refreshHud();
    UI.setDialogTop(Map.playerIsLow());
    await UI.say(npc, res.win ? npc.talk.win : npc.talk.lose);
    if (res.win && first) {
      if (npc.kind === 'boss') {
        const ex = (field.exits || []).filter(function (e) { return e.requires === npc.id; })[0];
        if (ex) await UI.say(null, ['門が ひらいた！', HF.fields[ex.to] ? '門をくぐると 次のフィールドへ進める。' : '（この先のフィールドは いま じゅんび中。つづきを おたのしみに！）']);
      } else if (!wasAllDone && bossReady(field)) {
        const boss = field.npcs.filter(function (n) { return n.kind === 'boss'; })[0];
        await UI.say(null, [field.name + 'の全員に勝った！', boss.name + 'に 挑戦できるようになった。']);
      }
    }
  }

  function bossReady(field) {
    const boss = field.npcs.filter(function (n) { return n.kind === 'boss'; })[0];
    if (!boss) return false;
    return (boss.requires || []).every(function (id) { return Save.winsOf(id) > 0; });
  }

  /* ---------- 門（フィールドの出入口） ---------- */
  Game.closedExit = async function (ex) {
    UI.setDialogTop(Map.playerIsLow());
    Map.lock(true);
    await UI.say(null, ex.closedText || ['この先には まだ進めない。']);
    Map.lock(false);
  };

  Game.useExit = async function (ex) {
    const next = HF.fields[ex.to];
    if (next) {
      Map.enter(next.id, ex.spawn || next.start);
      Map.refreshHud();
      Map.lock(true);
      await UI.say(null, [next.name + ' に ついた！']);
      Map.lock(false);
      return;
    }
    Map.lock(true);
    UI.setDialogTop(false);
    await UI.say(null, ['門の先には 新しいフィールドが 広がっている……', '（つづきは いま じゅんび中。おたのしみに！）']);
    Map.stepBack();
    Map.lock(false);
  };

  window.addEventListener('DOMContentLoaded', Game.boot);
})();
