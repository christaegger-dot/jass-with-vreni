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
    + '<div><h2>What comes next</h2><p>Trumpf turns one suit into the boss and changes both the order and the points. That is Chapter 2. This sheet will grow with it.</p></div></section>'
    + foot(2) + '</div>';
}

const SHEETS = [
  [1, 'jass-cheat-sheet-1-the-cards.pdf', 'Jass cheat sheet 1: The cards'],
  [2, 'jass-cheat-sheet-2-rank-and-points.pdf', 'Jass cheat sheet 2: Rank and points'],
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
