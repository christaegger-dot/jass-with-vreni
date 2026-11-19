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
// Chapter 4: order and points without Trumpf, typed in by hand, and a Weis finder of its own
const FACT = { eichle: 1, rose: 1, schelle: 2, schilte: 2, oben: 3, unde: 3 };
const MORD = { oben: 'AKOUB9876', unde: '6789BUOKA' };
const MPTS = { oben: { A: 11, K: 4, O: 3, U: 2, B: 10, '9': 0, '8': 8, '7': 0, '6': 0 }, unde: { '6': 11, '7': 0, '8': 8, '9': 0, B: 10, U: 2, O: 3, K: 4, A: 0 } };
const mWin = (cs, m) => cs.map((c, i) => [c, i]).filter(x => x[0].s === cs[0].s).sort((a, b) => MORD[m].indexOf(a[0].r) - MORD[m].indexOf(b[0].r))[0][1];
function weisPts(hand) {
  const out = [], SU = ['eichle', 'rose', 'schelle', 'schilte'];
  for (const s of SU) { let run = 0; for (const r of 'AKOUB9876|') { if (r !== '|' && hand.some(c => c.s === s && c.r === r)) run++; else { if (run >= 3) out.push({ 3: 20, 4: 50, 5: 100, 6: 150, 7: 200, 8: 250, 9: 300 }[run]); run = 0; } } }
  for (const r of 'AKOUB9876') if (SU.every(s => hand.some(c => c.s === s && c.r === r))) out.push(r === 'U' ? 200 : r === '9' ? 150 : 100);
  return out;
}
function higherWeis(q) {
  const pa = weisPts(q.mine)[0], pb = weisPts(q.theirs)[0], row = cs => new Set(cs.map(c => c.s)).size === 1, top = cs => Math.min(...cs.map(c => 'AKOUB9876'.indexOf(c.r)));
  if (pa !== pb) return pa > pb ? 'mine' : 'theirs';
  if (row(q.mine) !== row(q.theirs)) return row(q.mine) ? 'mine' : 'theirs';
  if (top(q.mine) !== top(q.theirs)) return top(q.mine) < top(q.theirs) ? 'mine' : 'theirs';
  return q.mine[0].s === q.trump ? 'mine' : q.theirs[0].s === q.trump ? 'theirs' : 'undecided';
}
// The whole game, counted here a second time: Weis, Stöck, the factor and who gets to the total first.
function weisList(hand) {
  const out = [], SU = SUIT_IDS, O = 'AKOUB9876', has = (s, r) => hand.some(c => c.s === s && c.r === r);
  for (const s of SU) { let run = []; for (const r of O + '|') { if (r !== '|' && has(s, r)) run.push(r); else { if (run.length >= 3) out.push({ pts: { 3: 20, 4: 50, 5: 100, 6: 150, 7: 200, 8: 250, 9: 300 }[run.length], n: run.length, top: O.indexOf(run[0]), suit: s }); run = []; } } }
  for (const r of O) if (SU.every(s => has(s, r))) out.push({ pts: r === 'U' ? 200 : r === '9' ? 150 : 100, n: 4, top: O.indexOf(r), suit: null });
  return out;
}
function gWeis(hands, game, vorhand) {
  const unde = game === 'unde', trump = MORD[game] ? null : game, all = hands.map((h, seat) => weisList(h).map(w => Object.assign({ seat }, w)));
  const better = (a, b) => a.pts !== b.pts ? a.pts > b.pts : a.n !== b.n ? a.n > b.n : a.top !== b.top ? (unde ? a.top > b.top : a.top < b.top) : !!trump && a.suit === trump && b.suit !== trump;
  let best = null;
  for (let k = 0; k < 4; k++) for (const w of all[(vorhand + k) % 4]) if (!best || better(w, best)) best = w;
  if (!best) return { team: -1, points: 0 };
  const team = best.seat % 2; return { team, points: all[team].concat(all[team + 2]).reduce((n, w) => n + w.pts, 0) };
}
function gFirst(target, before, stoeck, weis, f, tricks) {
  const tot = before.slice(), one = () => { const a = tot[0] >= target, b = tot[1] >= target; return a && !b ? 0 : b && !a ? 1 : -1; };
  tot[0] += stoeck[0] * f; tot[1] += stoeck[1] * f; if (one() >= 0) return one();
  tot[0] += weis[0] * f; tot[1] += weis[1] * f; if (one() >= 0) return one();
  for (const x of tricks) { tot[x[0]] += x[1] * f; if (one() >= 0) return one(); }
  return tot[0] >= tot[1] ? 0 : 1;
}
function gFollow(hand, trick, mode, trump) {
  if (!trick.length) return hand.map((_, i) => i);
  if (!mode) return tLegal(hand, trick, trump);
  const f = hand.map((c, i) => c.s === trick[0].s ? i : -1).filter(i => i >= 0); return f.length ? f : hand.map((_, i) => i);
}
function greplay(start, done, game) {
  const mode = MORD[game] ? game : null, trump = mode ? null : game, hands = start.map(h => h.slice()), sum = [0, 0], won = [0, 0], bad = [], tricks = [];
  done.forEach((t, n) => {
    const trick = [];
    t.cards.forEach((c, j) => {
      const seat = (t.leader + j) % 4, i = hands[seat].findIndex(x => x.s === c.s && x.r === c.r);
      if (i < 0) { bad.push('card not in hand: trick ' + (n + 1) + ' seat ' + seat); return; }
      if (!gFollow(hands[seat], trick, mode, trump).includes(i)) bad.push('illegal card: trick ' + (n + 1) + ' seat ' + seat + ' ' + JSON.stringify(c));
      trick.push(hands[seat].splice(i, 1)[0]);
    });
    const w = (t.leader + (mode ? mWin(trick, mode) : tWin(trick, trump))) % 4, pts = trick.reduce((a, c) => a + (mode ? MPTS[mode][c.r] : tVal(c, trump)), 0) + (n === 8 ? 5 : 0);
    if (w !== t.winner || pts !== t.points) bad.push('trick ' + (n + 1) + ': app says seat ' + t.winner + ' with ' + t.points + ', independent says seat ' + w + ' with ' + pts);
    if (n < 8 && done[n + 1].leader !== w) bad.push('trick ' + (n + 2) + ' is not led by the winner of the one before');
    sum[w % 2] += pts; won[w % 2]++; tricks.push([w % 2, pts]);
  });
  if (hands.some(h => h.length)) bad.push('cards left over');
  return { sum, won, bad, tricks };
}
// Chapter 3, worked out here without looking at the app's own answer
function bestCards(q) {
  const h = q.hand, t = q.trump, idx = h.map((_, i) => i), has = (s, r) => h.some(c => c.s === s && c.r === r);
  if (/You pushed/.test(q.info || '')) {                                                                 // chapter 5: the first card after a push
    const four = SUIT_IDS.filter(s => s !== t && h.filter(c => c.s === s).length === 4)[0];
    if (q.mode) {                                                                                        // Obenabe or Undenufe: the weakest card of the strongest suit, or the top card of the two
      const o = MORD[q.mode], mine = idx.filter(i => h[i].s === four).sort((a, b) => o.indexOf(h[a].r) - o.indexOf(h[b].r));
      return [has(four, o[0]) && has(four, o[1]) ? mine[0] : mine[mine.length - 1]];
    }
    const tr = idx.filter(i => h[i].s === t).sort((a, b) => TO.indexOf(h[a].r) - TO.indexOf(h[b].r));
    if (!tr.length) return idx.filter(i => 'KOU'.includes(h[i].r));                                      // no Trumpf: a picture card
    if (tr.length === 1 && h[tr[0]].r === 'U') return idx.filter(i => h[i].s === four && '6789'.includes(h[i].r));   // a lone Puur stays home
    if (tr.length === 2 && h[tr[0]].r === 'U') return [tr[1]];                                           // Puur and one more: the smaller one
    if (tr.length === 3 && h[tr[0]].r === 'A') return [tr[1]];                                           // Ass and two more: the second-highest
    return [tr[0]];                                                                                      // otherwise the best Trumpf
  }
  if (!q.cards.length) {
    if (/first card/.test(q.prompt)) return idx.filter(i => h[i].s === t && h[i].r === 'U');            // you named Trumpf: lead the Puur
    if (/no Trumpf left/.test(q.info)) return idx.filter(i => h[i].s !== t && h[i].r === 'A');           // nobody can trump: play the Ass
    return idx.filter(i => '678'.includes(h[i].r) && has(h[i].s, 'K') && has(h[i].s, 'O'));              // low card under König and Ober
  }
  const legal = tLegal(h, q.cards, t), partnerWins = tWin(q.cards, t) === 1;                             // you are last: Right, Partner, Left have played
  const follow = legal.filter(i => h[i].s === q.cards[0].s);
  if (follow.length) { const pts = follow.map(i => tVal(h[i], t)), want = partnerWins ? Math.max(...pts) : Math.min(...pts); return follow.filter(i => tVal(h[i], t) === want); }
  return idx.filter(i => tVal(h[i], t) === 0 && !has(h[i].s, 'A'));                                      // throw away a worthless card from a suit without the Ass
}
function expected(q) {
  const win = cs => { let w = 0; cs.forEach((c, i) => { if (c.s === cs[0].s && ORDER.indexOf(c.r) < ORDER.indexOf(cs[w].r)) w = i; }); return w; };
  switch (q.type) {
    case 'tpick': { const want = /Puur/.test(q.prompt) ? 'U' : '9'; return q.cards.findIndex(c => c.s === q.trump && c.r === want); }
    case 'tstronger': case 'twinner': return tWin(q.cards, q.trump);
    case 'tvalue': return tVal(q.cards[0], q.trump);
    case 'tcount': return q.cards.reduce((n, c) => n + tVal(c, q.trump), 0) + (/last trick/.test(q.prompt) ? 5 : 0);
    case 'tlegal': return tLegal(q.hand, q.cards, q.trump);
    case 'factor': return FACT[q.mode || q.trump];
    case 'write': { const n = (q.lines.join(' ').match(/<b>(\d+)<\/b>/g) || []).map(x => +x.replace(/\D/g, '')).reduce((a, b) => a + b, 0); return (/all nine tricks/.test(q.lines[0]) ? 257 : n) * FACT[q.mode || q.trump]; }
    case 'matchyn': return +q.lines[0].match(/(\d+) tricks/)[1] === 9 ? 'yes' : 'no';
    case 'mstronger': case 'mwinner': return mWin(q.cards, q.mode);
    case 'mvalue': return MPTS[q.mode][q.cards[0].r];
    case 'mcount': return q.cards.reduce((n, c) => n + MPTS[q.mode][c.r], 0);
    case 'weisfind': { const w = weisPts(q.cards); return w.length > 1 ? 'more than one Weis' : (w[0] || 0); }
    case 'weiscmp': return higherWeis(q);
    case 'weiswrite': { const n = q.lines.map(l => { const m = l.match(/\((\d+)\)/); return m ? +m[1] : 0; }); return Math.max(n[0], n[1]) > n[2] ? n[0] + n[1] : 0; }
    case 'stoeck': return q.trump && q.cards.some(c => c.s === q.trump && c.r === 'K') && q.cards.some(c => c.s === q.trump && c.r === 'O') ? 'yes' : 'no';
    case 'bock': { const o = q.trump === q.cards[0].s ? TO : ORDER; let b = 0; q.cards.forEach((c, i) => { if (o.indexOf(c.r) < o.indexOf(q.cards[b].r)) b = i; }); return o.slice(0, o.indexOf(q.cards[b].r)).split('').every(r => q.gone.some(g => g.r === r)) ? b : 'a stronger card is still out'; }
    case 'mybock': return q.hand.map((c, i) => ORDER.slice(0, ORDER.indexOf(c.r)).split('').every(r => q.gone.some(g => g.s === c.s && g.r === r)) ? i : -1).filter(i => i >= 0);
    case 'trumpcount': return 9 - q.gone.length - q.mine.length;
    case 'read': return q.cards[0].s;
    case 'sure': { let n = 0; for (const s of SUIT_IDS) for (const r of MORD[q.mode]) { if (!q.cards.some(c => c.s === s && c.r === r)) break; n++; } return n; }
    case 'game': { const sure = m => { let n = 0; for (const s of SUIT_IDS) for (const r of MORD[m]) { if (!q.cards.some(c => c.s === s && c.r === r)) break; n++; } return n; }, strong = SUIT_IDS.filter(s => pattern(q.cards, s)); return sure('oben') >= 5 ? 'oben' : sure('unde') >= 5 ? 'unde' : strong.length === 1 ? 'trump' : strong.length ? 'ambiguous' : 'push'; }
    case 'best': return bestCards(q);
    case 'announce': { const strong = SUIT_IDS.filter(s => pattern(q.cards, s)); return strong.length === 1 ? strong[0] : strong.length ? 'ambiguous' : 'push'; }
    case 'pushed': { const by = SUIT_IDS.map(s => [q.cards.filter(c => c.s === s).length, s]).sort((a, b) => b[0] - a[0]); return by[0][0] > by[1][0] ? by[0][1] : 'ambiguous'; }
    case 'mc': { const key = { 'Who gets the 5 extra points': 'Whoever wins the last trick', 'whole Trumpf suit worth': '62', 'one whole round': '157',
      'What is your seat called': 'Vorhand', 'What are your two choices': 'Name Trumpf, or push the choice to my partner', 'What must your partner do now': 'Name Trumpf. No pushing back.',
      'Who plays the first card': 'I do. Vorhand always leads.', 'Whose turn is it now': 'The player on my right', 'how long does a Trumpf stay': 'For one round of nine tricks',
      'When do you announce your Weis': 'When I play my card in the first trick', 'When do you call «Stöck»': 'When I play the second of the two cards', 'What happens to your 20 points': 'They count anyway',
      'It is Obenabe, and you hold König and Ober': 'No. Without a Trumpf suit there are no Stöck', 'Is that a Weis': 'No. A row does not go round the corner', 'Which order do rows follow there': 'The same as everywhere: Ass, König, Ober, Under, Banner, 9',
      'What is a Kontermatch': 'The team that did not name the game wins all nine tricks', 'How many points is a Match worth': '257', 'all nine tricks in Obenabe': '771',
      'When is a game of Schieber over': 'When one team reaches the agreed total', 'What total do you play to': '2500', 'May you thank right away': 'Yes. I can thank as soon as we have enough', 'In which order do the points count': 'Stöck, then Weis, then tricks', 'Both teams need 20 points': 'They do: Stöck count before Weis',
      'How do you end the game': 'I thank the other team: that declares the game won', 'your team is 10 points short': 'Your team loses the game', 'Do you have to use single, double and triple': 'No. A table can agree that everything counts single' }; const k = Object.keys(key).find(k => q.prompt.includes(k)); return q.options.find(o => o.label === key[k]).id; }
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
    } else if (q.single) {
      let i = exp[0]; if (wrong) i = q.hand.map((_, k) => k).find(k => !exp.includes(k));
      await click('button.card[data-group="hand"][data-card="' + i + '"]');
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
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn').length === 57), 'home shows 57 lessons');
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn:disabled').length === 53), 'stages 2 to 14 locked at start');
  await overflow('home');
  ok(await page.evaluate(() => { const b = document.querySelector('#continue-btn'); return b && b.textContent === 'Start' && b.dataset.stage === '0' && b.dataset.lesson === '0' && /Stage 1 · The four suits/.test(b.parentElement.innerText) && b.getBoundingClientRect().bottom < window.innerHeight; }), 'home, first visit: a «Start» button for lesson 1.1 on the first screen');
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
  ok(await page.evaluate(() => L === null && document.querySelectorAll('.lesson-btn').length === 57), 'Leave returns to the path');
  await click('.lesson-btn[data-stage="0"][data-lesson="0"]'); await click('[data-act="begin"]');
  const spoken = [];
  for (let k = 0; k < 4; k++) { await page.evaluate(() => { playing = null; }); await answerCurrent(false); await sleep(200); spoken.push(await page.evaluate(() => playing ? playing.src.split('/').pop() : null)); await click('[data-act="next"]'); }
  const everyday = ['guet-gmacht.mp3', 'suuber.mp3', 'genau-eso.mp3'];
  ok(everyday.includes(spoken[0]) && spoken[1] === null && spoken[2] === null && everyday.includes(spoken[3]), 'everyday praise: Vreni says it for the first right answer and for the fourth, the chime does the rest ' + JSON.stringify(spoken));
  await click('[data-go="home"]');

  // ---- stage 1
  let r = await playLesson(0, 0); ok(r.score === '100%', 'lesson 1.1 all correct -> 100% (got ' + r.score + ')');
  let fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.next === 'Next lesson' && fin.primary === 'Next lesson' && fin.chalk === 'Suuber!' && /Next: Stage 1 · The picture cards/.test(fin.text) && /Ready for the next lesson, with a little less help\./.test(fin.text), 'after 1.1 (guided, the next one gives hints on request): «Suuber», less help announced, and a button to the next lesson ' + JSON.stringify([fin.next, fin.primary, fin.chalk]));
  await click('#next-lesson');
  ok(await page.evaluate(() => L && L.si === 0 && L.li === 1 && L.phase === 'intro'), '«Next lesson» opens lesson 1.2');
  await click('[data-go="home"]');
  r = await playLesson(0, 1, [0]); ok(r.score === '83%', 'lesson 1.2 one wrong of six -> 83% (got ' + r.score + ')');
  fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.next === 'Next lesson' && fin.chalk === 'Guet gmacht!' && /Ready for the next lesson\./.test(fin.text) && !/less help/.test(fin.text), 'after 1.2 (hints, the next one is guided again): «Guet gmacht», and no promise of less help ' + JSON.stringify([fin.next, fin.chalk]));
  await click('[data-go="home"]');
  // check with 3 wrong of 10 = 70% must NOT unlock
  r = await playLesson(0, 2); ok(r.score === '100%', 'lesson 1.3 six or nine all correct -> 100% (got ' + r.score + ')');
  fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.next === 'On to the check' && /Ready for the check: ten questions on your own\./.test(fin.text) && /Next: Stage 1 · Check: name that card/.test(fin.text), 'after 1.3: the check is announced and offered');
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
  fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.next === null && fin.primary === 'Back to the path' && !/Next:/.test(fin.text), 'a failed check offers no way on, only the path and another try');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => document.querySelector('.lesson-btn[data-stage="1"][data-lesson="0"]').disabled), '70% does not open stage 2');
  r = await playLesson(0, 3, [4, 7]); ok(r.score === '80%', 'check 1.4 with two wrong -> 80% (got ' + r.score + ')');
  fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.next === 'On to Stage 2' && fin.primary === 'On to Stage 2' && /Next: Stage 2 · Stronger or weaker/.test(fin.text), 'a passed check leads on to the next stage');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => { const b = document.querySelector('#continue-btn'); return b && b.textContent === 'Continue' && b.dataset.stage === '1' && b.dataset.lesson === '0' && /Stage 2 · Stronger or weaker/.test(b.parentElement.innerText); }), 'home, later: «Continue» points at the first lesson that is open and not done');
  await click('#continue-btn');
  ok(await page.evaluate(() => L && L.si === 1 && L.li === 0 && L.phase === 'intro'), '«Continue» opens that lesson');
  await click('[data-go="home"]');
  // below 80% the lesson itself comes first: «Again» is the main button, the next lesson the second
  r = await playLesson(1, 0, [0, 1]); ok(r.score === '67%', 'lesson 2.1 with two wrong of six -> 67% (got ' + r.score + ')');
  fin = await page.evaluate(() => ({ next: (document.querySelector('#next-lesson') || {}).textContent || null, cls: (document.querySelector('#next-lesson') || {}).className || null, primary: document.querySelector('.actions .primary').textContent, chalk: document.querySelector('.chalk').childNodes[0].textContent, text: document.querySelector('#app').innerText.replace(/\s+/g, ' ') }));
  ok(fin.primary === 'Again' && fin.next === 'Next lesson' && fin.cls === 'ghost' && fin.chalk === 'Guet.' && /Do it once more if you like/.test(fin.text), 'below 80%: «Again» comes first, the next lesson stays within reach ' + JSON.stringify([fin.primary, fin.next, fin.cls, fin.chalk]));
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
  {
    const orders = new Set(); let firsts = 0, sets = 0, proof = null;
    for (let k = 0; k < 8; k++) {
      await click('.lesson-btn[data-stage="5"][data-lesson="1"]'); await click('[data-act="begin"]');
      const w = await page.evaluate(() => L.queue.map(q => String(q.want)));
      orders.add(w.join()); if (w[0] === '1') firsts++; if (w.slice().sort().join() === '1,2,3,4,push,push') sets++;
      if (!proof && w[1] !== 'push') { await answerCurrent(false); await click('[data-act="next"]'); await answerCurrent(true); proof = await page.evaluate(() => [String(L.queue[1].want), String(L.queue[L.queue.length - 1].want), L.queue.length]); }
      await click('[data-go="home"]');
    }
    ok(firsts === 8 && sets === 8 && orders.size > 1, '«Name it or push?»: the first hand stays, the other five come in a new order (' + orders.size + ' orders in 8 starts), all four hands of the rule of thumb are there');
    ok(proof && proof[0] === proof[1] && proof[2] === 7, 'a wrong answer brings back the same kind of hand, wherever it stood ' + JSON.stringify(proof));
    const checks = new Set();
    for (let k = 0; k < 5; k++) { await click('.lesson-btn[data-stage="0"][data-lesson="3"]'); await click('[data-act="begin"]'); checks.add(await page.evaluate(() => L.queue.map(q => q.type).join())); await click('[data-go="home"]'); }
    ok(checks.size > 1, 'a check comes in a new order every time (' + checks.size + ' orders in 5 starts)');
  }
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
  ok(await page.evaluate(() => R === null && document.querySelectorAll('.lesson-btn').length === 57), 'leaving a round in the middle of a trick returns to the path');
  await page.evaluate(() => { BOT_DELAY = 0; });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 24 && document.querySelector('.lesson-btn[data-stage="6"][data-lesson="0"] .lvl').textContent === '3 rounds played'), 'chapters 1 and 2: 24 lessons ticked, three rounds counted');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('You have played a whole round') && !document.querySelector('.lesson-btn[data-stage="7"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="8"][data-lesson="0"]').disabled), 'after the round: chapter 3 is announced, stage 8 open, stage 9 locked');
  for (let k = 0; k < 6; k++) { await click('.lesson-btn[data-stage="6"][data-lesson="0"]'); await click('[data-ract="deal"]'); const h = (await getR()).st.hands[0]; const strong = SUIT_IDS.find(s => pattern(h, s)); const x = await playRound(strong || 'push', { pick: (legal) => Math.floor(Math.random() * legal.length) }); if (!x.s || x.s.phase !== 'done') ok(false, 'extra round ' + k + ' did not finish'); await click('[data-go="home"]'); }


  // ---- chapter 3, stage 8: Bock and counting
  await click('.lesson-btn[data-stage="7"][data-lesson="0"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'bock' && document.querySelectorAll('.deckrow .card').length === 4), 'Bock intro: one speaker button and the picture with the played Ass');
  await click('[data-act="begin"]');
  let b3 = await page.evaluate(() => { const q = L.queue[0]; return { gone: document.querySelectorAll('.cards.gone .card').length, exp: q.gone.length, tap: document.querySelectorAll('button.card[data-group="table"]').length, labels: Array.from(document.querySelectorAll('.row-label')).map(e => e.textContent).join('|') }; });
  ok(b3.gone === b3.exp && b3.tap === 4 && b3.labels === 'Already played|Still out', 'Bock question: the played cards are shown faded, four cards still out to choose from');
  await overflow('Bock question');
  await click('[data-go="home"]');
  for (const [si, li] of [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4]]) {
    r = await playLesson(si, li, li === 2 ? [0] : []); ok(r.score === (li === 2 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 2 ? '83% with one wrong card' : '100%') + ' (got ' + r.score + ')');
    if (li === 4) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 9 is open')), 'check 8.5 opens stage 9');
    await click('[data-go="home"]');
  }
  // ---- stage 9: the best card, and the three kinds of feedback
  await click('.lesson-btn[data-stage="8"][data-lesson="1"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qSmear(true); q.first = true; L.queue[0] = q; renderLesson(); });
  let s9 = await page.evaluate(() => { const q = L.queue[0]; return { win: Array.from(document.querySelectorAll('.table .cards:not(.hand) .cardbox')).map(e => !!e.querySelector('.tag.win')), winning: q.winning, seats: Array.from(document.querySelectorAll('.table .cards:not(.hand) .cap')).map(e => e.textContent.trim().split(' ')[0]).join(), good: q.answer, legal: q.legal, n: q.hand.length }; });
  ok(s9.seats === 'Right,Partner,Left' && s9.win.filter(Boolean).length === 1 && s9.win[s9.winning] && s9.winning === 1, 'best card, guided: seats under the cards, the green tag on the card that is winning');
  await overflow('best-card question');
  const weaker = s9.legal.find(i => !s9.good.includes(i));
  await click('button.card[data-group="hand"][data-card="' + weaker + '"]');
  let f9 = await page.evaluate(() => ({ ok: L.ok, verdict: document.querySelector('.verdict').textContent, right: Array.from(document.querySelectorAll('.hand .card.right')).map(e => +e.dataset.card), wrong: Array.from(document.querySelectorAll('.hand .card.wrong')).map(e => +e.dataset.card), text: document.querySelector('.fb').innerText, len: L.queue.length }));
  ok(f9.ok === false && f9.verdict === 'Allowed, but there is a better card' && JSON.stringify(f9.right) === JSON.stringify(s9.good) && JSON.stringify(f9.wrong) === JSON.stringify([weaker]) && /Schmiere/.test(f9.text) && /Tactic/.test(f9.text) && !/not a rule/i.test(f9.text) && f9.len === 7, 'a legal but weaker card: «Allowed, but there is a better card», the better one marked green, tagged as a tactic (the sentence «not a rule» stands once, in the legend of the lesson), the question comes back');
  await overflow('best-card feedback');
  await click('[data-act="next"]');
  await page.evaluate(() => { const q = qSmear(false); q.first = true; L.queue[L.idx] = q; renderLesson(); });
  s9 = await page.evaluate(() => { const q = L.queue[L.idx]; return { legal: q.legal, n: q.hand.length }; });
  await click('button.card[data-group="hand"][data-card="' + [...Array(s9.n).keys()].find(i => !s9.legal.includes(i)) + '"]');
  f9 = await page.evaluate(() => ({ ok: L.ok, verdict: document.querySelector('.verdict').textContent, text: document.querySelector('.fb').innerText }));
  ok(f9.ok === false && f9.verdict === 'Not allowed' && /against the rules/.test(f9.text) && /must follow suit/.test(f9.text), 'a card against the rules: «Not allowed», with the rule and then the better play');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="8"][data-lesson="0"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'trumpf-uszieh' && Array.from(document.querySelectorAll('.levels div')).map(d => d.querySelector('.tag').textContent + (d.classList.contains('on') ? '*' : '')).join() === 'Rule,Tactic*,Signal'), 'Trumpf uszieh intro: speaker button, and the legend rule, tactic, signal with «tactic» highlighted');
  await overflow('team play intro');
  {
    const legend = async li => { await click('[data-go="home"]'); await click('.lesson-btn[data-stage="8"][data-lesson="' + li + '"]'); return page.evaluate(() => Array.from(document.querySelectorAll('.levels div')).map(d => d.querySelector('.tag').textContent + (d.classList.contains('on') ? '*' : '')).join() + (/Nobody can force/.test(document.querySelector('#app').innerText) ? ' +sentence' : '')); };
    const lg = [await legend(0), await legend(1), await legend(2), await legend(3)];
    ok(lg.join(' | ') === 'Rule,Tactic*,Signal +sentence | Tactic* | Signal* | Tactic*,Signal*', 'stage 9: the whole legend opens the first lesson, the others carry one line ' + JSON.stringify(lg));
    await click('[data-go="home"]'); await click('.lesson-btn[data-stage="8"][data-lesson="4"]'); await click('[data-act="begin"]');
    const notes = [];
    for (let k = 0; k < 3; k++) { await answerCurrent(false); notes.push(await page.evaluate(() => { const e = document.querySelector('.fb .kind'); return e ? e.innerText.replace(/\s+/g, ' ') : null; })); await click('[data-act="next"]'); }
    ok(/not a rule/i.test(notes[0]) && notes.slice(1).every(n => n && /Tactic|Signal/.test(n) && !/not a rule/i.test(n)), 'check of stage 9: «not a rule» with the first answer, the tag alone after that ' + JSON.stringify(notes));
    await click('[data-go="home"]'); await click('.lesson-btn[data-stage="8"][data-lesson="0"]');
  }
  await click('[data-act="begin"]');
  await page.evaluate(() => { playing = null; }); await answerCurrent(false); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'trumpf-uszieh' && playing && playing.src.split('/').pop() === 'trumpf-uszieh.mp3' && document.querySelector('.verdict').textContent === 'Correct'), 'leading the Puur: Vreni says «Trumpf uszieh»');
  await click('[data-go="home"]');
  for (const [si, li] of [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4]]) {
    r = await playLesson(si, li, li === 3 ? [2] : []); ok(r.score === (li === 3 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 3 ? '83% with one wrong card' : '100%') + ' (got ' + r.score + ')');
    if (li === 4) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 3 is done. Stage 10 opens Chapter 4')), 'check 9.5 announces chapter 4');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 34), 'chapters 1 to 3: 34 lessons ticked');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 3 is done') && !document.querySelector('.lesson-btn[data-stage="9"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="10"][data-lesson="0"]').disabled), 'home shows the chapter-3-complete message; stage 10 open, stage 11 locked');

  // ---- chapter 4, stage 10: Obenabe and Undenufe
  await click('.lesson-btn[data-stage="9"][data-lesson="2"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'undenufe' && /No Trumpf/i.test(document.querySelector('.trumpchip').innerText) && document.querySelector('.ladder').innerText.replace(/\s+/g, ' ').startsWith('6 beats 7 beats 8')), 'Undenufe intro: speaker button, the tag «No Trumpf», and the order starting with the 6');
  await overflow('Undenufe intro');
  await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qMWinner('unde'); q.first = true; L.queue[0] = q; renderLesson(); });
  let m4 = await page.evaluate(() => { const q = L.queue[0]; return { chip: document.querySelector('.trumpchip').innerText.replace(/\s+/g, ' '), off: document.querySelectorAll('.card.offsuit').length, exp: q.cards.filter(c => c.s !== q.led).length, tm: document.querySelectorAll('.card.tm').length }; });
  ok(/No Trumpf/i.test(m4.chip) && /Undenufe/.test(m4.chip) && m4.off === m4.exp && m4.off > 0 && m4.tm === 0, 'Undenufe trick: gold tag «No Trumpf · Undenufe», wrong-suit cards dimmed, no T marks ' + JSON.stringify(m4.chip));
  await overflow('Undenufe question');
  await click('[data-go="home"]');
  for (const [si, li] of [[9, 0], [9, 1], [9, 2], [9, 3], [9, 4], [9, 5]]) {
    r = await playLesson(si, li, li === 1 ? [3] : []); ok(r.score === (li === 1 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 1 ? '83% with one wrong' : '100%') + ' (got ' + r.score + ')');
    if (li === 5) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 11 is open')), 'check 10.6 opens stage 11');
    await click('[data-go="home"]');
  }
  // ---- stage 11: Weis and Stöck
  await click('.lesson-btn[data-stage="10"][data-lesson="0"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'wys' && document.querySelectorAll('.wt div').length === 6), 'Weis intro: speaker button and the table of six values');
  await overflow('Weis intro');
  await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qWeisFind('seq4'); q.first = true; L.queue[0] = q; renderLesson(); });
  await overflow('Weis question');
  const wq = await page.evaluate(() => ({ answer: L.queue[0].answer, mark: L.queue[0].mark }));
  await click('[data-opt="' + wq.answer + '"]');
  ok(await page.evaluate(() => L.ok === true && Array.from(document.querySelectorAll('.cards.hand .card')).map((e, i) => e.classList.contains('right') ? i : -1).filter(i => i >= 0).join() === L.queue[0].mark.join()) && wq.mark.length >= 4, 'Weis found: exactly the cards of the row are ringed green');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="10"][data-lesson="2"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qWeisCmp('trump'); q.first = true; L.queue[0] = q; renderLesson(); });
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.row-label')).map(e => e.textContent).join('|') === 'Our Weis|Their Weis' && document.querySelectorAll('.table .cards').length === 2 && !!document.querySelector('.trumpchip')), 'Weis against Weis: two rows of cards and the Trumpf tag');
  await overflow('Weis comparison');
  await page.evaluate(() => { const q = qWeisWrite(); q.first = true; L.queue[0] = q; renderLesson(); });
  ok(await page.evaluate(() => document.querySelectorAll('.lines li').length === 3), 'who writes: three lines, one for you, one for your partner, one for the other team');
  await overflow('Weis writing');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="10"][data-lesson="3"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qStoeck('yes'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  await click('[data-opt="yes"]'); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'stoeck-ruf' && playing && playing.src.split('/').pop() === 'stoeck-ruf.mp3'), 'Stöck: Vreni calls «Stöck!»');
  await click('[data-go="home"]');
  for (const [si, li] of [[10, 0], [10, 1], [10, 2], [10, 3], [10, 4]]) {
    r = await playLesson(si, li, li === 2 ? [1] : []); ok(r.score === (li === 2 ? '86%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 2 ? '86% with one wrong of seven' : '100%') + ' (got ' + r.score + ')');
    if (li === 4) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 12 is open')), 'check 11.5 opens stage 12');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 45), 'stages 1 to 11: 45 lessons ticked');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('every game and every bonus')), 'home shows the message after stage 11');

  // ---- stage 12: the slate
  await click('.lesson-btn[data-stage="11"][data-lesson="0"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'jasstafel,jassteppich' && document.querySelectorAll('.wt div').length === 3), 'slate intro: two speaker buttons and the table single, double, triple');
  await overflow('slate intro');
  await click('[data-act="begin"]');
  let s12 = await page.evaluate(() => ({ chip: document.querySelector('.trumpchip').innerText.replace(/\s+/g, ' '), opts: Array.from(document.querySelectorAll('.opt')).map(o => o.dataset.opt).join(), game: gameName(L.queue[0].game) }));
  ok(s12.chip.includes(s12.game) && s12.opts === '1,2,3', 'factor question: the named game on the gold tag, three choices ' + JSON.stringify(s12.chip));
  await overflow('factor question');
  await page.evaluate(() => { const q = qWrite('weis', 'schilte'); q.first = true; L.queue[0] = q; renderLesson(); });
  ok(await page.evaluate(() => document.querySelectorAll('.lines li').length === 2 && /Schilte/.test(document.querySelector('.trumpchip').innerText)), 'slate question: points and Weis on two lines under the game');
  await overflow('slate question');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="11"][data-lesson="2"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qMatchYN('yes'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  await click('[data-opt="yes"]'); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'heitere-fahne' && playing && playing.src.split('/').pop() === 'heitere-fahne.mp3'), 'a Match: Vreni says «Heitere Fahne, en Match!»');
  await click('[data-go="home"]');
  for (const [si, li] of [[11, 0], [11, 1], [11, 2], [11, 3], [11, 4]]) {
    r = await playLesson(si, li, li === 1 ? [4] : []); ok(r.score === (li === 1 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 1 ? '83% with one wrong' : '100%') + ' (got ' + r.score + ')');
    if (li === 4) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Chapter 4 is done. You know every rule of the game now. Stage 13 opens Chapter 5')), 'check 12.5 announces chapter 5');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 50 && document.querySelector('#app').innerText.includes('which game to name') && !document.querySelector('.lesson-btn[data-stage="12"][data-lesson="0"]').disabled), 'stages 1 to 12: 50 lessons ticked, stage 13 open, and home points to it');

  // ---- chapter 5, stage 13: sure tricks, which game to name, the first card after a push
  await click('.lesson-btn[data-stage="12"][data-lesson="0"]');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.spk')).map(b => b.dataset.say).join() === 'obenabe,undenufe' && document.querySelectorAll('.deckrow').length === 3), 'sure tricks intro: two speaker buttons and three small examples');
  await overflow('sure tricks intro');
  await click('[data-act="begin"]');
  let s13 = await page.evaluate(() => ({ cards: document.querySelectorAll('.hand .cardbox').length, chip: document.querySelector('.trumpchip').innerText.replace(/\s+/g, ' '), opts: document.querySelectorAll('.opt').length, aid: !!document.querySelector('.aid .ladder') }));
  ok(s13.cards === 9 && /Obenabe/.test(s13.chip) && s13.opts === 4 && s13.aid, 'sure tricks question: nine cards, the gold tag Obenabe, four numbers, and the ladder as a guide ' + JSON.stringify(s13));
  await overflow('sure tricks question');
  await answerCurrent(false);
  ok(await page.evaluate(() => { const q = L.queue[0]; return document.querySelectorAll('.hand .card.right').length === q.mark.length && q.mark.length === q.answer; }), 'sure tricks feedback: exactly the sure cards are marked green');
  await overflow('sure tricks feedback');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="12"][data-lesson="1"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qGame('unde'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('.opt')).map(o => o.dataset.opt).join() === 'trump,oben,unde,push' && document.querySelectorAll('.hand .cardbox').length === 9 && !!document.querySelector('.aid .hsum')), 'which game: nine cards and the four answers Trumpf suit, Obenabe, Undenufe, Gschobe');
  await overflow('which-game question');
  await click('[data-opt="unde"]'); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'undenufe' && playing && playing.src.split('/').pop() === 'undenufe.mp3' && /Tactic/.test(document.querySelector('.fb .kind').innerText) && !/not a rule/i.test(document.querySelector('.fb').innerText)), 'naming Undenufe: Vreni says «Undenufe!», and the answer is tagged a tactic');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="12"][data-lesson="3"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qLeadNoT('puur1'); q.first = true; L.queue[0] = q; renderLesson(); });
  const s13b = await page.evaluate(() => { const q = L.queue[0]; return { info: document.querySelector('.info').innerText, none: document.querySelector('.none').innerText, good: q.answer, puur: q.hand.findIndex(c => c.s === q.trump && c.r === 'U'), n: q.hand.length }; });
  ok(/You pushed/.test(s13b.info) && /You lead/.test(s13b.none) && s13b.n === 9 && s13b.good.length === 2, 'lead after a push: the situation in words, an empty table, nine cards');
  await overflow('lead-after-push question');
  await click('button.card[data-group="hand"][data-card="' + s13b.puur + '"]');
  const f13 = await page.evaluate(() => ({ ok: L.ok, verdict: document.querySelector('.verdict').textContent, right: document.querySelectorAll('.hand .card.right').length, text: document.querySelector('.fb').innerText.replace(/\s+/g, ' ') }));
  ok(f13.ok === false && f13.verdict === 'Allowed, but there is a better card' && f13.right === 2 && /Tactic Signal/.test(f13.text) && !/not a rule/i.test(f13.text), 'leading the lone Puur: «Allowed, but there is a better card», both low cards marked, tagged tactic and signal');
  await overflow('lead-after-push feedback');
  await click('[data-go="home"]');
  await click('.lesson-btn[data-stage="12"][data-lesson="4"]'); await click('[data-act="begin"]');
  await page.evaluate(() => { const q = qLeadM('low', 'unde'); q.first = true; L.queue[0] = q; playing = null; renderLesson(); });
  ok(await page.evaluate(() => /Undenufe/.test(document.querySelector('.trumpchip').innerText) && /named Undenufe/.test(document.querySelector('.info').innerText)), 'lead after a pushed Undenufe: the gold tag and the situation name the game');
  await overflow('lead after a pushed Undenufe');
  await answerCurrent(false); await sleep(300);
  ok(await page.evaluate(() => L.ok === true && L.line[2] === 'aazieh' && playing && playing.src.split('/').pop() === 'aazieh.mp3'), 'the weakest card of the strongest suit: Vreni says «Aazieh!»');
  await click('[data-go="home"]');
  for (const [si, li] of [[12, 0], [12, 1], [12, 2], [12, 3], [12, 4], [12, 5]]) {
    r = await playLesson(si, li, li === 2 ? [3] : []); ok(r.score === (li === 2 ? '83%' : '100%'), 'lesson ' + (si + 1) + '.' + (li + 1) + ' -> ' + (li === 2 ? '83% with one wrong card' : '100%') + ' (got ' + r.score + ')');
    if (li === 5) ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('Stage 14 is open')), 'check 13.6 opens the whole game');
    await click('[data-go="home"]');
  }
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 56 && document.querySelector('#app').innerText.includes('Now play it all') && !document.querySelector('.lesson-btn[data-stage="13"][data-lesson="0"]').disabled && document.querySelector('.lesson-btn[data-stage="13"][data-lesson="0"] .lvl').textContent === 'Six games, one slate'), 'stages 1 to 13: 56 lessons ticked, the whole game is open and not yet played');

  // ---- stage 14: the whole game. Every round played through the page is counted again here: tricks, Weis, Stöck, factor, slate.
  const getG = () => page.evaluate(() => G ? { phase: G.phase, ask: G.ask, msg: G.msg, gm: G.gm ? JSON.parse(JSON.stringify(G.gm)) : null, st: G.st ? JSON.parse(JSON.stringify(G.st)) : null, res: G.res ? JSON.parse(JSON.stringify(G.res)) : null } : null);
  let refusedInGame = 0;
  async function playGameRound(label) {            // from the screen that says who named what, to the round on the slate
    const g0 = await getG(), start = g0.st.hands, game = g0.st.game, v = g0.st.vorhand, before = g0.gm.total.slice(), factors = g0.gm.factors, target = g0.gm.target;
    const mode = MORD[game] ? game : null, trump = mode ? null : game;
    ok(g0.phase === 'named' && g0.st.leader === v && g0.st.turn === v, label + ': Vorhand plays the first card');
    await click('[data-gact="play"]');
    let weisTold = false, stoeckTold = false, tried = false;
    for (let guard = 0; guard < 6000; guard++) {
      const s = await getG();
      if (s.phase === 'count') break;
      if (s.phase === 'trickdone') {
        if (s.st.done.length === 1) weisTold = /<b>Weis\.<\/b>|Nobody has a Weis/.test(s.msg);
        if (/calls? «Stöck»/.test(s.msg)) stoeckTold = true;
        await click('[data-gact="next"]'); continue;
      }
      if (s.phase === 'play' && s.st.turn === 0 && s.st.trick.length < 4) {
        const hand = s.st.hands[0], legal = gFollow(hand, s.st.trick, mode, trump), illegal = hand.map((_, i) => i).find(i => !legal.includes(i));
        const faded = await page.evaluate(() => Array.from(document.querySelectorAll('[data-gcard]')).map(b => b.classList.contains('offsuit') ? +b.dataset.gcard : -1).filter(i => i >= 0));
        if (JSON.stringify(faded) !== JSON.stringify(hand.map((_, i) => i).filter(i => !legal.includes(i)))) ok(false, label + ': the faded cards are not the forbidden ones ' + JSON.stringify({ faded, legal }));
        if (illegal !== undefined && !tried) {
          tried = true; refusedInGame++;
          await click('[data-gcard="' + illegal + '"]');
          const a = await getG();
          ok(a.st.hands[0].length === hand.length && a.st.trick.length === s.st.trick.length && /Not allowed/.test(a.msg) && (mode ? /must follow suit/.test(a.msg) : a.msg.length > 30), label + ': a forbidden card stays in the hand, and Vreni says why');
        }
        await click('[data-gcard="' + legal[0] + '"]'); continue;
      }
      await sleep(8);
    }
    const s = await getG(), rp = greplay(start, s.st.done, game), f = factors ? FACT[game] : 1, w = gWeis(start, game, v);
    const holder = trump ? [0, 1, 2, 3].find(x => start[x].some(c => c.s === trump && c.r === 'K') && start[x].some(c => c.s === trump && c.r === 'O')) : undefined;
    const stoeckTeam = holder === undefined ? -1 : holder % 2, match = rp.won[0] === 9 ? 0 : rp.won[1] === 9 ? 1 : -1;
    const want = [0, 1].map(tm => (rp.sum[tm] + (match === tm ? 100 : 0) + (w.team === tm ? w.points : 0) + (stoeckTeam === tm ? 20 : 0)) * f);
    ok(s.phase === 'count' && s.st.done.length === 9 && rp.bad.length === 0 && rp.sum[0] + rp.sum[1] === 157, label + ': nine tricks, every card allowed, every winner and every count right' + (rp.bad.length ? ' -> ' + rp.bad.slice(0, 3).join(' | ') : ''));
    ok(s.res.factor === f && s.res.rows[0].written === want[0] && s.res.rows[1].written === want[1] && s.gm.total[0] === before[0] + want[0] && s.gm.total[1] === before[1] + want[1], label + ': the slate, counted independently ' + JSON.stringify({ game, f, tricks: rp.sum, weis: w, stoeckTeam, match, want, app: s.res.rows.map(x => x.written) }));
    const cells = await page.evaluate(() => Array.from(document.querySelectorAll('.gcount tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent)));
    const last = cells[cells.length - 1] || [], cell = (name, tm) => { const r = cells.find(x => x[0] === name); return r ? r[tm + 1] : null; };
    ok(last[0] === 'On the slate' && +last[1] === want[0] && +last[2] === want[1] && +cell('Tricks', 0) === rp.sum[0] && +cell('Tricks', 1) === rp.sum[1] && cell('Weis', 0) === (w.team === 0 ? String(w.points) : '–') && cell('Stöck', 1) === (stoeckTeam === 1 ? '20' : '–') && (factors ? cell('Factor', 0) === '× ' + f : cell('Factor', 0) === null), label + ': the table on the page shows the same numbers ' + JSON.stringify(cells));
    ok(weisTold && (stoeckTeam < 0 || stoeckTold), label + ': the Weis is told after the first trick' + (stoeckTeam >= 0 ? ', and «Stöck» is called' : ''));
    const reached = [0, 1].filter(tm => s.gm.total[tm] >= target);
    const winner = !reached.length ? -1 : reached.length === 1 ? reached[0] : gFirst(target, before, [stoeckTeam === 0 ? 20 : 0, stoeckTeam === 1 ? 20 : 0], [w.team === 0 ? w.points : 0, w.team === 1 ? w.points : 0], f, rp.tricks);
    ok(s.gm.over === (reached.length > 0) && s.gm.winner === winner, label + ': the game is ' + (reached.length ? 'over, and the right team wins' : 'not over yet'));
    return { s, want, game, f, w, stoeckTeam, reached, winner };
  }
  await click('.lesson-btn[data-stage="13"][data-lesson="0"]');
  ok(await page.evaluate(() => G && G.phase === 'intro' && L === null && R === null && Array.from(document.querySelectorAll('[data-gnew]')).map(b => b.dataset.gnew).join() === '1000,2500' && !document.querySelector('[data-gact="resume"]')), 'whole game: the intro offers two lengths, and there is nothing to continue yet');
  await overflow('whole game, intro');
  await page.evaluate(() => { BOT_DELAY = 0; });
  await click('[data-gnew="2500"]');
  let gg = await getG();
  ok(gg.phase === 'bid' && gg.ask === 'vorhand' && gg.gm.factors === true && gg.gm.target === 2500 && gg.gm.first === true && gg.st.vorhand === 0 && gg.st.dealer === 3, 'whole game, round 1: you are Vorhand, and the game goes to 2500 with factors');
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('[data-gsay]')).map(b => b.dataset.gsay).join() === 'eichle,rose,schelle,schilte,oben,unde,push' && /× 3/.test(document.querySelector('[data-gsay="oben"]').innerText) && /× 2/.test(document.querySelector('[data-gsay="schelle"]').innerText) && /× 1/.test(document.querySelector('[data-gsay="rose"]').innerText) && !/×/.test(document.querySelector('[data-gsay="push"]').innerText) && document.querySelectorAll('.hand .cardbox').length === 9 && !!document.querySelector('.aid .hsum')), 'whole game: seven things to say, and every game shows its factor');
  await overflow('whole game, what to say');
  await page.evaluate(() => { playing = null; });
  await click('[data-gsay="oben"]'); await sleep(250);
  gg = await getG();
  ok(gg.phase === 'named' && gg.st.mode === 'oben' && gg.st.namer === 0 && gg.st.pushed === false && /Good call/.test(gg.msg) && /Obenabe counts triple/.test(gg.msg) && /you play the first card/.test(gg.msg), 'whole game: Obenabe on six sure tricks is a good call, and it counts triple');
  ok(await page.evaluate(() => { const chip = document.querySelector('.rtable .trumpchip').innerText.replace(/\s+/g, ' '); return playing && playing.src.split('/').pop() === 'obenabe.mp3' && /No Trumpf/i.test(chip) && /Obenabe/.test(chip) && /× 3\s*triple/i.test(document.querySelector('.rtable .gfactor').innerText) && /The slate: Idaho 0 · Winterthur 0/.test(document.querySelector('.gslate').innerText.replace(/\s+/g, ' ')) && /to 2500/.test(document.querySelector('.gslate').innerText); }), 'whole game: Vreni says «Obenabe», the factor stands in its own corner, and the slate starts at nil');
  await overflow('whole game, before the first card');
  const r1 = await playGameRound('whole game, round 1 (Obenabe)');
  ok(r1.f === 3 && r1.stoeckTeam === -1 && r1.reached.length === 0, 'whole game, round 1: triple, no Stöck without a Trumpf suit, and nobody is at 2500');
  await overflow('whole game, a round on the slate');
  ok(await page.evaluate(() => { const t = document.querySelector('.gcount').getBoundingClientRect(), th = Array.from(document.querySelectorAll('.gcount th')).map(x => x.getBoundingClientRect()); return t.left >= 0 && t.right <= window.innerWidth && th.every(x => x.right <= window.innerWidth && x.width > 20) && th.length === 3; }), 'whole game: both teams’ columns of the count fit on the phone');
  ok(await page.evaluate(() => S.fullRounds === 1 && S.game && S.game.round === 1 && S.best['13-0'] === 1 && /Round 1 goes on the slate/.test(document.querySelector('#app').innerText) && /You named Obenabe/.test(document.querySelector('#app').innerText) && !!document.querySelector('[data-gact="nextround"]') && /the player on your right is Vorhand/.test(document.querySelector('#app').innerText)), 'whole game: the round is saved, the stage counts as played, and the next Vorhand is announced');
  await click('[data-gact="nextround"]');
  gg = await getG();
  ok(gg.phase === 'named' && gg.gm.round === 1 && gg.st.vorhand === 1 && gg.st.dealer === 0 && gg.st.leader === 1 && /The player on your right is Vorhand/.test(gg.msg) && /plays the first card/.test(gg.msg), 'whole game, round 2: the deal has moved on, and the player on your right is Vorhand');
  await overflow('whole game, somebody else is Vorhand');
  const r2 = await playGameRound('whole game, round 2');
  ok(r2.s.gm.total[0] === r1.want[0] + r2.want[0] && r2.s.gm.total[1] === r1.want[1] + r2.want[1] && r2.s.gm.log.length === 2, 'whole game: the slate adds round to round');
  await click('[data-gact="nextround"]');
  gg = await getG();
  ok(gg.phase === 'bid' && gg.ask === 'pushed' && gg.st.vorhand === 2 && await page.evaluate(() => Array.from(document.querySelectorAll('[data-gsay]')).map(b => b.dataset.gsay).join() === 'eichle,rose,schelle,schilte,oben,unde' && /Your partner is Vorhand and pushes/.test(document.querySelector('h2.prompt').innerText)), 'whole game, round 3: your partner pushes, you must name the game, and Gschobe is not on offer');
  await overflow('whole game, after your partner pushed');
  await click('[data-gsay="schilte"]'); await sleep(250);
  gg = await getG();
  ok(gg.phase === 'named' && gg.st.trump === 'schilte' && gg.st.pushed === true && gg.st.namer === 0 && gg.st.leader === 2 && /Vreni would have said the same/.test(gg.msg) && /You hold a Weis: three in a row and three in a row/.test(gg.msg) && /Your partner plays the first card/.test(gg.msg) && /Schilte counts double/.test(gg.msg), 'whole game, round 3: you name Schilte, your partner still leads, and your two Weis are announced');
  const r3 = await playGameRound('whole game, round 3 (Schilte)');
  ok(r3.f === 2 && r3.stoeckTeam === 0 && r3.s.res.rows[0].stoeck === 20 && r3.s.res.rows[1].stoeck === 0, 'whole game, round 3: König and Ober of Trumpf in your hand are Stöck, 20 for Idaho before the factor');
  await click('[data-go="home"]');
  ok(await page.evaluate(() => G === null && document.querySelector('.lesson-btn[data-stage="13"][data-lesson="0"] .lvl').textContent === '3 rounds played' && document.querySelectorAll('.lesson-btn.done').length === 57), 'home: three rounds played, and all 57 lessons are ticked');
  ok(await page.evaluate(() => document.querySelector('#app').innerText.includes('finished the whole course') && document.querySelector('.later').innerText.includes('That is the whole course')), 'home shows the end-of-course message');
  ok(await page.evaluate(() => !document.querySelector('#continue-btn')), 'home, course finished: no «Continue» button');
  await click('.lesson-btn[data-stage="13"][data-lesson="0"]');
  ok(await page.evaluate(() => !!document.querySelector('[data-gact="resume"]') && /Round 4/.test(document.querySelector('#app').innerText) && /to 2500/.test(document.querySelector('#app').innerText)), 'whole game: a game that was left can be continued');
  await overflow('whole game, a game to continue');
  await click('[data-gact="resume"]');
  gg = await getG();
  ok(gg.phase === 'named' && gg.gm.round === 3 && gg.st.vorhand === 3 && gg.gm.total[0] === r3.s.gm.total[0] && gg.gm.total[1] === r3.s.gm.total[1] && /The player on your left is Vorhand/.test(gg.msg), 'whole game, round 4: the slate is back, and the player on your left is Vorhand');
  await page.evaluate(() => { G.gm.total = [2440, 2440]; renderGame(); });      // both teams 60 short: this round ends the game
  const r4 = await playGameRound('whole game, the last round');
  ok(r4.reached.length >= 1 && r4.s.gm.over === true, 'whole game: with both teams 60 short, the round ends the game');
  const endText = await page.evaluate(() => document.querySelector('#app').innerText.replace(/\s+/g, ' '));
  ok(endText.includes('The game is over') && endText.includes((r4.winner === 0 ? 'Idaho' : 'Winterthur') + ' has reached 2500 and wins the game') && (r4.reached.length === 2) === /Stöck, Weis, Stich/.test(endText) && await page.evaluate(() => !!document.querySelector('.spk[data-say="bedanke"]') && !!document.querySelector('[data-gact="newgame"]') && !document.querySelector('[data-gact="nextround"]') && S.game === null && S.games === 1 && S.fullRounds === 4), 'whole game: the end names the winner, teaches Bedanke, and the finished game is no longer kept');
  await overflow('whole game, the end');
  ok(refusedInGame >= 1, 'whole game: a forbidden card was tried and refused (' + refusedInGame + ' times)');
  await click('[data-gact="newgame"]');
  ok(await page.evaluate(() => G.phase === 'intro' && !document.querySelector('[data-gact="resume"]')), 'whole game: after the end a new game can be chosen');
  await click('[data-gnew="1000"]');
  gg = await getG();
  ok(gg.phase === 'bid' && gg.gm.factors === false && gg.gm.target === 1000 && gg.gm.first === false && await page.evaluate(() => !/×/.test(document.querySelector('.options').innerText) && /to 1000/.test(document.querySelector('.gslate').innerText)), 'whole game to 1000: everything counts single, and no factor is shown');
  await click('[data-gsay="unde"]'); await sleep(150);
  const r5 = await playGameRound('whole game to 1000, round 1 (Undenufe)');
  ok(r5.f === 1 && r5.s.res.rows[0].sum === r5.s.res.rows[0].written, 'whole game to 1000: Undenufe counts single, the sum goes on the slate as it is');
  await click('[data-go="home"]');

  // extra volume: replay stage 2 and 3 checks several times to exercise the random generators through the UI
  for (let k = 0; k < 4; k++) for (const [si, li] of [[12, 5], [12, 4], [12, 3], [12, 2], [12, 1], [12, 0], [11, 4], [11, 1], [11, 2], [10, 4], [9, 5], [10, 3], [10, 2], [10, 1], [9, 4], [9, 3], [8, 4], [7, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 3], [7, 2], [5, 3], [5, 2], [5, 1], [5, 0], [3, 4], [4, 3], [4, 2], [4, 1], [4, 0], [3, 1], [1, 2], [0, 3]]) { r = await playLesson(si, li); if (r.score !== '100%') ok(false, 'replay ' + si + '.' + li + ' gave ' + r.score); await click('[data-go="home"]'); }
  ok(true, 'question types exercised through the UI: ' + JSON.stringify(typesSeen));

  // ---- persistence
  await page.reload({ waitUntil: 'networkidle2' });
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn.done').length === 57 && S.rounds === 9 && S.fullRounds === 5 && S.games === 1 && S.game && S.game.round === 1 && S.game.target === 1000), 'progress survives a reload, the running game included');
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
  ok(d.spk === 38, 'sheet has 38 speaker buttons: 4 suits, 9 cards, 4 words, 7 words of chapter 2, 5 of chapter 3, 9 of chapter 4 (' + d.spk + ')');
  ok(d.clips === (SITE ? 0 : 52), (SITE ? 'public site: recording check removed' : 'recording check lists 52 clips') + ' (' + d.clips + ')');
  await overflow('cards sheet');
  ok(await page.evaluate(SITE_ONLY => { const top = e => e.getBoundingClientRect().top + scrollY, h = Array.from(document.querySelectorAll('#app h2')), find = t => h.find(x => x.textContent === t); const sh = Array.from(document.querySelectorAll('a.sheet'));
    return find('Four suits') && top(find('Four suits')) < 420 && top(find('Take it to the table')) > top(find('Chapter 5 · At the table')) && !!find('Two rules to begin with') && !find('Two rules so far')
      && (!SITE_ONLY || (sh.length === 11 && sh.every(a => a.getBoundingClientRect().height < 90 && a.getBoundingClientRect().height >= 44 && /^Cheat sheet \d+ · .+ \(PDF\)$/.test(a.getAttribute('aria-label'))))); }, SITE), 'the cards page starts with the cards; the cheat sheets come last, one compact line each');
  if (SITE) {
    const pdfs = await page.evaluate(async () => { const out = []; for (const a of document.querySelectorAll('a[download]')) { const r = await fetch(a.href); const b = new Uint8Array(await r.arrayBuffer()); out.push([a.getAttribute('href'), r.status, r.headers.get('content-type'), String.fromCharCode(...b.slice(0, 5)), b.length]); } return out; });
    ok(pdfs.length === 11 && pdfs.every(p => p[1] === 200 && p[3] === '%PDF-' && p[4] > 20000), 'public site: all eleven cheat sheets download as PDF ' + JSON.stringify(pdfs.map(p => [p[0].split('/').pop(), p[1], p[2], p[4]])));
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
  const keys = await page.evaluate(() => { const used = new Set(); GOOD.concat(BAD, [TRICK_LINE]).forEach(l => used.add(l[2])); ['gruezi', 'zerscht-daenke', 'jetzt-chasch-es', 'suuber', 'gschobe', 'trumpf', 'das-isch-en-stich', 'nid-a-mim-tisch', 'nei-nei-nei', 'heitere-fahne', 'merci'].forEach(k => used.add(k)); WORDS2.forEach(w => used.add(w[0])); WORDS3.forEach(w => used.add(w[0])); WORDS4.forEach(w => used.add(w[0])); WORDS5.forEach(w => used.add(w[0])); used.add('stoeck-ruf'); SUITS.forEach(s => used.add(s.id)); RANKS.forEach(r => used.add(AUDIO_KEY[r.id])); WORDS.forEach(w => used.add(w[0])); return Array.from(used).filter(k => !RECORDED.has(k)); });
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
  ok(await page.evaluate(() => document.querySelectorAll('.lesson-btn:disabled').length === 53), 'without the switch the stages are locked again');

  // ---- wide screen
  await page.setViewport({ width: 1280, height: 800 }); await click('#home-btn'); await overflow('home on desktop width');

  const realErrors = errors.filter(e => e.startsWith('pageerror'));
  ok(realErrors.length === 0, 'no script errors on the page (' + errors.length + ' console messages from the test server or blocked third parties ignored)' + (realErrors.length ? ': ' + realErrors.slice(0, 5).join(' | ') : ''));
  console.log('FAILED REQUESTS RAW:', JSON.stringify(Array.from(new Set(failed))));const realFailed = failed.filter(f => !f.includes('favicon') && !/youtube|ytimg|google|doubleclick|ggpht/.test(f));
  ok(realFailed.length === 0, 'no failed network requests' + (realFailed.length ? ': ' + realFailed.slice(0, 5).join(' | ') : ''));
  console.log(results.join('\n')); console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED') + ' (' + results.length + ' checks)');
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.log('TEST CRASHED: ' + e.stack); process.exit(1); });
