// Builds the printable cheat sheets as PDF, one US Letter page each.
// The cards are drawn by the app itself, so the sheets always match it.
//
//   cd public && python3 -m http.server 8765      (in a second terminal)
//   npm install puppeteer-core
//   node tools/make-cheatsheets.js
//
// Output: public/cheatsheets/*.pdf
const puppeteer = require('puppeteer-core');
const path = require('path');
const APP = process.env.URL || 'http://127.0.0.1:8765/index.html';
const OUT = path.join(__dirname, '..', 'public', 'cheatsheets');

const CSS = `
@page{size:Letter;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:#201d18;font-family:'Atkinson Hyperlegible',system-ui,sans-serif;font-size:10.5pt;line-height:1.36}
.page{width:8.5in;height:11in;padding:.5in .55in .42in;display:flex;flex-direction:column;gap:.17in;overflow:hidden}
header{display:flex;align-items:center;gap:14px;border-bottom:3.5px solid #1f5a3d;padding-bottom:9px}
header svg.vreni{width:60px;height:60px;flex:0 0 auto}
.kicker{font-size:8.5pt;letter-spacing:1.6px;text-transform:uppercase;color:#1f5a3d;font-weight:700}
h1{font-family:'Lilita One','Trebuchet MS',sans-serif;font-weight:400;font-size:25pt;line-height:1.05;margin:1px 0 0;letter-spacing:.3px}
.quip{margin-left:auto;max-width:2.25in;text-align:right;font-family:'Patrick Hand',cursive;font-size:14.5pt;line-height:1.12}
.quip small{display:block;font-family:'Atkinson Hyperlegible',sans-serif;font-size:8pt;color:#6b665a;margin-top:2px}
h2{font-family:'Lilita One','Trebuchet MS',sans-serif;font-weight:400;font-size:14pt;color:#1f5a3d;margin:0 0 6px;letter-spacing:.3px}
p{margin:0 0 4px}
.dim{color:#6b665a}
.say{font-style:italic;color:#6b665a}
.suits{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.suit{display:flex;gap:9px;align-items:center;border:1.2px solid #cfc9b8;border-radius:8px;padding:7px 9px}
.suit svg{width:38px;height:38px;flex:0 0 auto}
.suit b{display:block;font-size:13pt;line-height:1.1}
.suit span{display:block;font-size:8.6pt;line-height:1.25}
.row{display:grid;grid-template-columns:repeat(9,1fr);gap:7px}
.c{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px}
.c svg{width:100%;height:auto;display:block}
.c b{font-size:9.6pt;line-height:1.15;margin-top:2px}
.c span{font-size:7.6pt;line-height:1.2}
.c .pts{font-family:'Lilita One',sans-serif;font-size:17pt;line-height:1;color:#1f5a3d;font-variant-numeric:tabular-nums}
.c .pts.zero{color:#a8a294}
.scale{display:flex;justify-content:space-between;font-size:8pt;letter-spacing:1.2px;text-transform:uppercase;color:#6b665a;font-weight:700;margin-bottom:3px}
.tips{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.tip{display:flex;flex-direction:column;gap:5px}
.tip .cards{display:flex;gap:6px}
.tip .cards svg{width:.72in;height:auto}
.tip b{font-size:10pt}
.tip p{font-size:9pt;line-height:1.3;margin:0}
.two{display:grid;grid-template-columns:1.15fr 1fr;gap:.3in}
table{width:100%;border-collapse:collapse;font-size:9.6pt}
td{padding:3.5px 6px 3.5px 0;border-bottom:1px solid #ddd7c7;vertical-align:top}
td:first-child{font-weight:700;white-space:nowrap}
td.say{white-space:nowrap}
ol,ul{margin:0;padding-left:18px}
li{margin-bottom:5px}
.box{border:2px solid #e6b43c;border-radius:9px;padding:9px 12px;background:#fdf7e3}
.box b{font-size:11pt}
.rules{display:grid;grid-template-columns:1fr 1fr;gap:.25in}
.rule{display:flex;gap:10px;align-items:flex-start}
.num{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:#1f5a3d;color:#fff;font-family:'Lilita One',sans-serif;font-size:15pt;display:grid;place-items:center}
.rule b{display:block;font-size:11pt;margin-bottom:1px}
.trick{display:grid;grid-template-columns:auto 1fr;gap:.28in;align-items:center}
.trick .cards{display:flex;gap:9px}
.t{display:flex;flex-direction:column;align-items:center;gap:3px;width:.95in}
.t svg{width:100%;height:auto;display:block;border-radius:7px}
.t.win svg{outline:3.5px solid #1f5a3d;outline-offset:2px}
.t span{font-size:8pt;text-align:center;line-height:1.2}
.tag{display:inline-block;white-space:nowrap;font-size:7.4pt;font-weight:700;letter-spacing:.4px;text-transform:uppercase;border-radius:4px;padding:1px 6px;background:#e6b43c}
.tag.w{background:#1f5a3d;color:#fff}
.tag.x{background:#e9e4d6;color:#6b665a}
.tag.no{background:#d1341f;color:#fff}
.chip{display:inline-flex;align-items:center;gap:6px;background:#e6b43c;border-radius:999px;padding:2px 11px 2px 9px;font-size:9.5pt;font-weight:700}
.chip svg{width:17px;height:17px}
.minis{display:grid;grid-template-columns:repeat(3,1fr);gap:.22in}
.mini .cards{display:flex;gap:5px;margin-bottom:5px}
.mini .t{width:auto;flex:1}
.mini b{font-size:10pt}
.mini p{font-size:9pt;line-height:1.3;margin:2px 0 0}
.cases{display:grid;grid-template-columns:repeat(3,1fr);gap:.16in}
.case{border:1.5px solid #1f5a3d;border-radius:9px;padding:9px 11px 8px}
.case h3{display:flex;align-items:center;gap:8px;font-family:'Lilita One',sans-serif;font-weight:400;font-size:12.5pt;line-height:1.1;margin:0 0 6px}
.case .num{width:26px;height:26px;font-size:13pt}
.case ul{padding-left:15px;font-size:9.4pt;line-height:1.32}
.case li{margin-bottom:4px}
.work{display:grid;grid-template-columns:auto 1fr;gap:.4in;align-items:start}
.work h4{margin:0 0 5px;font-size:8pt;letter-spacing:1.2px;text-transform:uppercase;color:#6b665a}
.work .cards{display:flex;gap:10px}
.work .t{width:.98in}
footer{margin-top:auto;display:flex;justify-content:space-between;gap:20px;border-top:1.2px solid #cfc9b8;padding-top:7px;font-size:8pt;color:#6b665a}
`;

