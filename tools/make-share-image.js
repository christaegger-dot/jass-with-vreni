// Builds the picture that WhatsApp and other messengers show next to a shared link
// (the Open Graph image named in the head of public/index.html).
// Vreni, the cards and the man from Idaho are drawn by the app itself, so the picture always matches it.
//
//   cd public && python3 -m http.server 8765      (in a second terminal)
//   npm install puppeteer-core
//   node tools/make-share-image.js
//
// Output: public/share.jpg, 1200 x 630 pixels.
// WhatsApp drops pictures that are too heavy, so the script fails above 300 KB.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const APP = process.env.URL || 'http://127.0.0.1:8765/index.html';
const OUT = path.join(__dirname, '..', 'public', 'share.jpg');
const LIMIT = 300 * 1024;

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;color:#f4efe2;background:#143d29;
  background-image:radial-gradient(circle at 50% 42%,#2a7550 0,#1f5a3d 38%,#143d29 82%)}
.frame{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:30px 40px 30px}
h1{font-family:'Lilita One','Trebuchet MS',sans-serif;font-weight:400;font-size:118px;line-height:1;margin:0;letter-spacing:1.5px;text-shadow:0 5px 0 rgba(0,0,0,.35)}
.scene{display:flex;align-items:flex-end;justify-content:center;gap:14px}
.scene .vreni{width:310px;height:310px;flex:0 0 auto;filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))}
.fan{display:flex;align-items:flex-end;padding-bottom:26px}
.fan svg{display:block;width:128px;height:auto;margin:0 -15px;border-radius:11px;box-shadow:0 7px 16px rgba(0,0,0,.5);transform-origin:50% 100%}
.fan svg:nth-child(1){transform:rotate(-21deg) translateY(10px)}
.fan svg:nth-child(2){transform:rotate(-7deg) translateY(-8px)}
.fan svg:nth-child(3){transform:rotate(7deg) translateY(-8px)}
.fan svg:nth-child(4){transform:rotate(21deg) translateY(10px)}
p{font-family:'Patrick Hand','Comic Sans MS',cursive;font-size:54px;line-height:1;margin:0;color:#e6b43c;letter-spacing:.5px}
`;

// Runs inside the app page, where vreni, idahoMan and cardSVG exist.
function build() {
  const fan = [['eichle', 'K'], ['rose', 'A'], ['schelle', 'U'], ['schilte', 'B']].map(([s, r]) => cardSVG({ s, r })).join('');
  return '<div class="frame"><h1>Jass with Vreni</h1>'
    + '<div class="scene">' + vreni('happy') + '<div class="fan">' + fan + '</div>' + idahoMan() + '</div>'
    + '<p>The Swiss card game, one trick at a time</p></div>';
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.goto(APP, { waitUntil: 'networkidle2' });
  await page.evaluate((src, css) => {
    const html = (new Function('return (' + src + ')'))()();
    document.querySelectorAll('style').forEach(s => s.remove());
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.body.innerHTML = html;
  }, build.toString(), CSS);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ['118px "Lilita One"', '54px "Patrick Hand"'].map(f => document.fonts.check(f)));
  if (fonts.includes(false)) throw new Error('The fonts of the app did not load, the picture would use fallback fonts: ' + JSON.stringify(fonts));
  const fit = await page.evaluate(() => { const f = document.querySelector('.frame'); return { w: f.scrollWidth, h: f.scrollHeight }; });
  if (fit.w > 1200 || fit.h > 630) throw new Error('The picture does not fit: ' + JSON.stringify(fit));
  let quality = 90, bytes;
  do {
    await page.screenshot({ path: OUT, type: 'jpeg', quality, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    bytes = fs.statSync(OUT).size; quality -= 5;
  } while (bytes > LIMIT && quality >= 60);
  if (bytes > LIMIT) throw new Error('share.jpg is ' + bytes + ' bytes, more than WhatsApp shows');
  console.log('wrote share.jpg', bytes, 'bytes, quality', quality + 5);
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
