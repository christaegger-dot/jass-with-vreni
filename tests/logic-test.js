const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const logic=html.split('/*LOGIC-START*/')[1].split('/*LOGIC-END*/')[0];
const api=new Function(logic+';return {SUITS,RANKS,trickWinner,legalCards,trickPoints,points,qSuit,qPick,qBridge,qNumber,qStronger,qWinner,qLegal,qValue,qCount,STAGES,deck,trickWinnerT,pointsT,legalT,qTPick,qTStronger,qTWinner,qTValue,qTCount,qMC,MC_POINTS,qTLegal,announcePattern,announceAdvice,bestSuit,qAnnounce,qPushed,MC_VORHAND,dealRound,newRound,roundPlay,roundCloseTrick,botCard,botMove,PATTERN_TEXT,isBock,qBock,qMyBock,qTrumpCount,qDraw,qCash,qSmear,qDiscard,qRead,qPull};')();
let fail=0,count=0;const ok=(c,m)=>{count++;if(!c){fail++;console.log('FAIL',m)}};
const C=(s,r)=>({s,r});
// fixed cases
ok(api.trickWinner([C('rose','7'),C('rose','B'),C('rose','U'),C('rose','9')])===2,'U beats Banner');
ok(api.trickWinner([C('rose','7'),C('schelle','A'),C('rose','8'),C('eichle','K')])===2,'offsuit never wins');
ok(api.trickWinner([C('rose','6'),C('schelle','A'),C('eichle','A'),C('schilte','A')])===0,'led 6 wins vs offsuit aces');
ok(api.trickWinner([C('rose','K'),C('rose','A'),C('rose','O'),C('rose','B')])===1,'Ass top');
ok(JSON.stringify(api.legalCards([C('rose','7'),C('schelle','A'),C('rose','A')],C('rose','K')))==='[0,2]','must follow');
ok(api.legalCards([C('eichle','7'),C('schelle','A')],C('rose','K')).length===2,'free if void');
ok(api.trickPoints([C('rose','A'),C('rose','B'),C('rose','K'),C('rose','O')])===28,'28');
ok(api.deck().reduce((n,c)=>n+api.points(c),0)===120,'plain deck total 120');
// generators
const uniq=cs=>new Set(cs.map(c=>c.s+c.r)).size===cs.length;
for(let i=0;i<3000;i++){
  let q=api.qSuit();ok(q.options.some(o=>o.id===q.answer)&&q.cards[0].s===q.answer,'suit');
  for(const cv of [false,true]){q=api.qNumber(cv);ok(q.options.some(o=>o.id===q.answer)&&q.cards[0].r===q.answer&&q.cards[0].cover===cv&&['6','7','8','9'].includes(q.answer)&&q.explain.includes('the '+q.answer)||q.explain.includes('say '+q.answer),'number')}
  q=api.qPick();ok(q.cards.length===4&&uniq(q.cards)&&q.cards[q.answer].r===q.target,'pick');
  q=api.qBridge();ok(q.options.some(o=>o.id===q.answer),'bridge');
  q=api.qStronger();ok(q.cards.length===2&&uniq(q.cards)&&q.cards[0].s===q.cards[1].s&&q.answer===api.trickWinner(q.cards),'stronger');
  for(const off of [false,true]){q=api.qWinner(off);ok(q.cards.length===4&&uniq(q.cards)&&q.cards[0].s===q.led&&q.answer===api.trickWinner(q.cards)&&q.cards[q.answer].s===q.led,'winner');
    if(off)ok(q.cards.some(c=>c.s!==q.led)&&/wrong suit/.test(q.explain),'winner trap')}
  for(const n of [4,5,6,9]){q=api.qLegal(n);ok(q.hand.length===n&&uniq(q.hand.concat(q.cards))&&q.answer.length>0&&q.hand.some(c=>c.s===q.led)===q.has,'legal '+n);
    ok(q.has?q.answer.every(i=>q.hand[i].s===q.led)&&q.answer.length===q.hand.filter(c=>c.s===q.led).length:q.answer.length===n,'legal set')}
  q=api.qValue();ok(q.options.some(o=>o.id===q.answer),'value');
  q=api.qCount();ok(q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer)&&q.answer===api.trickPoints(q.cards)&&uniq(q.cards),'count');
}