// Runs inside the app page, where SUITS, RANKS, cardSVG, symSVG, vreni and WORDS exist.
function build(which) {
  const cardOf = (s, r) => cardSVG({ s, r });
  const head = (kicker, title, quip, tr) =>
    '<header>' + vreni('happy') + '<div><div class="kicker">' + kicker + '</div><h1>' + title + '</h1></div>'
    + '<div class="quip">' + quip + (tr ? '<small>' + tr + '</small>' : '') + '</div></header>';
  const foot = n => '<footer><span><b>Jass with Vreni</b> · Cheat sheet ' + n + ' · jass-with-vreni.netlify.app</span>'
    + '<span>Simplified drawings. Real cards: jasswiki.ch/grundlagen-kultur/jasskarten</span></footer>';

  if (which === 1) {
    const suits = SUITS.map(s => '<div class="suit">' + symSVG(s.id) + '<div><b>' + s.name + '</b><span>' + s.en + '</span><span class="say">say ' + s.say + '</span></div></div>').join('');
    const row = RANKS.map(r => '<div class="c">' + cardOf('rose', r.id)
      + '<b>' + (r.say ? r.name : r.id + ' · ' + r.ch) + '</b><span class="say">' + (r.say || r.chSay) + '</span><span>' + r.en + '</span></div>').join('');
    const tip = (cards, title, text) => '<div class="tip"><div class="cards">' + cards.map(c => cardOf(c[0], c[1])).join('') + '</div><b>' + title + '</b><p>' + text + '</p></div>';
    const words = WORDS.map(w => '<tr><td>' + w[1] + '</td><td class="say">' + w[2] + '</td><td>' + w[3] + '</td></tr>').join('');
    return '<div class="page">'
      + head('Cheat sheet 1 · Chapter 1', 'The cards', 'And yes, the roses are yellow.')
      + '<section><h2>Four suits</h2><div class="suits">' + suits + '</div></section>'
      + '<section><h2>Nine cards in every suit</h2><div class="scale"><span>strongest</span><span>weakest</span></div><div class="row">' + row + '</div></section>'
      + '<section><h2>How to read a card</h2><div class="tips">'
      + tip([['eichle', 'O'], ['eichle', 'U']], 'Picture cards say their name', 'KÖNIG, OBER or UNDER stands in the corner. The Ober holds his suit sign up high, the Under down low.')
      + tip([['schelle', 'B']], 'The Banner is the ten', 'Look for the flag and for the 10 in all four corners.')
      + tip([['schilte', 'A']], 'The Ass says nothing', 'No name, no number. Two big suit signs and a ribbon in between.')
      + tip([['schelle', '6'], ['schelle', '9']], 'Six or nine?', 'The number is upright at the top and upside down at the bottom. Always read the top corners.')
      + '</div></section>'
      + '<section class="two"><div><h2>Words you will hear</h2><table>' + words + '</table></div>'
      + '<div><h2>Three surprises for Americans</h2><ol><li><b>No queens.</b> The Ober takes her place, and he is a man.</li><li><b>No hearts or spades.</b> And three of the four suits are yellow.</li><li><b>Play runs counter-clockwise.</b> After you, the player on your right is next.</li></ol></div></section>'
      + foot(1) + '</div>';
  }

  if (which === 3) {
    const T = 'schilte';
    const row = TRUMP_ORDER.map(r => { const c = { s: T, r }, pts = pointsT(c, T); return '<div class="c">' + cardOf(T, r) + '<b>' + tShort(c, T) + '</b><span class="pts' + (pts ? '' : ' zero') + '">' + pts + '</span></div>'; }).join('');
    const mini = (cards, title, text) => {
      const cs = cards.map(c => ({ s: c[0], r: c[1] })), win = trickWinnerT(cs, T);
      return '<div class="mini"><div class="cards">' + cs.map((c, i) => '<div class="t' + (i === win ? ' win' : '') + '">' + cardSVG(c)
        + '<span>' + (i === win ? '<span class="tag w">wins</span>' : i === 0 ? '<span class="tag">led</span>' : '<span class="tag" style="visibility:hidden">x</span>') + '</span></div>').join('') + '</div><b>' + title + '</b><p>' + text + '</p></div>';
    };
    const words = WORDS2.slice(0, 4).map(w => '<tr><td>' + w[1] + '</td><td class="say">' + w[2] + '</td><td>' + w[3] + '</td></tr>').join('');
    return '<div class="page">'
      + head('Cheat sheet 3 · Chapter 2', 'Trumpf', 'Puur, Nell, Ass. Say it until you dream it.')
      + '<section><h2>The Trumpf suit, from strongest to weakest, with the points</h2><div class="scale"><span>strongest</span><span>weakest</span></div><div class="row">' + row + '</div></section>'
      + '<section class="box"><b>Two cards change their life.</b> In the Trumpf suit the Under becomes the <b>Puur</b>: the strongest card in the game, worth 20 points instead of 2. The 9 becomes the <b>Nell</b>: second strongest, worth 14 points instead of nothing. In the other three suits everything stays as it was.</section>'
      + '<section><h2>Trumpf beats everything</h2><p style="margin-bottom:8px">In these three tricks <span class="chip">' + symSVG(T) + suitOf(T).name + '</span> is Trumpf. The first card of each trick was led.</p><div class="minis">'
      + mini([['rose', 'A'], ['rose', 'K'], ['schilte', '6'], ['eichle', 'B']], 'The smallest Trumpf is enough', 'Any Trumpf beats any card of the other suits. Even the 6 beats an Ass.')
      + mini([['rose', 'O'], ['schilte', 'A'], ['schilte', '9'], ['rose', 'B']], 'Two Trumpf: the higher one wins', 'The Nell beats the Ass. Remember the order: Puur, Nell, Ass.')
      + mini([['eichle', 'K'], ['eichle', '8'], ['rose', 'A'], ['schelle', 'U']], 'No Trumpf: as before', 'The highest card of the suit led wins. That Under is no Puur, because Schelle is not Trumpf.')
      + '</div></section>'
      + '<section class="two"><div><h2>The points in one round</h2><table><tr><td>Trumpf suit</td><td>20 + 14 + 11 + 10 + 4 + 3 = 62</td></tr><tr><td>Three other suits</td><td>3 × 30 = 90</td></tr><tr><td>Last trick</td><td>5 for whoever wins it</td></tr><tr><td>One whole round</td><td><b>157 points</b>, every time</td></tr></table></div>'
      + '<div><h2>Words you will hear</h2><table>' + words + '</table></div></section>'
      + foot(3) + '</div>';
  }
  if (which === 4) {
    const T = 'schelle';
    const trick = [{ s: 'rose', r: '8' }, { s: 'schelle', r: 'K' }];
    const hand = [{ s: 'rose', r: 'O' }, { s: 'schelle', r: 'A' }, { s: 'schelle', r: '7' }, { s: 'eichle', r: '6' }];
    const why = ['follows suit', 'higher than the König', 'lower than the König', 'you hold Rose, so no other suit'];
    const legal = legalT(hand, trick, T);
    if (JSON.stringify(legal) !== '[0,1]') throw new Error('worked example no longer matches the rules: ' + JSON.stringify(legal));
    const kase = (n, title, items) => '<div class="case"><h3><span class="num">' + n + '</span>' + title + '</h3><ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul></div>';
    const words = [WORDS2[3], WORDS2[4], WORDS[3]].map(w => '<tr><td>' + w[1] + '</td><td class="say">' + w[2] + '</td><td>' + w[3] + '</td></tr>').join('');
    return '<div class="page">'
      + head('Cheat sheet 4 · Chapter 2', 'What may I play?', 'Untertrumpfe? Nid a mim Tisch!', 'Undertrumping? Not at my table!')
      + '<section><h2>Three situations, three rules</h2><div class="cases">'
      + kase(1, 'A plain suit is led', ['<b>You hold that suit:</b> follow suit, or play a Trumpf instead. Your choice.', '<b>You hold none of it:</b> play any card you like.', 'A card of a third suit is never allowed while you can follow.'])
      + kase(2, 'Trumpf is led', ['<b>You hold Trumpf:</b> you must play Trumpf. Any one will do, higher or lower.', '<b>Your only Trumpf is the Puur:</b> play any card. Nobody can force him out.', '<b>You hold no Trumpf:</b> play any card you like.'])
      + kase(3, 'A plain suit is led, and somebody has trumped', ['<b>Never play a lower Trumpf</b> than the one lying in the trick.', 'A higher Trumpf is fine. So is following suit.', 'Cannot follow suit? Throw any other card away.', '<b>Only exception:</b> you hold nothing but Trumpf.'])
      + '</div></section>'
      + '<section><h2>One hand, worked out</h2><p style="margin-bottom:8px"><span class="chip">' + symSVG(T) + suitOf(T).name + '</span> is Trumpf. Rose was led, and the next player trumped with the König. Now it is your turn.</p><div class="work">'
      + '<div><h4>On the table</h4><div class="cards">' + trick.map((c, i) => '<div class="t">' + cardSVG(c) + '<span><span class="tag' + (i ? ' x' : '') + '">' + (i ? 'trumped' : 'led') + '</span><br>' + tName(c, T) + '</span></div>').join('') + '</div></div>'
      + '<div><h4>Your hand</h4><div class="cards">' + hand.map((c, i) => '<div class="t' + (legal.includes(i) ? ' win' : '') + '">' + cardSVG(c) + '<span><span class="tag ' + (legal.includes(i) ? 'w' : 'no') + '">' + (legal.includes(i) ? 'allowed' : 'not allowed') + '</span><br>' + why[i] + '</span></div>').join('') + '</div></div>'
      + '</div></section>'
      + '<section class="two"><div><h2>Words you will hear</h2><table>' + words + '</table></div>'
      + '<div><h2>If you remember one thing</h2><p>When a plain suit is led, following suit is always fine. A Trumpf is fine too, unless somebody has already trumped higher than you can.</p></div></section>'
      + foot(4) + '</div>';
  }
  const row = RANKS.map(r => '<div class="c">' + cardOf('schelle', r.id) + '<b>' + (r.say ? r.name : r.id) + '</b><span class="pts' + (r.pts ? '' : ' zero') + '">' + r.pts + '</span></div>').join('');
  const trick = [['rose', '8', 'led', ''], ['schelle', 'A', 'wrong suit', 'x'], ['rose', 'O', 'wins', 'w'], ['rose', 'B', '', '']];
  const tr = trick.map(t => '<div class="t' + (t[3] === 'w' ? ' win' : '') + '">' + cardOf(t[0], t[1])
    + '<span>' + (t[2] ? '<span class="tag ' + t[3] + '">' + t[2] + '</span><br>' : '<br>') + rankOf(t[1]).name + ' of ' + suitOf(t[0]).name + '<br><b>' + rankOf(t[1]).pts + ' points</b></span></div>').join('');
  return '<div class="page">'
    + head('Cheat sheet 2 · Chapter 1, before Trumpf', 'Rank and points', 'The Banner: rich in points, weak in a fight.')
    + '<section><h2>From strongest to weakest, with the points</h2><div class="scale"><span>strongest</span><span>weakest</span></div><div class="row">' + row + '</div></section>'
    + '<section class="box"><b>Watch the Banner.</b> It is worth 10 points, yet it ranks below the Under. Only the 9, 8, 7 and 6 are weaker. Jass is won on points, not on the number of tricks, so a Banner is a fine card to win and a painful one to lose.</section>'
    + '<section><h2>Two rules</h2><div class="rules">'
    + '<div class="rule"><span class="num">1</span><div><b>Follow suit.</b>Whoever plays first decides the suit. If you hold that suit, you must play it. If you hold none of it, play any card you like.</div></div>'
    + '<div class="rule"><span class="num">2</span><div><b>The highest card of the suit led wins.</b>A card of another suit never wins the trick, however grand it looks. The winner takes all four cards and leads the next trick.</div></div>'
    + '</div></section>'
    + '<section><h2>One trick, worked out</h2><div class="trick"><div class="cards">' + tr + '</div>'
    + '<div><p><b>Who wins?</b> Rose was led. The Ass of Schelle is the wrong suit, so it cannot win. The highest Rose on the table is the Ober. He beats the Banner and the 8.</p>'
    + '<p><b>How many points?</b> 0 + 11 + 3 + 10 = <b>24</b>. All of them go to the winner.</p>'
    + '<p class="dim">Played counter-clockwise: after you, the player on your right is next.</p></div></div></section>'
    + '<section class="two"><div><h2>Quick sums</h2><table><tr><td>One whole suit</td><td>11 + 4 + 3 + 2 + 10 = 30 points</td></tr><tr><td>All four suits</td><td>120 points</td></tr><tr><td>9, 8, 7 and 6</td><td>0 points, but they still win tricks</td></tr></table></div>'
    + '<div><h2>What comes next</h2><p>Trumpf turns one suit into the boss and changes both the order and the points. That is Chapter 2, and it has its own cheat sheets.</p></div></section>'
    + foot(2) + '</div>';
}

