const puppeteer = require('puppeteer-core');
const URL = process.env.URL || 'http://127.0.0.1:8765/index.html';
const SITE = !!process.env.SITE;
const ORDER = 'AKOUB9876', VAL = {A:11,K:4,O:3,U:2,B:10,'9':0,'8':0,'7':0,'6':0};
const NAME2R = {Ass:'A','König':'K',Ober:'O',Under:'U',Banner:'B'};
const COUSIN = {U:'Jack',O:'Queen',K:'King',B:'Ten'};
const results = []; let fails = 0;
const ok = (c, m) => { results.push((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// independent answer key, computed from what is on the table, not from q.answer
const TO = 'U9AKOB876';
const tVal = (c, t) => c.s === t && c.r === 'U' ? 20 : c.s === t && c.r === '9' ? 14 : VAL[c.r];
function tWin(cs, t) {
  const tr = cs.map((c, i) => [c, i]).filter(x => x[0].s === t);
  if (tr.length) return tr.sort((a, b) => TO.indexOf(a[0].r) - TO.indexOf(b[0].r))[0][1];
  return cs.map((c, i) => [c, i]).filter(x => x[0].s === cs[0].s).sort((a, b) => ORDER.indexOf(a[0].r) - ORDER.indexOf(b[0].r))[0][1];
}
function tLegal(hand, trick, t) {
  const led = trick[0].s, hasLed = hand.some(c => c.s === led), onlyTrump = hand.every(c => c.s === t), mine = hand.filter(c => c.s === t);
  let best = null; for (const c of trick) if (c.s === t && (best === null || TO.indexOf(c.r) < TO.indexOf(best))) best = c.r;
  return hand.map((c, i) => {
    let good;
    if (led === t) good = mine.length === 0 || (mine.length === 1 && mine[0].r === 'U') || c.s === t;
    else if (c.s === t) good = onlyTrump || best === null || TO.indexOf(c.r) < TO.indexOf(best);
    else good = hasLed ? c.s === led : true;
    return good ? i : -1;
  }).filter(i => i >= 0);
}
// Vorhand's rule of thumb, written out independently of the app
const SUIT_IDS = ['eichle', 'rose', 'schelle', 'schilte'];
function pattern(hand, s) {
  const mine = hand.filter(c => c.s === s).map(c => c.r), has = r => mine.includes(r), aces = hand.filter(c => c.s !== s && c.r === 'A').length;
  return (has('U') && has('9') && has('A')) || (has('U') && mine.length >= 4) || (has('9') && has('A') && mine.length >= 5) || (has('U') && has('9') && mine.length >= 3 && aces >= 2);
}
function expected(q) {
  const win = cs => { let w = 0; cs.forEach((c, i) => { if (c.s === cs[0].s && ORDER.indexOf(c.r) < ORDER.indexOf(cs[w].r)) w = i; }); return w; };
  switch (q.type) {
    case 'tpick': { const want = /Puur/.test(q.prompt) ? 'U' : '9'; return q.cards.findIndex(c => c.s === q.trump && c.r === want); }
    case 'tstronger': case 'twinner': return tWin(q.cards, q.trump);
    case 'tvalue': return tVal(q.cards[0], q.trump);
    case 'tcount': return q.cards.reduce((n, c) => n + tVal(c, q.trump), 0) + (/last trick/.test(q.prompt) ? 5 : 0);
    case 'tlegal': return tLegal(q.hand, q.cards, q.trump);
    case 'announce': { const strong = SUIT_IDS.filter(s => pattern(q.cards, s)); return strong.length === 1 ? strong[0] : strong.length ? 'ambiguous' : 'push'; }
    case 'pushed': { const by = SUIT_IDS.map(s => [q.cards.filter(c => c.s === s).length, s]).sort((a, b) => b[0] - a[0]); return by[0][0] > by[1][0] ? by[0][1] : 'ambiguous'; }
    case 'mc': { const key = { 'Who gets the 5 extra points': 'Whoever wins the last trick', 'whole Trumpf suit worth': '62', 'one whole round': '157',
      'What is your seat called': 'Vorhand', 'What are your two choices': 'Name Trumpf, or push the choice to my partner', 'What must your partner do now': 'Name Trumpf. No pushing back.',
      'Who plays the first card': 'I do. Vorhand always leads.', 'Whose turn is it now': 'The player on my right', 'how long does a Trumpf stay': 'For one round of nine tricks' }; const k = Object.keys(key).find(k => q.prompt.includes(k)); return q.options.find(o => o.label === key[k]).id; }
    case 'suit': return q.cards[0].s;
    case 'number': return q.cards[0].r;
    case 'pick': { const m = q.prompt.match(/Tap the (\S+)\./); return q.cards.findIndex(c => c.r === NAME2R[m[1]]); }
    case 'bridge': return COUSIN[q.cards[0].r];
    case 'stronger': case 'winner': return win(q.cards);
    case 'legal': { const led = q.cards[0].s; const same = q.hand.map((c, i) => c.s === led ? i : -1).filter(i => i >= 0); return same.length ? same : q.hand.map((_, i) => i); }
    case 'value': return VAL[q.cards[0].r];
    case 'count': return q.cards.reduce((n, c) => n + VAL[c.r], 0);
  }
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=document-user-activation-required'].concat(process.env.PROXY ? ['--proxy-server=' + process.env.PROXY] : []) });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failed.push(r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' ' + r.status()); });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle2' });

  const getL = () => page.evaluate(() => L ? { idx: L.idx, n: L.ls.n, len: L.queue.length, phase: L.phase, ok: L.ok, help: L.help, right: L.right, q: L.queue[L.idx] } : null);
  const overflow = async tag => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
      bad: Array.from(document.querySelectorAll('#app *')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && !e.closest('.scroll'); }).slice(0, 3).map(e => e.className || e.tagName) }));
    ok(o.sw <= o.iw && o.bad.length === 0, 'no sideways overflow at 360px: ' + tag + (o.bad.length ? ' -> ' + JSON.stringify(o.bad) : ''));
  };
  const click = async sel => { const el = await page.$(sel); if (!el) throw new Error('missing ' + sel); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await el.click(); await sleep(25); };
  const typesSeen = {}, overflowSeen = {};

  // answer the current question; wrong=true gives a deliberately wrong answer
  async function answerCurrent(wrong) {
    const st = await getL(); const q = st.q; const exp = expected(q);
    typesSeen[q.type] = (typesSeen[q.type] || 0) + 1;
    const keyOk = JSON.stringify(exp) === JSON.stringify(q.answer);
    if (!keyOk) ok(false, 'answer key mismatch ' + q.type + ' app=' + JSON.stringify(q.answer) + ' independent=' + JSON.stringify(exp) + ' ' + JSON.stringify(q.cards));
    if (!overflowSeen[q.type + (q.hand ? q.hand.length : '')]) { overflowSeen[q.type + (q.hand ? q.hand.length : '')] = 1; await overflow('question ' + q.type + (q.hand ? ' hand of ' + q.hand.length : '')); }
    if (q.options) {
      let pickId = exp; if (wrong) pickId = q.options.map(o => o.id).find(id => id !== exp);
      await click('[data-opt="' + pickId + '"]');
    } else if (q.hand) {
      let sel = exp.slice();
      if (wrong) { sel = exp.length === q.hand.length ? exp.slice(1) : exp.concat(q.hand.map((_, i) => i).find(i => !exp.includes(i))); }
      for (const i of sel) await click('button.card[data-group="hand"][data-card="' + i + '"]');
      await click('[data-act="check"]');
    } else {
      let i = exp; if (wrong) i = q.cards.map((_, k) => k).find(k => k !== exp);
      await click('button.card[data-group="table"][data-card="' + i + '"]');
    }
    const after = await getL();
    const dom = await page.evaluate(() => { const f = document.querySelector('.fb'); return f ? { no: f.classList.contains('no'), text: f.innerText } : null; });
    if (!(after.phase === 'feedback' && after.ok === !wrong && dom && dom.no === !!wrong)) ok(false, 'feedback state wrong for ' + q.type + ' wrong=' + !!wrong + ' ' + JSON.stringify({ phase: after.phase, ok: after.ok, dom: dom && dom.no }));
    if (dom && !dom.text.includes(q.explain.slice(0, 20))) ok(false, 'explanation not shown for ' + q.type);
    return keyOk;
  }
  async function playLesson(si, li, wrongAt = []) {
    await click('.lesson-btn[data-stage="' + si + '"][data-lesson="' + li + '"]');
    const intro = await page.evaluate(() => document.querySelector('#app').innerText.length);
    ok(intro > 40, 'lesson ' + (si + 1) + '.' + (li + 1) + ' intro shown');
    await overflow('intro ' + (si + 1) + '.' + (li + 1));
    await click('[data-act="begin"]');
    let guard = 0, wrongDone = 0;
    while (guard++ < 40) {
      const st = await getL(); if (!st) break;
      const wrong = st.q.first && wrongAt.includes(st.idx);
      await answerCurrent(wrong); if (wrong) wrongDone++;
      const st2 = await getL();
      if (wrong) ok(st2.len > st.len || !st.q.first, 'wrong answer queues a second try');
      await click('[data-act="next"]');
    }
    const score = await page.evaluate(() => { const s = document.querySelector('.score'); return s ? s.textContent : null; });
    return { score, wrongDone };
  }

  // ---- start state
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn').length === 24), 'home shows 24 lessons');
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn:disabled').length === 20), 'stages 2 to 7 locked at start');
  await overflow('home');
  const pl = await page.evaluate(() => ({ badges: document.querySelectorAll('.places svg.badge').length, links: Array.from(document.querySelectorAll('.places a')).map(a => a.getAttribute('href')), text: document.querySelector('.places').closest('.slate').innerText }));
  ok(pl.badges === 2 && pl.links.join(' ') === 'https://heraldry-wiki.com/wiki/Winterthur https://sos.idaho.gov/StateSeal/' && /Winterthur, Switzerland/.test(pl.text) && /Idaho, USA/.test(pl.text) && /our own little drawings/.test(pl.text) && /For Heidi/.test(pl.text), 'home: the card about Winterthur and Idaho, dedicated to Heidi, with own badges and links to the real emblems');
  if (SITE) ok(await page.evaluate(() => Array.from(document.querySelectorAll('.player iframe')).map(f => f.src).join(' ') === 'https://www.youtube-nocookie.com/embed/V450wfaf0jE https://www.youtube-nocookie.com/embed/7F2mBZ3Axs8'), 'public site: two video players on the start page');

  // ---- help levels in lesson 1.2 (hint on request)
  await click('.lesson-btn[data-stage="0"][data-lesson="1"]'); await click('[data-act="begin"]');
  let h = await page.evaluate(() => ({ aid: !!document.querySelector('.aid'), hint: !!document.querySelector('[data-act="hint"]'), help: L.help }));
  ok(h.help === 1 && !h.aid && h.hint, 'hint-on-request: no aid until asked');
  await click('[data-act="hint"]');
  ok(await page.evaluate(() => !!document.querySelector('.aid')), 'hint button reveals the aid');
  await click('[data-help="2"]');
  h = await page.evaluate(() => ({ aid: !!document.querySelector('.aid'), hint: !!document.querySelector('[data-act="hint"]') }));
  ok(!h.aid && !h.hint, 'on-your-own: no aid and no hint button');
  await click('[data-help="0"]');
  ok(await page.evaluate(() => !!document.querySelector('.aid')), 'guided: aid always visible');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => L === null && document.querySelectorAll('.lesson-btn').length === 24), 'Leave returns to the path');

  // ---- stage 1
  let r = await playLesson(0, 0); ok(r.score === '100%', 'lesson 1.1 all correct -> 100% (got ' + r.score + ')');
  await click('[data-go="home"]');
  r = await playLesson(0, 1, [0]); ok(r.score === '83%', 'lesson 1.2 one wrong of six -> 83% (got ' + r.score + ')');
  await click('[data-go="home"]');
  // check with 3 wrong of 10 = 70% must NOT unlock
  r = await playLesson(0, 2); ok(r.score === '100%', 'lesson 1.3 six or nine all correct -> 100% (got ' + r.score + ')');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="0"][data-lesson="2"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { playing = null; }); await answerCurrent(false); await sleep(300);
  const nv = await page.evaluate(() => ({ src: playing && playing.src.split('/').pop(), ans: L.queue[L.idx].answer, line: L.line[0] }));
  ok(nv.src === { 6: 'saechsi.mp3', 7: 'sibni.mp3', 8: 'achti.mp3', 9: 'nueni.mp3' }[nv.ans], 'number question: Vreni says the number ' + JSON.stringify(nv));
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="0"][data-lesson="3"]'); await click('[data-act="begin"]');
  ok(await page.evaluate(() => L.help === 2 && !document.querySelector('[data-help]') && !document.querySelector('.aid') && !document.querySelector('[data-act="hint"]')), 'check: help cannot be switched on');
  await click('[data-go="home"]');
  r = await playLesson(0, 3, [0, 1, 2]); ok(r.score === '70%', 'check 1.4 with three wrong -> 70% (got ' + r.score + ')');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => document.querySelector('.lesson-btn[data-stage="1"][data-lesson="0"]').disabled), '70% does not open stage 2');
  r = await playLesson(0, 3, [4, 7]); ok(r.score === '80%', 'check 1.4 with two wrong -> 80% (got ' + r.score + ')');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => !document.querySelector('.lesson-btn[data-stage="1"][data-lesson="0"]').disabled), '80% opens stage 2');
  ok(await page.evaluate(() => document.querySelector('.lesson-btn[data-stage="2"][data-lesson="0"]').disabled), 'stage 3 still locked');

  // ---- guided aids in stage 2
  await click('.lesson-btn[data-stage="1"][data-lesson="1"]'); await click('[data-act="begin"]'); await click('[data-help="0"]');
  let g = await page.evaluate(() => { const q = L.queue[L.idx]; return { type: q.type, off: document.querySelectorAll('.card.offsuit').length, expOff: q.cards.filter(c => c.s !== q.led).length, caps: Array.from(document.querySelectorAll('.cap')).map(e => e.textContent.trim()) }; });
  ok(g.type === 'winner' && g.off === g.expOff && g.off > 0, 'guided winner: wrong-suit cards are dimmed (' + g.off + ')');
  ok(g.caps.every(c => c.length > 0), 'guided: every card has a name label');
  await answerCurrent(false); await click('[data-act="next"]');
  g = await page.evaluate(() => { const q = L.queue[L.idx]; const marks = Array.from(document.querySelectorAll('.hand .card')).map(e => e.classList.contains('same')); return { type: q.type, marks, expect: q.hand.map(c => c.s === q.led) }; });
  ok(g.type === 'legal' && JSON.stringify(g.marks) === JSON.stringify(g.expect), 'guided legal: gold bar marks exactly the cards of the suit led');
  await click('[data-go="home"]');

  // ---- stage 2 and 3
  for (const [si, li] of [[1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]) {
    r = await playLesson(si, li); ok(r.score === '100%', 'lesson ' + (si + 1) + '.' + (li + 1) + ' all correct -> 100% (got ' + r.score + ')');
    if (si === 2 && li === 2) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 1 is done. Stage 4 opens Chapter 2')), 'last check of chapter 1 announces chapter 2');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 1 is yours')), 'home shows chapter-1-complete message');
  ok(await page.evaluate(() => !document.querySelector('.lesson-btn[data-stage="3"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="4"][data-lesson="0"]').disabled), 'stage 4 open, stage 5 locked');

  // ---- chapter 2: what the learner sees
  await click('.lesson-btn[data-stage="3"][data-lesson="0"]');
  ok(await page.evaluate(() => document.querySelectorAll('.spk').length === 3 && document.querySelectorAll('.deckrow .card').length === 9), 'Trumpf intro has three speaker buttons and the nine Trumpf cards');
  await click('[data-act="begin"]');
  let c2 = await page.evaluate(() => { const q = L.queue[L.idx]; return { chip: (document.querySelector('.trumpchip') || {}).innerText, suit: suitOf(q.trump).name, tm: Array.from(document.querySelectorAll('.table .card')).map(e => e.classList.contains('tm')), exp: q.cards.map(c => c.s === q.trump) }; });
  ok(c2.chip && c2.chip.includes(c2.suit), 'the Trumpf suit is shown above the table (' + (c2.chip || '').replace(/\s+/g, ' ') + ')');
  ok(JSON.stringify(c2.tm) === JSON.stringify(c2.exp), 'guided: the red T marks exactly the Trumpf cards');
  await click('[data-help="2"]');
  ok(await page.evaluate(() => document.querySelectorAll('.card.tm').length === 0 && !!document.querySelector('.trumpchip')), 'on your own: no T marks, Trumpf chip stays');
  await click('[data-go="home"]');

  for (const [si, li] of [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]]) {
    r = await playLesson(si, li); ok(r.score === '100%', 'lesson ' + (si + 1) + '.' + (li + 1) + ' all correct -> 100% (got ' + r.score + ')');
    await click('[data-go="home"]');
  }
  // "Select all" for hands where every card is allowed
  await click('.lesson-btn[data-stage="4"][data-lesson="1"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { let q; do { q = qTLegal('trumpled', 6); } while (q.note !== 'puur'); q.first = true; L.queue[0] = q; renderLesson(); });
  await click('[data-act="all"]');
  ok(await page.evaluate(() => L.sel.length === L.queue[0].hand.length && document.querySelectorAll('.hand .card.sel').length === L.queue[0].hand.length && document.querySelector('[data-act="all"]').textContent === 'Clear'), 'Select all picks every card of the hand');
  await click('[data-act="check"]');
  ok(await page.evaluate(() => L.ok === true), 'lonely Puur: selecting everything is correct');
  await click('[data-go="home"]');
  // undertrumping: Vreni's own line, and the right cards marked
  await click('.lesson-btn[data-stage="4"][data-lesson="2"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { let q; do { q = qTLegal('under', 6); } while (q.note !== 'under'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  const uq = await page.evaluate(() => ({ answer: L.queue[0].answer, under: L.queue[0].under }));
  for (const i of uq.answer.concat(uq.under[0])) await click('button.card[data-group="hand"][data-card="' + i + '"]');
  await click('[data-act="check"]'); await sleep(300);
  const ur = await page.evaluate(() => ({ ok: L.ok, line: L.line[2], src: playing && playing.src.split('/').pop(), wrong: Array.from(document.querySelectorAll('.hand .card.wrong')).map(e => +e.dataset.card), right: Array.from(document.querySelectorAll('.hand .card.right')).map(e => +e.dataset.card) }));
  ok(ur.ok === false && ur.line === 'nid-a-mim-tisch' && ur.src === 'nid-a-mim-tisch.mp3', 'undertrumping is refused with Vreni\'s line ' + JSON.stringify([ur.ok, ur.src]));
  ok(JSON.stringify(ur.wrong) === JSON.stringify([uq.under[0]]) && JSON.stringify(ur.right) === JSON.stringify(uq.answer), 'feedback marks the lower Trumpf red and the allowed cards green');
  await click('[data-go="home"]');
  for (const [si, li] of [[4, 0], [4, 1], [4, 2], [4, 3]]) {
    r = await playLesson(si, li); ok(r.score === '100%', 'lesson ' + (si + 1) + '.' + (li + 1) + ' all correct -> 100% (got ' + r.score + ')');
    if (si === 4 && li === 3) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 6 is open')), 'check 5.4 opens stage 6');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 19), 'stages 1 to 5: 19 lessons ticked');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('setting the table') && !document.querySelector('.lesson-btn[data-stage="5"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="6"][data-lesson="0"]').disabled), 'home announces Ansagen or Schieben; stage 6 open, the round still locked');

  // ---- stage 6: Ansagen or Schieben?
  await click('.lesson-btn[data-stage="5"][data-lesson="0"]');
  ok(await page.evaluate(() => !!document.querySelector('svg.seats') && Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'vorhand,gschobe'), 'Vorhand intro shows the table from above and two speaker buttons');
  await click('[data-act="begin"]');
  await page.evaluate(() => { L.queue[0] = qMC(MC_VORHAND, 4, true); L.queue[0].first = true; renderLesson(); });
  ok(await page.evaluate(() => !!document.querySelector('.table svg.seats')), 'a seat question shows the table diagram');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="5"][data-lesson="1"]'); await click('[data-act="begin"]');
  let an = await page.evaluate(() => ({ cards: document.querySelectorAll('.cards.hand .card').length, tap: document.querySelectorAll('.cards.hand button.card').length, opts: Array.from(document.querySelectorAll('.opt')).map(o => o.dataset.opt), icons: document.querySelectorAll('.opt .oi svg').length, sum: document.querySelectorAll('.aid .hsum b').length, total: Array.from(document.querySelectorAll('.aid .hsum b')).reduce((n, b) => n + +b.textContent, 0) }));
  ok(an.cards === 9 && an.tap === 0 && an.opts.join() === 'eichle,rose,schelle,schilte,push' && an.icons === 4, 'name-or-push question: nine cards to look at, four suits and Gschobe to choose ' + JSON.stringify(an.opts));
  ok(an.sum === 4 && an.total === 9, 'guided: the hand is counted suit by suit, and the counts add up to nine');
  await page.evaluate(() => { const q = qAnnounce('push'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  await click('[data-opt="push"]'); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'gschobe' && playing && playing.src.split('/').pop() === 'gschobe.mp3'), 'a correct push: Vreni says Gschobe');
  await click('[data-go="home"]');
  for (const [si, li] of [[5, 0], [5, 1], [5, 2], [5, 3]]) {
    r = await playLesson(si, li, si === 5 && li === 1 ? [1] : []); ok(r.score === (li === 1 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 1 ? '83% with one wrong' : '100%') + ' (got ' + r.score + ')');
    if (li === 3) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 7 is open')), 'check 6.4 opens the round');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => !document.querySelector('.lesson-btn[data-stage="6"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="6"][data-lesson="0"] .lvl').textContent === 'Nine tricks'), 'the round is open and not yet played');

  // ---- stage 7: a whole round. Every card on the table is checked against the independent rules.
  const getR = () => page.evaluate(() => R ? { phase: R.phase, help: R.help, mistakes: R.mistakes, msg: R.msg, match: R.match, st: JSON.parse(JSON.stringify(R.st)) } : null);
  const waitTurn = async () => { for (let i = 0; i < 400; i++) { const s = await getR(); if (!s || s.phase !== 'play' || (s.st.turn === 0 && s.st.trick.length < 4)) return s; await sleep(10); } throw new Error('round is stuck'); };
  const myLegal = st => st.trick.length ? tLegal(st.hands[0], st.trick, st.trump) : st.hands[0].map((_, i) => i);
  function replay(start, done, trump) {            // start: the four hands as dealt
    const hands = start.map(h => h.slice()); let sum = [0, 0], bad = [];
    done.forEach((t, n) => {
      const trick = [];
      t.cards.forEach((c, j) => {
        const seat = (t.leader + j) % 4, i = hands[seat].findIndex(x => x.s === c.s && x.r === c.r);
        if (i < 0) { bad.push('card not in hand: trick ' + (n + 1) + ' seat ' + seat); return; }
        if (trick.length && !tLegal(hands[seat], trick, trump).includes(i)) bad.push('illegal card: trick ' + (n + 1) + ' seat ' + seat + ' ' + JSON.stringify(c));
        trick.push(hands[seat].splice(i, 1)[0]);
      });
      const w = (t.leader + tWin(trick, trump)) % 4, pts = trick.reduce((a, c) => a + tVal(c, trump), 0) + (n === 8 ? 5 : 0);
      if (w !== t.winner || pts !== t.points) bad.push('trick ' + (n + 1) + ': app says seat ' + t.winner + ' with ' + t.points + ', independent says seat ' + w + ' with ' + pts);
      if (n < 8 && done[n + 1].leader !== w) bad.push('trick ' + (n + 2) + ' is not led by the winner of the one before');
      sum[w % 2] += pts;
    });
    if (hands.some(h => h.length)) bad.push('cards left over');
    return { sum, bad };
  }
  async function playRound(choice, opts = {}) {
    const start = (await getR()).st.hands;
    await click('[data-rsuit="' + choice + '"]');
    let s = await getR(); const trump = s.st.trump; let triedIllegal = false, aidChecked = false, tricksSeen = 0;
    ok(s.phase === 'play' && s.st.turn === 0 && s.st.leader === 0 && s.st.trick.length === 0, 'round (' + choice + '): Vorhand plays the first card');
    for (let guard = 0; guard < 80; guard++) {
      s = await waitTurn(); if (!s || s.phase === 'done') break;
      if (s.phase === 'trickdone') {
        tricksSeen++;
        const dom = await page.evaluate(() => ({ won: Array.from(document.querySelectorAll('.rs.won')).map(e => e.className.match(/rs(\d)/)[1]), cards: document.querySelectorAll('.rt .card svg').length, btn: document.getElementById('next-btn').textContent, score: Array.from(document.querySelectorAll('.rscore b')).map(b => +b.textContent), hand: document.querySelectorAll('[data-rcard]').length, on: document.querySelectorAll('[data-rcard]:not(:disabled)').length }));
        const last = s.st.done[s.st.done.length - 1];
        if (!(dom.won.length === 1 && +dom.won[0] === last.winner && dom.cards === 4 && dom.score[0] === s.st.score[0] && dom.score[1] === s.st.score[1] && dom.hand === s.st.hands[0].length && dom.on === 0 && dom.btn === (s.st.done.length === 9 ? 'Count the points' : 'Next trick'))) ok(false, 'trick ' + s.st.done.length + ' is shown wrongly ' + JSON.stringify(dom));
        if (tricksSeen === 1) {
          const tb = await page.evaluate(() => ({ score: document.querySelector('.rscore').innerText.replace(/\s+/g, ' '), seats: Array.from(document.querySelectorAll('.rt .rn')).map(e => e.querySelectorAll('svg.badge').length).join(''), top: document.querySelector('.lesson-top .t').textContent, msg: document.getElementById('round-msg').innerText }));
          ok(/Idaho \d+ your team/.test(tb.score) && /Winterthur \d+ their team/.test(tb.score) && tb.seats === '1111' && tb.top === 'Your first round · Trick 1 of 9' && /points? for (Idaho|Winterthur)\./.test(tb.msg), 'round: the teams are Idaho and Winterthur, every seat wears its badge ' + JSON.stringify([tb.score, tb.top]));
          await overflow('round, trick done');
        }
        await click('[data-ract="next"]'); continue;
      }
      const legal = myLegal(s.st), n = s.st.hands[0].length;
      if (!aidChecked && s.st.trick.length && legal.length < n && opts.aids) {
        aidChecked = true;
        const a0 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-rcard]')).filter(e => e.classList.contains('offsuit')).map(e => +e.dataset.rcard));
        ok(JSON.stringify(a0) === JSON.stringify([...Array(n).keys()].filter(i => !legal.includes(i))), 'round, guided: exactly the cards that are not allowed are faded');
        await click('[data-help="2"]');
        ok(await page.evaluate(() => document.querySelectorAll('[data-rcard].offsuit').length === 0 && document.querySelectorAll('#app .card.tm').length === 0 && !document.querySelector('[data-ract="hint"]')), 'round, on your own: nothing faded, no T marks, no hint button');
        await click('[data-help="1"]');
        ok(await page.evaluate(() => document.querySelectorAll('[data-rcard].offsuit').length === 0 && !!document.querySelector('[data-ract="hint"]')), 'round, hint on request: nothing shown until asked');
        await click('[data-ract="hint"]');
        ok(await page.evaluate(() => document.querySelectorAll('[data-rcard].offsuit').length) === n - legal.length, 'round: the hint fades the cards that are not allowed');
        await overflow('round, my turn');
      }
      if (!triedIllegal && s.st.trick.length && legal.length < n && opts.illegal) {
        triedIllegal = true;
        const badCard = [...Array(n).keys()].find(i => !legal.includes(i));
        await page.evaluate(() => { playing = null; });
        await click('[data-rcard="' + badCard + '"]'); await sleep(250);
        const b = await page.evaluate(() => ({ mistakes: R.mistakes, hand: R.st.hands[0].length, trick: R.st.trick.length, text: document.getElementById('round-msg').innerText, no: document.getElementById('round-msg').classList.contains('no'), wrong: Array.from(document.querySelectorAll('[data-rcard].wrong')).map(e => +e.dataset.rcard), src: playing && playing.src.split('/').pop() }));
        ok(b.mistakes === 1 && b.hand === n && b.trick === s.st.trick.length && b.no && /Not allowed/.test(b.text) && b.wrong.join() === String(badCard) && /nei-nei-nei|nid-a-mim-tisch/.test(b.src || ''), 'round: a card that is not allowed stays in the hand, and Vreni says why ' + JSON.stringify([b.mistakes, b.src]));
        await overflow('round, card refused');
      }
      await click('[data-rcard="' + legal[opts.pick ? opts.pick(legal, s.st) : 0] + '"]');
    }
    s = await getR();
    const rp = replay(start, s.st.done, trump);
    ok(s.phase === 'done' && s.st.done.length === 9 && rp.bad.length === 0, 'round (' + choice + '): nine tricks, every card allowed, every winner and every count right' + (rp.bad.length ? ' -> ' + rp.bad.slice(0, 3).join(' | ') : ''));
    const bonus = s.match >= 0 ? 100 : 0;
    ok(rp.sum[0] + rp.sum[1] === 157 && s.st.score[0] + s.st.score[1] === 157 + bonus && s.st.score[0] === rp.sum[0] + (s.match === 0 ? 100 : 0), 'round (' + choice + '): 157 points, counted independently ' + JSON.stringify(rp.sum) + (bonus ? ' plus 100 for the Match' : ''));
    const text = await page.evaluate(() => document.querySelector('#app').innerText);
    ok(text.includes('The round is over') && text.includes(String(s.st.score[0])) && text.includes(String(s.st.score[1])) && (bonus ? /Match/.test(text) : text.includes('= 157')) && text.includes('Merci'), 'round (' + choice + '): the final count is shown');
    const want = s.match === 0 ? 'Nine tricks for Idaho' : s.match === 1 ? 'Nine tricks for Winterthur' : s.st.score[0] > s.st.score[1] ? 'Idaho wins the round' : 'Winterthur wins this one';
    if (!text.includes(want)) ok(false, 'round (' + choice + '): wrong verdict, expected «' + want + '» for ' + JSON.stringify(s.st.score));
    return { trump, s, triedIllegal, aidChecked };
  }
  await click('.lesson-btn[data-stage="6"][data-lesson="0"]');
  ok(await page.evaluate(() => R && R.phase === 'intro' && L === null && !!document.querySelector('svg.seats')), 'round: intro with the table from above');
  await overflow('round intro');
  await page.evaluate(() => { BOT_DELAY = 0; });
  await click('[data-ract="deal"]');
  an = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-rcard]').length, on: document.querySelectorAll('[data-rcard]:not(:disabled)').length, opts: Array.from(document.querySelectorAll('[data-rsuit]')).map(o => o.dataset.rsuit), total: Array.from(document.querySelectorAll('.aid .hsum b')).reduce((n, b) => n + +b.textContent, 0), hand: R.st.hands[0] }));
  ok(an.cards === 9 && an.on === 0 && an.opts.join() === 'eichle,rose,schelle,schilte,push' && an.total === 9, 'round: nine cards dealt, Trumpf to name or to push');
  ok(pattern(an.hand, 'schelle') && SUIT_IDS.filter(s => pattern(an.hand, s)).length === 1, 'round: the first deal is a hand to name Schelle');
  await overflow('round, naming Trumpf');
  await page.evaluate(() => { playing = null; });
  let rr = await playRound('schelle', { illegal: true, aids: true });
  ok(rr.trump === 'schelle' && rr.triedIllegal && rr.aidChecked, 'round 1: Schelle named, a refused card and the three help levels were exercised');
  await overflow('round, final count');
  ok(await page.evaluate(() => S.rounds === 1 && S.best['6-0'] === 1), 'round 1 is saved');
  // second round: the prepared deal to push
  await click('[data-ract="again"]');
  an = await page.evaluate(() => ({ phase: R.phase, hand: R.st.hands[0], partner: R.st.hands[2] }));
  ok(an.phase === 'announce' && SUIT_IDS.every(s => !pattern(an.hand, s)), 'round 2: a hand to push');
  await page.evaluate(() => { playing = null; });
  rr = await playRound('push', { pick: (legal) => legal.length - 1 });
  ok(rr.trump === 'schilte', 'round 2: Gschobe, and the partner names Schilte (' + rr.trump + ')');
  // third round: a random deal, random legal cards, and naming a suit Vreni would not
  await click('[data-ract="again"]');
  an = await page.evaluate(() => ({ hand: R.st.hands[0] }));
  const weak = SUIT_IDS.find(s => !pattern(an.hand, s));
  rr = await playRound(weak, { pick: (legal) => Math.floor(Math.random() * legal.length) });
  ok(rr.trump === weak, 'round 3: a random deal with ' + weak + ' named against the rule of thumb is played to the end');
  // leaving in the middle of a trick must not leave a timer behind
  await click('[data-ract="again"]'); await page.evaluate(() => { BOT_DELAY = 40; });
  await click('[data-rsuit="push"]');
  // the others are still playing while we leave: click inside the page, because the screen is redrawn under our feet
  await page.evaluate(() => { document.querySelector('[data-rcard="0"]').click(); document.querySelector('[data-go="home"]').click(); }); await sleep(300);
  ok(await page.evaluate(() => R === null && document.querySelectorAll('.lesson-btn').length === 24), 'leaving a round in the middle of a trick returns to the path');
  await page.evaluate(() => { BOT_DELAY = 0; });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 24 && document.querySelector('.lesson-btn[data-stage="6"][data-lesson="0"] .lvl').textContent === '3 rounds played'), 'all 24 lessons ticked, three rounds counted');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 2 is done')), 'home shows the chapter-2-complete message');
  for (let k = 0; k < 6; k++) { await click('.lesson-btn[data-stage="6"][data-lesson="0"]'); await click('[data-ract="deal"]'); const h = (await getR()).st.hands[0]; const strong = SUIT_IDS.find(s => pattern(h, s)); const x = await playRound(strong || 'push', { pick: (legal) => Math.floor(Math.random() * legal.length) }); if (!x.s || x.s.phase !== 'done') ok(false, 'extra round ' + k + ' did not finish'); await click('[data-go="home"]'); }

  // extra volume: replay stage 2 and 3 checks several times to exercise the random generators through the UI
  for (let k = 0; k < 4; k++) for (const [si, li] of [[5, 3], [5, 2], [5, 1], [5, 0], [3, 4], [4, 3], [4, 2], [4, 1], [4, 0], [3, 1], [1, 2], [0, 3]]) { r = await playLesson(si, li); if (r.score !== '100%') ok(false, 'replay ' + si + '.' + li + ' gave ' + r.score); await click('[data-go="home"]'); }
  ok(true, 'question types exercised through the UI: ' + JSON.stringify(typesSeen));

  // ---- persistence
  await page.reload({ waitUntil: 'networkidle2' });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 24 && S.rounds === 9), 'progress survives a reload');
  await click('#sound-btn'); await page.reload({ waitUntil: 'networkidle2' });
  ok(await page.evaluate(() => document.getElementById('sound-btn').textContent === 'Sound off'), 'sound setting survives a reload');

  // ---- sound off: Vreni must stay silent on answers
  await click('.lesson-btn[data-stage="0"][data-lesson="0"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { playing = null; }); await answerCurrent(false);
  ok(await page.evaluate(() => playing === null), 'sound off: no voice on answers');
  await click('[data-go="home"]'); await click('#sound-btn');

  // ---- sound on: voice plays on answer
  await click('.lesson-btn[data-stage="0"][data-lesson="0"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { playing = null; }); await answerCurrent(false); await sleep(400);
  const pv = await page.evaluate(() => playing ? { src: playing.src.split('/').pop(), paused: playing.paused, t: playing.currentTime, err: playing.error && playing.error.code } : null);
  ok(pv && !pv.err && (pv.t > 0 || !pv.paused), 'sound on: a voice clip actually plays on a correct answer ' + JSON.stringify(pv));
  await click('[data-go="home"]');

  // ---- cards sheet
  await click('#deck-btn');
  const d = await page.evaluate(() => ({ cards: document.querySelectorAll('.deckrow .card svg').length, spk: document.querySelectorAll('.spk').length, rows: document.querySelectorAll('.sheet-table tbody tr').length, clips: document.querySelectorAll('.clips button').length }));
  ok(d.cards === 45, 'sheet shows the 36 cards and the 9 Trumpf cards (' + d.cards + ')');
  ok(d.spk === 24, 'sheet has 24 speaker buttons: 4 suits, 9 cards, 4 words, 7 words of chapter 2 (' + d.spk + ')');
  ok(d.clips === (SITE ? 0 : 52), (SITE ? 'public site: recording check removed' : 'recording check lists 52 clips') + ' (' + d.clips + ')');
  await overflow('cards sheet');
  if (SITE) {
    const pdfs = await page.evaluate(async () => { const out = []; for (const a of document.querySelectorAll('a[download]')) { const r = await fetch(a.href); const b = new Uint8Array(await r.arrayBuffer()); out.push([a.getAttribute('href'), r.status, r.headers.get('content-type'), String.fromCharCode(...b.slice(0, 5)), b.length]); } return out; });
    ok(pdfs.length === 5 && pdfs.every(p => p[1] === 200 && p[3] === '%PDF-' && p[4] > 20000), 'public site: all five cheat sheets download as PDF ' + JSON.stringify(pdfs.map(p => [p[0].split('/').pop(), p[1], p[2], p[4]])));
  }
  // speaker button really plays
  await click('.spk[data-say="under"]'); await sleep(400);
  const sp = await page.evaluate(() => playing ? { src: playing.src.split('/').pop(), t: playing.currentTime, paused: playing.paused } : null);
  ok(sp && sp.src === 'under.mp3' && (sp.t > 0 || !sp.paused), 'speaker button plays the right file ' + JSON.stringify(sp));

  // ---- every recording loads and decodes in the browser
  const audio = await page.evaluate(async () => {
    const out = [];
    for (const k of RECORDED) {
      out.push(await new Promise(res => { const a = new Audio('audio/' + k + '.mp3'); a.preload = 'auto';
        a.addEventListener('loadedmetadata', () => res([k, a.duration])); a.addEventListener('error', () => res([k, -1])); setTimeout(() => res([k, -2]), 5000); }));
    }
    return out;
  });
  const badAudio = audio.filter(a => !(a[1] > 0.5 && a[1] < 5));
  ok(audio.length === 52 && badAudio.length === 0, 'all 52 recordings load and decode in the browser' + (badAudio.length ? ' BAD: ' + JSON.stringify(badAudio) : ''));
  // every key the code can ask for exists
  const keys = await page.evaluate(() => { const used = new Set(); GOOD.concat(BAD, [TRICK_LINE]).forEach(l => used.add(l[2])); ['gruezi', 'zerscht-daenke', 'jetzt-chasch-es', 'suuber', 'gschobe', 'trumpf', 'das-isch-en-stich', 'nid-a-mim-tisch', 'nei-nei-nei', 'heitere-fahne', 'merci'].forEach(k => used.add(k)); WORDS2.forEach(w => used.add(w[0])); SUITS.forEach(s => used.add(s.id)); RANKS.forEach(r => used.add(AUDIO_KEY[r.id])); WORDS.forEach(w => used.add(w[0])); return Array.from(used).filter(k => !RECORDED.has(k)); });
  ok(keys.length === 0, 'every clip the app can ask for is recorded' + (keys.length ? ' MISSING ' + keys : ''));

  // ---- progress saved by the previous version (check was lesson 3) is carried over
  await page.evaluate(() => { localStorage.setItem('jass-vreni-v1', JSON.stringify({ best: { '0-0': 1, '0-1': 1, '0-2': 0.9 }, sound: true })); });
  await page.reload({ waitUntil: 'networkidle2' });
  const mg = await page.evaluate(() => ({ check: document.querySelector('.lesson-btn[data-stage="0"][data-lesson="3"]').classList.contains('done'), six: document.querySelector('.lesson-btn[data-stage="0"][data-lesson="2"]').classList.contains('done'), s2: !document.querySelector('.lesson-btn[data-stage="1"][data-lesson="0"]').disabled }));
  ok(mg.check && !mg.six && mg.s2, 'old saved progress: check result kept, stage 2 stays open, new lesson shown as not done ' + JSON.stringify(mg));
  await click('.lesson-btn[data-stage="0"][data-lesson="2"]'); await click('[data-act="begin"]'); await overflow('six or nine question'); await click('[data-go="home"]');

  // ---- reviewers' switch: #open-all opens every stage without touching the saved progress
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(URL.split('#')[0] + '#open-all', { waitUntil: 'networkidle2' }); await page.reload({ waitUntil: 'networkidle2' });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn:disabled').length === 0 && document.querySelector('#app').innerText.includes('every stage is open')), '#open-all opens every stage');
  await page.goto(URL.split('#')[0], { waitUntil: 'networkidle2' }); await page.reload({ waitUntil: 'networkidle2' });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn:disabled').length === 20), 'without the switch the stages are locked again');

  // ---- wide screen
  await page.setViewport({ width: 1280, height: 800 }); await click('#home-btn'); await overflow('home on desktop width');

  const realErrors = errors.filter(e => e.startsWith('pageerror'));
  ok(realErrors.length === 0, 'no script errors on the page (' + errors.length + ' console messages from the test server or blocked third parties ignored)' + (realErrors.length ? ': ' + realErrors.slice(0, 5).join(' | ') : ''));
  console.log('FAILED REQUESTS RAW:', JSON.stringify(Array.from(new Set(failed))));const realFailed = failed.filter(f => !f.includes('favicon') && !/youtube|ytimg|google|doubleclick|ggpht/.test(f));
  ok(realFailed.length === 0, 'no failed network requests' + (realFailed.length ? ': ' + realFailed.slice(0, 5).join(' | ') : ''));
  console.log(results.join('\n')); console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED') + ' (' + results.length + ' checks)');
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASHED: ' + e.stack); process.exit(1); });
