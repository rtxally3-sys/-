/* ============================================================
 * フィールド1「そよかぜ草原」のデータ
 * カード20種類・パック・マップ・登場人物をここにまとめる。
 *
 * ★大事な約束：一度公開した id（f1_〜）は変えない・消さない。
 *   セーブデータが id をおぼえているため。
 * ============================================================ */
(function (root) {
  'use strict';
  const HF = root.HF;

  /* ---------- カード（20種類） ---------- */
  HF.registerCards('f1', [
    // ── 最初から持っているカード（8種類）──
    { id: 'f1_koronezumi', name: 'コロネズミ', type: 'monster', cost: 1, atk: 1, hp: 2, rarity: 1 },
    { id: 'f1_haneusa', name: 'ハネウサ', type: 'monster', cost: 1, atk: 2, hp: 1, rarity: 1 },
    { id: 'f1_tanpopon', name: 'タンポポン', type: 'monster', cost: 2, atk: 2, hp: 3, rarity: 1 },
    { id: 'f1_tsunohitsuji', name: 'ツノヒツジ', type: 'monster', cost: 2, atk: 1, hp: 5, rarity: 1 },
    { id: 'f1_kazetonbi', name: 'カゼトンビ', type: 'monster', cost: 2, atk: 2, hp: 2, rarity: 1, keywords: ['pierce'] },
    { id: 'f1_noharaokami', name: 'ノハラオオカミ', type: 'monster', cost: 3, atk: 3, hp: 4, rarity: 1 },
    { id: 'f1_ishitsubute', name: 'いしつぶて', type: 'spell', cost: 1, rarity: 1, effect: { kind: 'damage', target: 'enemyMonster', n: 2 } },
    { id: 'f1_yakusou', name: 'やくそう', type: 'spell', cost: 1, rarity: 1, effect: { kind: 'heal', n: 3 } },

    // ── そよかぜパックで手に入るカード（12種類）──
    { id: 'f1_iwagame', name: 'イワガメ', type: 'monster', cost: 3, atk: 2, hp: 4, rarity: 1, keywords: ['guard'] },
    { id: 'f1_hanamitsubachi', name: 'ハナミツバチ', type: 'monster', cost: 2, atk: 2, hp: 2, rarity: 1, onPlay: { kind: 'heal', n: 2 } },
    { id: 'f1_dongurisu', name: 'ドングリス', type: 'monster', cost: 2, atk: 1, hp: 3, rarity: 1, onPlay: { kind: 'draw', n: 1 } },
    { id: 'f1_oikaze', name: 'おいかぜ', type: 'spell', cost: 1, rarity: 1, effect: { kind: 'buff', target: 'allyMonster', atk: 2 } },
    { id: 'f1_hayateitachi', name: 'ハヤテイタチ', type: 'monster', cost: 3, atk: 3, hp: 2, rarity: 1, keywords: ['pierce'] },
    { id: 'f1_kaminarihibari', name: 'カミナリヒバリ', type: 'monster', cost: 3, atk: 2, hp: 3, rarity: 2, onPlay: { kind: 'damage', target: 'front', n: 2 } },
    { id: 'f1_harapekoguma', name: 'ハラペコグマ', type: 'monster', cost: 4, atk: 4, hp: 5, rarity: 2 },
    { id: 'f1_tsumujikaze', name: 'つむじかぜ', type: 'spell', cost: 3, rarity: 2, effect: { kind: 'damage', target: 'allEnemies', n: 2 } },
    { id: 'f1_hirameki', name: 'ひらめき', type: 'spell', cost: 2, rarity: 2, effect: { kind: 'draw', n: 2 } },
    { id: 'f1_midoriojika', name: 'ミドリオオジカ', type: 'monster', cost: 5, atk: 5, hp: 5, rarity: 3, keywords: ['guard'] },
    { id: 'f1_taifuwashi', name: 'タイフウワシ', type: 'monster', cost: 4, atk: 4, hp: 3, rarity: 3, keywords: ['pierce'] },
    { id: 'f1_futabanosei', name: 'フタバのせい', type: 'monster', cost: 3, atk: 2, hp: 3, rarity: 3, onPlay: { kind: 'buff', target: 'otherAllies', atk: 1, hp: 1 } }
  ]);

  /* ---------- 最初のデッキ（20枚） ---------- */
  HF.starter = {
    money: 100,
    deck: HF.expandDeck({
      f1_koronezumi: 3, f1_haneusa: 3, f1_tanpopon: 3, f1_tsunohitsuji: 2,
      f1_kazetonbi: 2, f1_noharaokami: 3, f1_ishitsubute: 2, f1_yakusou: 2
    })
  };

  /* ---------- ショップのパック ---------- */
  HF.registerPack({
    id: 'f1_pack', name: 'そよかぜパック', price: 100, size: 5, color: '#58b368',
    desc: '草原のなかまたち。5枚入りで、★2以上が1枚かならず入っている。',
    cards: [
      'f1_iwagame', 'f1_hanamitsubachi', 'f1_dongurisu', 'f1_oikaze', 'f1_hayateitachi',
      'f1_kaminarihibari', 'f1_harapekoguma', 'f1_tsumujikaze', 'f1_hirameki',
      'f1_midoriojika', 'f1_taifuwashi', 'f1_futabanosei'
    ]
  });

  /* ---------- フィールド本体 ---------- */
  HF.registerField({
    id: 'f1',
    order: 1,
    name: 'そよかぜ草原',
    /* マップの記号：
     *  . 草  , 花  = 道  T 木  W 水  R 屋根  H かべ  D とびら  G 門（次のフィールドへ） */
    map: [
      'TTTTGTTTT',
      'T,..=..,T',
      'T...=...T',
      'TTT.=.TTT',
      'T,..=..WW',
      'T...=.,WW',
      'T=====..T',
      'T=.,.=..T',
      'T=...=RRR',
      'T=.,.=HDH',
      'T====...T',
      'T,..=.,.T',
      'T...=...T',
      'TTTTTTTTT'
    ],
    start: { x: 4, y: 12, dir: 'up' },
    intro: [
      'ここは そよかぜ草原。',
      'カード「星札（ほしふだ）」で勝負する 星札つかいたちが あつまる場所だ。',
      '行きたい場所を タップすると歩けるよ。人をタップすると 話しかけられる。',
      'まずは 近くの人に 話しかけてみよう！'
    ],
    exits: [
      { x: 4, y: 0, to: 'f2', requires: 'f1_boss', spawn: null,
        closedText: ['大きな門が しまっている。', '草原の札守（ふだもり）に勝てば 開けてもらえそうだ。'] }
    ],
    npcs: [
      {
        id: 'f1_elder', kind: 'talk', name: 'ソヨじいさん', x: 3, y: 11, dir: 'right',
        look: { skin: '#f2c9a0', hair: '#e8e8e8', shirt: '#8a6d4b', beard: true },
        lines: [
          'ほっほ。星札バトルは はじめてかの？',
          'コツは3つじゃ。①ターンの最後に、自分のモンスター全員が 正面を攻撃する。',
          '②正面に敵がいなければ 相手のライフを 直接けずれる。',
          '③勝ってお金をためたら、ふだ屋でパックを買って「デッキ」を強くするんじゃ。',
          'こまったら 下の「あそびかた」を 見るとよいぞ。'
        ]
      },
      {
        id: 'f1_shop', kind: 'shop', name: 'ふだ屋のトメさん', x: 7, y: 10, dir: 'down',
        look: { skin: '#f5d0a9', hair: '#7a4b2a', shirt: '#d9534f', apron: '#fff4d6', bun: true },
        packs: ['f1_pack'],
        lines: ['いらっしゃい！ 星札のパック、そろってるよ。']
      },
      {
        id: 'f1_moko', kind: 'duelist', name: 'ひつじかいのモコ', x: 2, y: 8, dir: 'right',
        look: { skin: '#f7d7b5', hair: '#f3e9c6', shirt: '#6aa7d8', hat: '#e9d9a6' },
        life: 12, skill: 0.5, reward: 80, rematch: 30,
        deck: {
          f1_koronezumi: 3, f1_tsunohitsuji: 3, f1_tanpopon: 3, f1_haneusa: 3,
          f1_noharaokami: 1, f1_yakusou: 3, f1_kazetonbi: 2, f1_ishitsubute: 2
        },
        talk: {
          before: ['ぼく モコ。ひつじと いっしょに くらしてるんだ。', 'バトルは まだ れんしゅう中だけど……やってみる？'],
          again: ['また きてくれたんだ！ もういっかい やる？'],
          win: ['わあ、つよいね！ ぼくも もっと れんしゅうするよ。'],
          lose: ['やった、かてた！ デッキを 見なおして また きてね。']
        }
      },
      {
        id: 'f1_kai', kind: 'duelist', name: 'たびびとのカイ', x: 6, y: 5, dir: 'left',
        look: { skin: '#e8b98a', hair: '#3b3b58', shirt: '#3f8f6b', scarf: '#f0a030' },
        life: 14, skill: 0.8, reward: 100, rematch: 40,
        deck: {
          f1_haneusa: 3, f1_kazetonbi: 3, f1_hayateitachi: 3, f1_koronezumi: 2, f1_tanpopon: 2,
          f1_noharaokami: 2, f1_oikaze: 2, f1_ishitsubute: 2, f1_taifuwashi: 1
        },
        talk: {
          before: ['おれは カイ。風みたいに 旅をしてる。', 'おれのデッキは【つらぬき】モンスターが多い。弱いカベなんて つきぬけるぜ。', 'ついてこられるかな？'],
          again: ['よう。もう一戦、いくか？'],
          win: ['はやいな……！ いい風が ふいてるぜ、おまえ。'],
          lose: ['まだまだ だな。HPの高いモンスターで うけとめるのが コツだぜ。']
        }
      },
      {
        id: 'f1_lili', kind: 'duelist', name: '花やのリリ', x: 2, y: 5, dir: 'right',
        look: { skin: '#f9dcc4', hair: '#e07a9a', shirt: '#f6c445', flower: '#ff6f91' },
        life: 12, skill: 0.55, reward: 100, rematch: 40,
        deck: {
          f1_hanamitsubachi: 3, f1_tanpopon: 3, f1_dongurisu: 3, f1_tsunohitsuji: 3, f1_futabanosei: 1,
          f1_noharaokami: 2, f1_yakusou: 2, f1_kaminarihibari: 1, f1_oikaze: 2
        },
        talk: {
          before: ['こんにちは！ わたしは リリ。お花を 育てているの。', 'わたしのカードは「出たとき」に いいことが おきるのよ。', 'じっくり 勝負しましょ？'],
          again: ['あら、また 来てくれたのね。勝負する？'],
          win: ['まあ、すてき！ あなたのデッキ、よく 育ってるわね。'],
          lose: ['うふふ、わたしの勝ち。ふだ屋さんのパックを ためしてみたら？']
        }
      },
      {
        id: 'f1_boss', kind: 'boss', name: '札守ハルカゼ', x: 4, y: 1, dir: 'down',
        posAfterWin: { x: 3, y: 1, dir: 'right' },
        look: { skin: '#f2c9a0', hair: '#2f6f4f', shirt: '#2b4a7a', cape: '#c0392b', crown: '#ffd24a' },
        requires: ['f1_moko', 'f1_kai', 'f1_lili'],
        life: 18, skill: 0.9, reward: 300, rematch: 60,
        rewardCards: ['f1_midoriojika'],
        deck: {
          f1_kazetonbi: 2, f1_hanamitsubachi: 2, f1_dongurisu: 2, f1_kaminarihibari: 2, f1_hayateitachi: 2,
          f1_iwagame: 2, f1_harapekoguma: 2, f1_taifuwashi: 1, f1_midoriojika: 2, f1_tsumujikaze: 1, f1_ishitsubute: 2
        },
        talk: {
          locked: ['わたしは この草原の札守（ふだもり）、ハルカゼ。', 'この門を 通りたければ、まず 草原の3人に 勝ってくることだ。'],
          before: ['草原の3人に 勝ったそうだな。', 'わたしは 札守ハルカゼ。この先へ進む 力があるか、たしかめさせてもらう！'],
          again: ['また 腕をみがきに きたか。いつでも 相手になろう。'],
          win: ['みごとだ……！ きみの星札には、いい風が ふいている。', '約束どおり 門を開けよう。この先の旅も、きっと うまくいく。'],
          lose: ['まだ 風が たりないな。パックで デッキを強くして、また来るがいい。']
        }
      }
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
