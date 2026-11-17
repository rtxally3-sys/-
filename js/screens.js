/* ============================================================
 * screens.js — タイトル・デッキ・ショップ・あそびかた・せってい の各画面
 * ============================================================ */
(function () {
  'use strict';
  const HF = window.HF, UI = HF.UI, Save = HF.Save;
  const S = HF.Screens = {};

  function sortedIds(ids) {
    return ids.slice().sort(function (a, b) {
      const A = HF.cards[a], B = HF.cards[b];
      return A.cost - B.cost || (A.type === B.type ? 0 : (A.type === 'monster' ? -1 : 1)) || a.localeCompare(b);
    });
  }
  function ownedIds() {
    return sortedIds(Object.keys(Save.data.cards).filter(function (id) { return HF.cards[id] && Save.data.cards[id] > 0; }));
  }
  function stars(n) { let s = ''; for (let i = 0; i < n; i++) s += '★'; return s; }

  /* ==================== タイトル ==================== */
  S.initTitle = function () {
    const root = UI.addScreen('title', { onShow: render });
    function render() {
      const has = Save.exists() && Save.data.started;
      const deco = ['f1_taifuwashi', 'f1_futabanosei', 'f1_noharaokami'].map(function (id, i) {
        return '<div class="title-card tc' + i + '" style="--w:92px">' + UI.cardHTML(id) + '</div>';
      }).join('');
      root.innerHTML =
        '<div class="title-sky"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="title-logo"><div class="title-star">' + UI.icon('star') + '</div><h1>ホシフダ物語</h1><p>カードバトルRPG</p></div>' +
        '<div class="title-cards">' + deco + '</div>' +
        '<div class="title-btns">' +
        (has ? '<button class="btn primary big" data-act="continue">つづきから</button>' : '') +
        '<button class="btn ' + (has ? '' : 'primary') + ' big" data-act="new">はじめから</button>' +
        '</div><div class="title-ver">ver ' + HF.VERSION + '　進み具合は自動でこのiPhoneに保存されます</div>';
    }
    root.addEventListener('click', async function (ev) {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'continue') HF.Game.continueGame();
      if (b.dataset.act === 'new') {
        if (Save.exists() && Save.data.started) {
          const r = await UI.modal('<h3>はじめから あそぶ？</h3><p>いまのセーブデータ（カード・お金・進み具合）は<b>すべて消えます</b>。</p>',
            [{ label: 'やめる', cls: 'primary' }, { label: '消してはじめる', cls: 'danger' }]);
          if (r !== 1) return;
        }
        HF.Game.newGame();
      }
    });
  };

  /* ==================== デッキ ==================== */
  S.initDeck = function () {
    let draft = {};
    const root = UI.addScreen('deck', {
      onShow: function () {
        draft = {};
        Save.data.deck.forEach(function (id) { draft[id] = (draft[id] || 0) + 1; });
        root.innerHTML =
          '<header class="bar"><h2>デッキをくむ</h2><div class="deck-count"></div></header>' +
          '<p class="lead">デッキは<b>ちょうど' + HF.DECK_SIZE + '枚</b>。同じカードは' + HF.MAX_COPIES + '枚まで。絵をタップでくわしく見られるよ。</p>' +
          '<div class="scroll deck-list"></div>' +
          '<footer class="foot"><button class="btn" data-act="cancel">やめる</button><button class="btn primary" data-act="ok">これでけってい</button></footer>';
        renderList();
        renderCount();
      }
    });
    function total() { return Object.keys(draft).reduce(function (s, id) { return s + draft[id]; }, 0); }
    function renderCount() {
      const n = total();
      const el = UI.$('.deck-count', root);
      el.innerHTML = '<b>' + n + '</b> / ' + HF.DECK_SIZE + '枚';
      el.classList.toggle('bad', n !== HF.DECK_SIZE);
      const ok = UI.$('[data-act="ok"]', root);
      ok.disabled = n !== HF.DECK_SIZE;
      ok.textContent = n === HF.DECK_SIZE ? 'これでけってい' : (n < HF.DECK_SIZE ? 'あと' + (HF.DECK_SIZE - n) + '枚 入れよう' : (n - HF.DECK_SIZE) + '枚 多いよ');
    }
    function rowHTML(id) {
      const c = HF.cards[id], own = Save.data.cards[id], inDeck = draft[id] || 0;
      const max = Math.min(own, HF.MAX_COPIES);
      return '<div class="deck-row' + (inDeck ? ' in' : '') + '" data-id="' + id + '">' +
        '<div class="deck-thumb" style="--w:60px">' + UI.cardHTML(id) + '</div>' +
        '<div class="deck-info"><div class="deck-name">' + UI.esc(c.name) + ' <span class="rar r' + c.rarity + '">' + stars(c.rarity) + '</span></div>' +
        '<div class="deck-text">' + UI.esc(HF.cardText(c)) + '</div>' +
        '<div class="deck-own">もっている ' + own + '枚</div></div>' +
        '<div class="deck-ctl"><button class="round minus" ' + (inDeck <= 0 ? 'disabled' : '') + '>−</button>' +
        '<div class="deck-n"><b>' + inDeck + '</b><small>/' + max + '</small></div>' +
        '<button class="round plus" ' + (inDeck >= max ? 'disabled' : '') + '>＋</button></div></div>';
    }
    function renderList() {
      UI.$('.deck-list', root).innerHTML = ownedIds().map(rowHTML).join('');
    }
    root.addEventListener('click', function (ev) {
      const t = ev.target;
      const act = t.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'ok' && total() === HF.DECK_SIZE) {
          Save.data.deck = sortedIds(HF.expandDeck(draft));
          Save.save();
          UI.toast('デッキを保存したよ');
        }
        UI.show('map');
        return;
      }
      const row = t.closest('.deck-row');
      if (!row) return;
      const id = row.dataset.id;
      const max = Math.min(Save.data.cards[id], HF.MAX_COPIES);
      if (t.closest('.plus')) draft[id] = Math.min(max, (draft[id] || 0) + 1);
      else if (t.closest('.minus')) { draft[id] = Math.max(0, (draft[id] || 0) - 1); if (!draft[id]) delete draft[id]; }
      else if (t.closest('.deck-thumb')) { UI.cardDetail(id); return; }
      else return;
      row.outerHTML = rowHTML(id);
      renderCount();
    });
  };

  /* ==================== ショップ ==================== */
  S.initShop = function () {
    let keeper = null;
    const root = UI.addScreen('shop', {
      onShow: function (npc) { if (npc) keeper = npc; render(); }
    });
    function collected(pack) { return pack.cards.filter(function (id) { return Save.data.cards[id] > 0; }).length; }
    function render() {
      const packs = keeper.packs.map(function (pid) {
        const p = HF.packs[pid];
        const can = Save.data.money >= p.price;
        return '<div class="pack-item" data-pack="' + pid + '">' +
          '<div class="pack-art" style="--pc:' + p.color + '">' + UI.icon('star') + '<span>' + UI.esc(p.name) + '</span></div>' +
          '<div class="pack-info"><div class="pack-name">' + UI.esc(p.name) + '</div>' +
          '<div class="pack-desc">' + UI.esc(p.desc) + '</div>' +
          '<div class="pack-col">あつめたカード ' + collected(p) + ' / ' + p.cards.length + ' 種類</div>' +
          '<div class="pack-btns"><button class="btn small" data-act="list">中身を見る</button>' +
          '<button class="btn primary small" data-act="buy" ' + (can ? '' : 'disabled') + '>' + (can ? '買う ' : 'お金がたりない ') + p.price + ' G</button></div></div></div>';
      }).join('');
      root.innerHTML =
        '<header class="bar"><h2>ふだ屋</h2><div class="money">' + UI.icon('coin') + '<b>' + Save.data.money + ' G</b></div></header>' +
        '<div class="shop-keeper"><img alt="" src="' + HF.Chars.portraitURL(keeper.look) + '"><div class="bubble">パックを開けると カードが ランダムで出るよ。バトルに勝って お金をためてね！</div></div>' +
        '<div class="scroll">' + packs + '</div>' +
        '<footer class="foot"><button class="btn" data-act="deck">デッキをくむ</button><button class="btn primary" data-act="back">もどる</button></footer>';
    }
    function showList(p) {
      const html = '<h3>' + UI.esc(p.name) + ' のカード</h3><div class="pack-list">' + sortedIds(p.cards).map(function (id) {
        const c = HF.cards[id], own = Save.data.cards[id] || 0;
        return '<div class="pl-row" data-id="' + id + '"><div class="pl-thumb" style="--w:46px">' + UI.cardHTML(id) + '</div>' +
          '<div><b>' + UI.esc(c.name) + '</b> <span class="rar r' + c.rarity + '">' + stars(c.rarity) + '</span><br><small>' + UI.esc(HF.cardText(c)) + '</small><br><small class="dim">' + (own ? 'もっている ' + own + '枚' : 'まだ もっていない') + '</small></div></div>';
      }).join('') + '</div><p class="dim small">★が多いほど めずらしい（出にくい）カード。</p>';
      UI.modal(html, [{ label: 'とじる' }], { cls: 'tall' });
    }
    async function buy(p) {
      if (Save.data.money < p.price) return;
      const before = Object.assign({}, Save.data.cards);
      Save.data.money -= p.price;
      const got = HF.rollPack(p);
      got.forEach(function (id) { Save.addCard(id, 1); });
      Save.data.stats.packs = (Save.data.stats.packs || 0) + 1;
      Save.save();
      render();
      const seen = {};
      const cards = got.map(function (id, i) {
        const isNew = !before[id] && !seen[id];
        seen[id] = true;
        return '<div class="open-card" style="--w:84px; animation-delay:' + (i * 0.22) + 's">' + UI.cardHTML(id) + (isNew ? '<span class="new">NEW</span>' : '') + '</div>';
      }).join('');
      const again = Save.data.money >= p.price;
      const r = await UI.modal('<h3>' + UI.esc(p.name) + ' を開けた！</h3><div class="open-cards">' + cards + '</div><p class="dim small">カードをタップすると くわしく見られるよ。手に入れたカードは「デッキをくむ」で入れよう。</p>',
        again ? [{ label: 'もう1パック買う（' + p.price + ' G）' }, { label: 'OK', cls: 'primary' }] : [{ label: 'OK', cls: 'primary' }],
        {
          cls: 'wide',
          onOpen: function (el) {
            el.addEventListener('click', function (ev) {
              const c = ev.target.closest('.open-card .card');
              if (c) UI.cardDetail(c.dataset.card);
            });
          }
        });
      if (again && r === 0) buy(p);
    }
    root.addEventListener('click', function (ev) {
      const act = ev.target.closest('[data-act]');
      if (!act) return;
      const item = ev.target.closest('.pack-item');
      const p = item ? HF.packs[item.dataset.pack] : null;
      if (act.dataset.act === 'back') UI.show('map');
      else if (act.dataset.act === 'deck') UI.show('deck');
      else if (act.dataset.act === 'list' && p) showList(p);
      else if (act.dataset.act === 'buy' && p) buy(p);
    });
  };

  /* ==================== あそびかた ==================== */
  S.initHelp = function () {
    const root = UI.addScreen('help');
    const kw = Object.keys(HF.KEYWORDS).map(function (k) {
      return '<li><b>【' + HF.KEYWORDS[k].name + '】</b> ' + HF.KEYWORDS[k].desc + '</li>';
    }).join('');
    root.innerHTML =
      '<header class="bar"><h2>あそびかた</h2></header>' +
      '<div class="scroll help">' +
      '<section><h3>ゲームの流れ</h3><ol>' +
      '<li>マップを歩いて、人に話しかけて<b>カードバトル</b>をする</li>' +
      '<li>勝つと<b>お金（G）</b>がもらえる</li>' +
      '<li><b>ふだ屋</b>でカードパックを買う</li>' +
      '<li><b>デッキ</b>（バトルで使う' + HF.DECK_SIZE + '枚のカード）を強くする</li>' +
      '<li>フィールドの<b>ボス</b>に勝つと、次のフィールドへ進める</li></ol></section>' +
      '<section><h3>バトルのルール</h3>' +
      '<div class="help-fig"><div class="hf-row"><span>敵</span><span>敵</span><span class="empty">　</span></div><div class="hf-arrows"><span>↑</span><span>↑</span><span>↑</span></div><div class="hf-row me"><span>味方</span><span>味方</span><span>味方</span></div><p>左の2体は正面の敵を攻撃。右は正面がいないので<b>相手のライフ</b>を直接攻撃！</p></div>' +
      '<ul>' +
      '<li>おたがいの<b>ライフ</b>を0にしたほうが勝ち。</li>' +
      '<li>場には<b>3つのレーン</b>（列）があり、モンスターを1体ずつ置ける。</li>' +
      '<li>自分のターンにできること：<br>① カードを1枚引く（自動）<br>② <b>エネルギー</b>が回復する。最大値は毎ターン1ずつふえる（上限' + HF.Battle.MAX_ENERGY + '）<br>③ エネルギーを使って、手札のカードを好きなだけ出す<br>④「こうげき！」ボタンをおすと、自分のモンスター全員が<b>正面を攻撃</b>してターン終了</li>' +
      '<li>正面に敵モンスターがいれば、そのモンスターのHPをへらす。<b>いなければ相手のライフをへらす</b>。</li>' +
      '<li>HPが0になったモンスターは場からいなくなる。</li>' +
      '<li>自分のモンスターがいるレーンに別のモンスターを出すと、<b>入れかえ</b>になる（古いほうはいなくなる）。</li>' +
      '<li>山札がなくなると、引くかわりに毎ターン ライフが1へる。</li></ul></section>' +
      '<section><h3>カードの見かた</h3><div class="help-card"><div style="--w:120px">' + UI.cardHTML('f1_iwagame') + '</div><ul>' +
      '<li><b>左上の青い数字</b>：コスト（出すのに必要なエネルギー）</li>' +
      '<li><b>左下 ' + UI.icon('sword') + '</b>：攻撃（あたえるダメージ）</li>' +
      '<li><b>右下 ' + UI.icon('heart') + '</b>：HP（たえられるダメージ）</li>' +
      '<li><b>★</b>：めずらしさ</li></ul></div>' +
      '<p><b>モンスター</b>は場に残って戦う。<b>まほう</b>は使うとすぐ効果が出て、なくなる。</p></section>' +
      '<section><h3>とくべつな力</h3><ul>' + kw +
      '<li><b>出たとき：〜</b>　手札から場に出したとき、1回だけ効果が出る</li></ul></section>' +
      '<section><h3>勝つためのコツ</h3><ul>' +
      '<li>敵の正面にHPの高いモンスターを置いて、ライフを守ろう。</li>' +
      '<li>がら空きのレーンに攻撃の高いモンスターを置くと、ライフを直接けずれる。</li>' +
      '<li>コストの低いカードばかりだと後半に力負けする。高いカードばかりだと序盤に何も出せない。バランスが大事！</li></ul></section>' +
      '</div><footer class="foot"><button class="btn primary" data-act="back">もどる</button></footer>';
    root.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-act="back"]')) UI.show('map');
    });
  };

  /* ==================== せってい ==================== */
  S.initSettings = function () {
    const root = UI.addScreen('settings', { onShow: render });
    function render() {
      const d = Save.data;
      const kinds = Object.keys(d.cards).filter(function (id) { return HF.cards[id]; }).length;
      root.innerHTML =
        '<header class="bar"><h2>せってい</h2></header>' +
        '<div class="scroll help">' +
        '<section><h3>きろく</h3><p>お金：' + d.money + ' G　／　カード：' + kinds + ' / ' + Object.keys(HF.cards).length + ' 種類<br>バトル：' + (d.stats.battles || 0) + '回　／　開けたパック：' + (d.stats.packs || 0) + '個</p></section>' +
        '<section><h3>セーブについて</h3><p>進み具合は<b>自動で</b>このiPhoneのSafariの中に保存されます。</p>' +
        '<p class="dim">※ Safariの「履歴とWebサイトデータを消去」をすると消えます。また、長いあいだ（1週間以上）遊ばないとSafariが自動で消すことがあります。心配なときは下の「バックアップ」を使ってください。</p></section>' +
        '<section><h3>バックアップ</h3><p>セーブデータを文字にして書き出します。メモ帳などに貼って保管できます。</p>' +
        '<div class="row"><button class="btn" data-act="export">書き出す</button><button class="btn" data-act="import">読みこむ</button></div></section>' +
        '<section><h3>そのほか</h3><div class="row"><button class="btn" data-act="title">タイトルへ</button><button class="btn danger" data-act="reset">データを消す</button></div>' +
        '<p class="dim small">ホシフダ物語 ver ' + HF.VERSION + '</p></section>' +
        '</div><footer class="foot"><button class="btn primary" data-act="back">もどる</button></footer>';
    }
    root.addEventListener('click', async function (ev) {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'back') UI.show('map');
      else if (act === 'title') UI.show('title');
      else if (act === 'export') {
        const code = Save.exportCode();
        await UI.modal('<h3>バックアップ</h3><p>下の文字をぜんぶコピーして、メモ帳などに保管してください。</p><textarea class="code" readonly>' + code + '</textarea>',
          [{
            label: 'コピーする', cls: 'primary', keep: true, onClick: function (el) {
              const ta = UI.$('textarea', el);
              ta.focus(); ta.select(); ta.setSelectionRange(0, 99999);
              let ok = false;
              try { ok = document.execCommand('copy'); } catch (e) { /* 古い方法が使えない場合 */ }
              if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { UI.toast('コピーしたよ'); }, function () { if (!ok) UI.toast('長押しでコピーしてね'); });
              else UI.toast(ok ? 'コピーしたよ' : '長押しでコピーしてね');
            }
          }, { label: 'とじる' }]);
      } else if (act === 'import') {
        let value = '';
        const r = await UI.modal('<h3>バックアップを読みこむ</h3><p>保管しておいた文字を貼りつけてください。<b>いまのデータは上書きされます。</b></p><textarea class="code" placeholder="HOSHI1:..."></textarea>',
          [{ label: 'やめる' }, { label: '読みこむ', cls: 'primary' }],
          { onOpen: function (el) { UI.$('textarea', el).addEventListener('input', function (e) { value = e.target.value; }); } });
        if (r === 1) {
          if (Save.importCode(value)) { UI.toast('読みこんだよ'); HF.Game.continueGame(); }
          else UI.toast('読みこめなかった…文字がまちがっているかも');
        }
      } else if (act === 'reset') {
        const r = await UI.modal('<h3>データを消す？</h3><p>カード・お金・進み具合が<b>すべて消えて</b>、最初からになります。元にもどせません。</p>',
          [{ label: 'やめる', cls: 'primary' }, { label: '消す', cls: 'danger' }]);
        if (r === 1) { Save.reset(); UI.show('title'); }
      }
    });
  };
})();