const SHEETS = [
  [1, 'jass-cheat-sheet-1-the-cards.pdf', 'Jass cheat sheet 1: The cards'],
  [2, 'jass-cheat-sheet-2-rank-and-points.pdf', 'Jass cheat sheet 2: Rank and points'],
  [3, 'jass-cheat-sheet-3-trumpf.pdf', 'Jass cheat sheet 3: Trumpf'],
  [4, 'jass-cheat-sheet-4-what-may-i-play.pdf', 'Jass cheat sheet 4: What may I play?'],
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  for (const [n, file, title] of SHEETS) {
    const page = await browser.newPage();
    await page.goto(APP, { waitUntil: 'networkidle2' });
    await page.evaluate((src, css, n, title) => {
      const html = (new Function('return (' + src + ')'))()(n);
      document.querySelectorAll('style').forEach(s => s.remove());
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      document.title = title; document.documentElement.lang = 'en';
      document.body.innerHTML = html;
    }, build.toString(), CSS, n, title);
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => { const p = document.querySelector('.page'); return { content: p.scrollHeight, page: p.clientHeight }; });
    if (over.content > over.page + 1) throw new Error('Sheet ' + n + ' does not fit on one page: ' + JSON.stringify(over));
    await page.pdf({ path: path.join(OUT, file), format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true });
    await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'sheet' + n + '.png'), clip: { x: 0, y: 0, width: 816, height: 1056 } });
    console.log('wrote', file, JSON.stringify(over));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