// ------------------------------------------------------------ Trumpf (chapter 2)
// Reference rules, written independently of the app and card by card.
const TO='U9AKOB876',PO='AKOUB9876';
function refWinner(cs,t){
  const tr=cs.map((c,i)=>[c,i]).filter(x=>x[0].s===t);
  if(tr.length)return tr.sort((a,b)=>TO.indexOf(a[0].r)-TO.indexOf(b[0].r))[0][1];
  return cs.map((c,i)=>[c,i]).filter(x=>x[0].s===cs[0].s).sort((a,b)=>PO.indexOf(a[0].r)-PO.indexOf(b[0].r))[0][1];
}
function refLegal(hand,trick,t){
  const led=trick[0].s,hasLed=hand.some(c=>c.s===led),onlyTrump=hand.every(c=>c.s===t),mine=hand.filter(c=>c.s===t);
  let best=null;for(const c of trick)if(c.s===t&&(best===null||TO.indexOf(c.r)<TO.indexOf(best)))best=c.r;
  const res=[];
  hand.forEach((c,i)=>{
    let good;
    if(led===t)good=mine.length===0||(mine.length===1&&mine[0].r==='U')||c.s===t;
    else if(c.s===t)good=onlyTrump||best===null||TO.indexOf(c.r)<TO.indexOf(best);
    else good=hasLed?c.s===led:true;
    if(good)res.push(i);
  });
  return res;
}
const refPts=(c,t)=>c.s===t&&c.r==='U'?20:c.s===t&&c.r==='9'?14:{A:11,K:4,O:3,U:2,B:10}[c.r]||0;
const J=JSON.stringify,T='rose';
// fixed cases, each one a rule a learner has to know
ok(api.trickWinnerT([C('schelle','A'),C('schelle','K'),C('rose','6'),C('eichle','A')],T)===2,'smallest Trumpf beats an Ass');
ok(api.trickWinnerT([C('schelle','O'),C('rose','A'),C('rose','9'),C('schelle','B')],T)===2,'Nell beats the Trumpf Ass');
ok(api.trickWinnerT([C('rose','A'),C('rose','U'),C('rose','9'),C('schelle','A')],T)===1,'Puur beats the Nell');
ok(api.trickWinnerT([C('eichle','K'),C('eichle','8'),C('schelle','A'),C('schilte','U')],T)===0,'no Trumpf: suit led decides');
ok(api.trickWinnerT([C('rose','6'),C('schelle','A'),C('rose','B'),C('rose','O')],T)===3,'Trumpf Ober beats Trumpf Banner');
ok(api.pointsT(C('rose','U'),T)===20&&api.pointsT(C('rose','9'),T)===14&&api.pointsT(C('eichle','U'),T)===2&&api.pointsT(C('eichle','9'),T)===0,'Puur 20, Nell 14, plain Under 2, plain 9 nothing');
for(const s of api.SUITS)ok(api.deck().reduce((n,c)=>n+api.pointsT(c,s.id),0)===152,'152 card points with '+s.id+' as Trumpf');
ok(api.deck().filter(c=>c.s===T).reduce((n,c)=>n+api.pointsT(c,T),0)===62,'Trumpf suit is worth 62');
const L=(hand,trick)=>J(api.legalT(hand,trick,T));
ok(L([C('schelle','7'),C('rose','6'),C('eichle','A')],[C('schelle','K')])==='[0,1]','follow suit or trump, nothing else');
ok(L([C('eichle','A'),C('schilte','7')],[C('schelle','K')])==='[0,1]','void in the suit led: anything');
ok(L([C('rose','U'),C('schelle','A'),C('eichle','6')],[C('rose','K')])==='[0,1,2]','Trumpf led, lonely Puur: anything');
ok(L([C('rose','U'),C('rose','6'),C('schelle','A')],[C('rose','K')])==='[0,1]','Trumpf led, Puur plus another Trumpf: must play Trumpf');
ok(L([C('rose','7'),C('schelle','A')],[C('rose','K')])==='[0]','Trumpf led, one ordinary Trumpf: must play it');
ok(L([C('schelle','A'),C('eichle','6')],[C('rose','K')])==='[0,1]','Trumpf led, no Trumpf: anything');
ok(L([C('schelle','O'),C('rose','A'),C('rose','7'),C('eichle','6')],[C('schelle','8'),C('rose','K')])==='[0,1]','trumped trick: follow or overtrump, no undertrump, no other suit');
ok(L([C('rose','7'),C('rose','9'),C('eichle','6'),C('schilte','A')],[C('schelle','8'),C('rose','K')])==='[1,2,3]','trumped trick, void: discard or overtrump with the Nell');
ok(L([C('rose','7'),C('rose','K')],[C('schelle','8'),C('rose','A')])==='[0,1]','only Trumpf in hand: undertrumping allowed');
ok(L([C('rose','B'),C('eichle','7')],[C('schelle','8'),C('rose','6'),C('rose','K')])==='[1]','two Trumpf in the trick: the higher one counts');
ok(L([C('rose','U')],[C('rose','A')])==='[0]','last card');
// the app against the reference on random hands
const rnd=n=>Math.floor(Math.random()*n);
for(let k=0;k<30000;k++){
  const d=api.deck().sort(()=>Math.random()-.5),t=api.SUITS[rnd(4)].id;
  const trick=d.splice(0,1+rnd(3)),hand=d.splice(0,1+rnd(9));
  if(J(api.legalT(hand,trick,t))!==J(refLegal(hand,trick,t))){ok(false,'legalT differs from the reference '+J({t,trick,hand}));break}
  const four=trick.concat(hand).slice(0,4);
  if(four.length===4&&api.trickWinnerT(four,t)!==refWinner(four,t)){ok(false,'trickWinnerT differs from the reference '+J({t,four}));break}
}
// every Trumpf question against the reference
const seen={};
for(let i=0;i<4000;i++){
  let q=api.qTPick(i%2?'U':'9');ok(q.cards.length===4&&uniq(q.cards)&&q.cards[q.answer].s===q.trump&&q.cards[q.answer].r===q.target&&q.cards.some(c=>c.r===q.target&&c.s!==q.trump),'tpick');
  q=api.qTStronger();ok(q.cards.length===2&&q.cards.every(c=>c.s===q.trump)&&q.answer===refWinner(q.cards,q.trump),'tstronger');
  q=api.qTWinner();ok(q.cards.length===4&&uniq(q.cards)&&q.answer===refWinner(q.cards,q.trump)&&q.led===q.cards[0].s,'twinner '+q.v);
  if(q.v==='small')ok(q.cards[q.answer].s===q.trump&&'678'.includes(q.cards[q.answer].r),'twinner small: little Trumpf wins');
  if(q.v==='none')ok(!q.cards.some(c=>c.s===q.trump),'twinner none: no Trumpf in the trick');
  if(q.v==='led')ok(q.cards[0].s===q.trump,'twinner led: Trumpf leads');
  q=api.qTValue();ok(q.answer===refPts(q.cards[0],q.trump)&&q.options.some(o=>o.id===q.answer),'tvalue');
  for(const last of [false,true]){q=api.qTCount(last);ok(q.cards.length===4&&uniq(q.cards)&&q.answer===q.cards.reduce((n,c)=>n+refPts(c,q.trump),0)+(last?5:0)&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer)&&q.last===last&&/last trick/.test(q.prompt)===last,'tcount '+last)}
  for(const scn of ['free','trumpled','under'])for(const n of [5,6,8]){
    q=api.qTLegal(scn,n);seen[scn+':'+q.note]=(seen[scn+':'+q.note]||0)+1;
    ok(uniq(q.hand.concat(q.cards))&&q.hand.length>=3&&q.hand.length<=n&&J(q.answer)===J(refLegal(q.hand,q.cards,q.trump))&&q.led===q.cards[0].s&&q.explain.length>20,'tlegal '+scn+' '+q.note);
    const trumps=q.hand.filter(c=>c.s===q.trump);
    if(scn==='free')ok(q.led!==q.trump&&!q.cards.some(c=>c.s===q.trump)&&trumps.length>0&&trumps.every(c=>q.answer.includes(q.hand.indexOf(c))),'tlegal free: every Trumpf is allowed');
    if(scn==='trumpled')ok(q.led===q.trump,'tlegal trumpled: Trumpf leads');
    if(q.note==='puur')ok(trumps.length===1&&trumps[0].r==='U'&&q.answer.length===q.hand.length,'tlegal puur: everything allowed');
    if(q.note==='under')ok(q.under.length>0&&q.under.every(i=>q.hand[i].s===q.trump&&!q.answer.includes(i))&&q.hand.some(c=>c.s!==q.trump),'tlegal under: a lower Trumpf is in the hand and is not allowed');
    if(q.note==='onlytrumpf')ok(q.hand.every(c=>c.s===q.trump)&&q.answer.length===q.hand.length&&q.under.length===0,'tlegal only Trumpf: everything allowed');
  }
}
for(const k of ['free:choice','free:void','trumpled:puur','trumpled:many','trumpled:one','trumpled:none','under:under','under:onlytrumpf'])ok(seen[k]>50,'scenario occurs: '+k+' ('+(seen[k]||0)+')');
api.MC_POINTS.forEach((m,i)=>{const q=api.qMC(api.MC_POINTS,i);ok(q.options[q.answer].label===m.options[m.answer]&&q.hint.length>5,'mc '+i)});
ok(api.MC_POINTS[1].options[api.MC_POINTS[1].answer]==='62'&&api.MC_POINTS[2].options[api.MC_POINTS[2].answer]==='157','mc numbers: 62 and 157');

// ------------------------------------------------------------ Ansagen, Schieben and a whole round (chapter 2, part 2)
// The rule of thumb for Vorhand, written out a second time, independently of the app.
function refPattern(hand,s){
  const mine=hand.filter(c=>c.s===s).map(c=>c.r),has=r=>mine.includes(r),sideAces=hand.filter(c=>c.s!==s&&c.r==='A').length;
  if(has('U')&&has('9')&&has('A'))return 3;
  if(has('U')&&mine.length>=4)return 1;
  if(has('9')&&has('A')&&mine.length>=5)return 2;
  if(has('U')&&has('9')&&mine.length>=3&&sideAces>=2)return 4;
  return 0;
}
const H=str=>str.trim().split(/\s+/).map(x=>{const [s,r]=x.split(':');return C({e:'eichle',r:'rose',s:'schelle',t:'schilte'}[s],r)});
const SU=api.SUITS.map(x=>x.id),len=(h,s)=>h.filter(c=>c.s===s).length;
ok(api.announcePattern(H('s:U s:K s:8 s:6 r:A r:7 e:K e:9 t:8'),'schelle')===1,'Puur with three more: name it');
ok(api.announcePattern(H('s:U s:K s:8 r:A r:7 r:6 e:K e:9 t:8'),'schelle')===0,'Puur with only two more: not enough');
ok(api.announcePattern(H('r:9 r:A r:K r:8 r:6 e:K e:7 t:8 s:6'),'rose')===2,'Nell and Ass with three more: name it');
ok(api.announcePattern(H('r:9 r:A r:K r:8 e:6 e:K e:7 t:8 s:6'),'rose')===0,'Nell and Ass with only two more: not enough');
ok(api.announcePattern(H('t:U t:9 t:A e:K e:7 e:6 s:8 s:6 r:7'),'schilte')===3,'Puur, Nell and Ass: name it');
ok(api.announcePattern(H('t:U t:9 t:7 e:A e:7 e:6 s:A s:6 r:7'),'schilte')===4,'Puur, Nell and one more with two Asses elsewhere: name it');
ok(api.announcePattern(H('t:U t:9 t:7 e:A e:7 e:6 s:K s:6 r:7'),'schilte')===0,'Puur, Nell and one more with one Ass elsewhere: not enough');
ok(api.announceAdvice(H('e:A e:O e:7 r:K r:8 s:B s:6 t:O t:7'))===null,'a hand without Puur or Nell: push');
ok(api.bestSuit(H('t:U t:9 t:A t:8 r:A r:6 s:K e:8 e:6'))==='schilte','after a push the partner names the long suit with Puur and Nell');
ok(api.bestSuit(H('e:K e:O e:8 e:7 e:6 r:U r:9 s:A t:A'))==='eichle','after a push: five cards beat Puur and Nell alone');
// the two prepared deals of the first round
let d0=api.dealRound(0),d1=api.dealRound(1);
ok(d0.every(h=>h.length===9)&&uniq([].concat(...d0))&&api.announceAdvice(d0[0]).suit==='schelle'&&refPattern(d0[0],'schelle')===1,'first deal: you hold the Puur of Schelle with three more');
ok(d1.every(h=>h.length===9)&&uniq([].concat(...d1))&&api.announceAdvice(d1[0])===null&&SU.every(s=>refPattern(d1[0],s)===0)&&api.bestSuit(d1[2])==='schilte','second deal: a hand to push, and the partner names Schilte');
for(let i=0;i<3000;i++){
  for(const w of [1,2,3,4]){
    const q=api.qAnnounce(w),pats=SU.filter(s=>refPattern(q.cards,s));
    ok(q.cards.length===9&&uniq(q.cards)&&pats.length===1&&pats[0]===q.answer&&refPattern(q.cards,q.answer)===w&&q.options.length===5&&q.options.some(o=>o.id==='push')&&SU.every(s=>q.options.some(o=>o.id===s))&&q.explain.includes(api.SUITS.find(x=>x.id===q.answer).name)&&q.explain.includes(api.PATTERN_TEXT[w]),'announce pattern '+w);
    ok(SU.every(s=>s===q.answer||len(q.cards,s)<=4),'announce: no long side suit');
  }
  let q=api.qAnnounce('push');
  ok(q.cards.length===9&&uniq(q.cards)&&q.answer==='push'&&SU.every(s=>refPattern(q.cards,s)===0&&len(q.cards,s)<=4)&&/push/.test(q.explain),'announce: a hand to push');
  q=api.qPushed();
  const L5=len(q.cards,q.answer);
  ok(q.cards.length===9&&uniq(q.cards)&&q.options.length===4&&SU.every(s=>s===q.answer||len(q.cards,s)<L5)&&q.cards.some(c=>c.s===q.answer&&'U9'.includes(c.r))&&!q.cards.some(c=>c.s!==q.answer&&'U9'.includes(c.r))&&L5>=4,'pushed: the long suit with Puur or Nell');
  q=api.qMC(api.MC_VORHAND,i,true);const m=api.MC_VORHAND[i%api.MC_VORHAND.length];
  ok(q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.find(o=>o.id===q.answer).label===m.options[m.answer]&&q.hint.length>5&&q.explain.length>20,'mc Vorhand');
}
// whole rounds: every card every player puts down is checked against the reference rules
let matches=0,ownWins=0;
for(let k=0;k<3000;k++){
  const hands=api.dealRound(k<2?k:9),leader=k%2?rnd(4):0,st=api.newRound(hands,leader);
  st.trump=k%3?api.bestSuit(hands[rnd(4)]):SU[rnd(4)];
  const seen=[];let sum=0,bad=false;
  for(let n=0;n<9&&!bad;n++){
    const lead=st.leader;
    for(let j=0;j<4;j++){
      const seat=st.turn;ok(seat===(lead+j)%4,'round: play runs counter-clockwise from the leader');
      const hand=st.hands[seat],legal=st.trick.length?refLegal(hand,st.trick,st.trump):hand.map((_,i)=>i);
      const idx=seat===0&&k%4===0?legal[rnd(legal.length)]:api.botMove(st,seat);   // in every fourth round seat 0 plays any legal card, like a learner
      if(!legal.includes(idx)){ok(false,'round: illegal card '+J({seat,hand,trick:st.trick,trump:st.trump,idx}));bad=true;break}
      seen.push(hand[idx]);
      ok(api.roundPlay(st,seat,idx)===(j===3),'round: trick is complete after four cards');
    }
    if(bad)break;
    const cards=st.trick.slice(),w=(lead+refWinner(cards,st.trump))%4,pts=cards.reduce((a,c)=>a+refPts(c,st.trump),0)+(n===8?5:0);
    const t=api.roundCloseTrick(st);sum+=pts;
    ok(t.winner===w&&t.points===pts&&st.leader===w&&st.turn===w&&st.trick.length===0,'round: winner and points of trick '+(n+1));
  }
  if(bad)break;
  ok(seen.length===36&&uniq(seen)&&st.hands.every(h=>h.length===0)&&st.done.length===9,'round: all 36 cards are played once');
  ok(sum===157&&st.score[0]+st.score[1]===157&&st.won[0]+st.won[1]===9,'round: 157 points and nine tricks');
  if(st.won[0]===9||st.won[1]===9)matches++;
  if(st.won[0]>st.won[1])ownWins++;
}
ok(matches<300,'a Match stays rare ('+matches+' of 3000 rounds)');
console.log('rounds: team of seat 0 took more tricks in '+ownWins+' of 3000, Match in '+matches);
// the first prepared deal is winnable: with Schelle as Trumpf and sensible play your team takes the majority of the points
{let good=0;for(let k=0;k<200;k++){const st=api.newRound(api.dealRound(0),0);st.trump='schelle';for(let n=0;n<9;n++){for(let j=0;j<4;j++)api.roundPlay(st,st.turn,api.botMove(st,st.turn));api.roundCloseTrick(st)}if(st.score[0]>st.score[1])good++}
 console.log('first deal, Schelle named, played by the app itself: your team is ahead in '+good+' of 200');ok(good>=100,'first deal is a fair start ('+good+' of 200)')}
for(const st of api.STAGES)for(const ls of st.lessons){if(ls.round)continue;for(let i=0;i<ls.n;i++){const q=ls.gen(i);ok(q&&q.prompt&&q.explain,'lesson gen')}}
ok(api.STAGES.length===9&&api.STAGES[5].lessons.length===4&&api.STAGES[6].lessons.length===1&&api.STAGES[6].lessons[0].round===true&&api.STAGES[7].lessons.length===5&&api.STAGES[8].lessons.length===5&&api.STAGES[7].ch===3&&api.STAGES[8].ch===3,'nine stages: the round is stage 7, chapter 3 has stages 8 and 9');

// ------------------------------------------------------------ chapter 3: Bock, counting, team play
// Bock, written out independently: every stronger card of the same suit has been played.
const refBock=(c,gone,t)=>{const o=c.s===t?TO:PO;return o.slice(0,o.indexOf(c.r)).split('').every(r=>gone.some(g=>g.s===c.s&&g.r===r))};
const key=c=>c.s+c.r,inHand=(h,s,r)=>h.some(c=>c.s===s&&c.r===r);
ok(api.isBock(C('rose','K'),[C('rose','A')],null)&&!api.isBock(C('rose','O'),[C('rose','A')],null)&&api.isBock(C('rose','A'),[],null),'Bock: König after the Ass is gone, an Ass always');
ok(api.isBock(C('rose','9'),[C('rose','U')],'rose')&&!api.isBock(C('rose','A'),[C('rose','U')],'rose')&&!api.isBock(C('rose','9'),[C('rose','A')],null),'highest Trumpf: Nell after the Puur; a plain 9 is far from Bock');
ok(api.isBock(C('rose','U'),[C('rose','A'),C('rose','K'),C('rose','O')],null)&&!api.isBock(C('rose','B'),[C('rose','A'),C('rose','K'),C('rose','O')],null),'plain suit: the Under ranks above the Banner');
const scnSeen={};
for(let i=0;i<3000;i++){
  for(const tr of [false,true]){
    const q=api.qBock(tr),a=q.cards[q.answer],o=tr?TO:PO,all=q.cards.concat(q.gone);
    ok(q.cards.length===4&&uniq(all)&&all.every(c=>c.s===q.suit)&&(tr?q.trump===q.suit:!q.trump)&&refBock(a,q.gone,q.trump||null)&&q.cards.every(c=>c===a||o.indexOf(c.r)>o.indexOf(a.r))&&q.explain.length>30,'bock '+(tr?'Trumpf':'plain'));
  }
  let q=api.qMyBock();
  const bocks=q.hand.map((c,k)=>refBock(c,q.gone,null)?k:-1).filter(k=>k>=0);
  ok(q.hand.length===3&&new Set(q.hand.map(c=>c.s)).size===3&&uniq(q.hand.concat(q.gone))&&q.gone.length>=1&&q.gone.length<=5&&bocks.length===1&&J(q.answer)===J(bocks)&&q.single===true,'mybock: exactly one card of the hand is Bock');
  q=api.qTrumpCount();
  ok(uniq(q.gone.concat(q.mine))&&q.gone.concat(q.mine).every(c=>c.s===q.trump)&&q.gone.length>=1&&q.answer===9-q.gone.length-q.mine.length&&q.answer>=1&&q.options.length===4&&new Set(q.options.map(x=>x.id)).size===4&&q.options.some(x=>x.id===q.answer)&&q.explain.includes('= '+q.answer+'.'),'trumpcount');
  q=api.qRead();ok(q.cards.length===1&&q.answer===q.cards[0].s&&'678'.includes(q.cards[0].r)&&q.options.length===4,'read your partner');
  for(const make of [api.qDraw,api.qCash,()=>api.qSmear(true),()=>api.qSmear(false),api.qDiscard,api.qPull]){
    q=make();scnSeen[q.scn]=(scnSeen[q.scn]||0)+1;
    const h=q.hand,t=q.trump,tk=q.cards,legal=tk.length?refLegal(h,tk,t):h.map((_,k)=>k),good=q.answer,pts=k=>refPts(h[k],t);
    ok(q.type==='best'&&q.single===true&&uniq(h.concat(tk))&&J(q.legal)===J(legal)&&good.length>=1&&good.every(k=>legal.includes(k))&&(tk.length?q.winning===refWinner(tk,t)&&q.led===tk[0].s&&q.seats.length===3:q.winning===-1)&&q.hint.length>20&&q.explain.length>40,'best '+q.scn+': legal cards and the trick winner agree with the reference');
    if(q.scn==='draw')ok(h.length===9&&tk.length===0&&h.filter(c=>c.s===t).length===4&&good.length===1&&h[good[0]].s===t&&h[good[0]].r==='U'&&h.some(c=>c.s!==t&&c.r==='A'),'draw: four Trumpf with the Puur and an Ass to protect; the Puur is led');
    if(q.scn==='cash')ok(h.length===5&&tk.length===0&&/no Trumpf left/.test(q.info)&&J(good)===J(h.map((c,k)=>c.s!==t&&c.r==='A'?k:-1).filter(k=>k>=0))&&good.length===1&&h.some(c=>c.s===t)&&h.every((c,k)=>good.includes(k)||refPts(c,t)<11),'cash: the plain Ass is the only 11-point card and nobody can trump it');
    if(q.scn==='smearA'||q.scn==='smearB'){
      const X=tk[0].s,A=q.scn==='smearA';
      ok(h.length===4&&tk.length===3&&X!==t&&tk.every(c=>c.s===X)&&!h.some(c=>c.s===t)&&legal.length===2&&legal.every(k=>h[k].s===X)&&(refWinner(tk,t)===1)===A&&tk[refWinner(tk,t)].r==='A'&&good.length===1,'smear: you are last, two cards of the suit, no Trumpf anywhere, the Ass wins');
      const other=legal.find(k=>k!==good[0]);
      ok(A?pts(good[0])>pts(other)&&pts(good[0])>=3:pts(good[0])===0&&pts(other)>=3,'smear: '+(A?'the valuable card goes to the partner':'the worthless card goes to the others'));
    }
    if(q.scn==='discard'){
      const Ld=tk[0].s,w=refWinner(tk,t),Y=h[good[0]].s;
      ok(h.length===5&&tk.length===3&&Ld!==t&&w!==1&&!h.some(c=>c.s===Ld||c.s===t)&&legal.length===5&&good.length===2&&good.every(k=>h[k].s===Y&&pts(k)===0)&&h.filter(c=>c.s!==Y).length===3&&h.filter(c=>c.s!==Y).every(c=>refPts(c,t)>=4)&&new Set(h.filter(c=>c.s!==Y).map(c=>c.s)).size===1,'discard: the trick is lost, the two worthless cards of the weak suit are the ones to throw');
    }
    if(q.scn==='pull'){
      const c=h[good[0]];
      ok(h.length===5&&tk.length===0&&good.length===1&&!h.some(x=>x.s===t)&&'876'.includes(c.r)&&inHand(h,c.s,'K')&&inHand(h,c.s,'O')&&!inHand(h,c.s,'A')&&h.filter(x=>x.s===c.s).length===3&&h.filter(x=>x.s!==c.s).every(x=>'U98'.includes(x.r))&&q.info.includes('Ass of'),'pull: the low card under König and Ober is led');
    }
  }
}
for(const k of ['draw','cash','smearA','smearB','discard','pull'])ok(scnSeen[k]===3000,'scenario occurs: '+k);
console.log(fail?fail+' failures':'all logic checks passed ('+count+' checks)');
