const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const logic=html.split('/*LOGIC-START*/')[1].split('/*LOGIC-END*/')[0];
const api=new Function(logic+';return {SUITS,RANKS,trickWinner,legalCards,trickPoints,points,qSuit,qPick,qBridge,qNumber,qStronger,qWinner,qLegal,qValue,qCount,STAGES,deck,trickWinnerT,pointsT,legalT,qTPick,qTStronger,qTWinner,qTValue,qTCount,qMC,MC_POINTS,qTLegal,announcePattern,announceAdvice,bestSuit,qAnnounce,qPushed,MC_VORHAND,dealRound,newRound,roundPlay,roundCloseTrick,botCard,botMove,PATTERN_TEXT,isBock,qBock,qMyBock,qTrumpCount,qDraw,qCash,qSmear,qDiscard,qRead,qPull,pointsM,trickWinnerM,orderM,qMWinner,qMStronger,qMValue,qMCount,findWeis,weisCompare,qWeisFind,qWeisCmp,qWeisWrite,qStoeck,MC_WEIS,FACTOR,qFactor,qWrite,qMatchYN,MC_MATCH,MC_END,sureTricks,qSure,qGame,qLeadT,qLeadNoT,qLeadM,newGame,gameDeal,gameHands,botCall,botCallPushed,gameSetGame,gamePlay,gameScore,gameApply,gameFirst,weisOutcome,weisBetter,gameRun,gameHas,gameOrder,leadAdvice};')();
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
for(const st of api.STAGES)for(const ls of st.lessons){if(ls.round||ls.game)continue;for(let i=0;i<ls.n;i++){const q=ls.gen(i);ok(q&&q.prompt&&q.explain,'lesson gen')}}
ok(api.STAGES.length===14&&api.STAGES[11].lessons.length===5&&api.STAGES[11].ch===4&&api.STAGES[5].lessons.length===4&&api.STAGES[6].lessons.length===1&&api.STAGES[6].lessons[0].round===true&&api.STAGES[7].lessons.length===5&&api.STAGES[8].lessons.length===5&&api.STAGES[7].ch===3&&api.STAGES[8].ch===3&&api.STAGES[9].lessons.length===6&&api.STAGES[10].lessons.length===5&&api.STAGES[9].ch===4&&api.STAGES[10].ch===4,'the first twelve stages: the round is stage 7, chapter 3 has stages 8 and 9, chapter 4 has stages 10 to 12');

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
  q=api.qRead();ok(q.cards.length===1&&q.answer===q.cards[0].s&&'678'.includes(q.cards[0].r)&&q.options.length===4&&q.kind==='signal','read your partner');
  for(const make of [api.qDraw,api.qCash,()=>api.qSmear(true),()=>api.qSmear(false),api.qDiscard,api.qPull]){
    q=make();scnSeen[q.scn]=(scnSeen[q.scn]||0)+1;
    const h=q.hand,t=q.trump,tk=q.cards,legal=tk.length?refLegal(h,tk,t):h.map((_,k)=>k),good=q.answer,pts=k=>refPts(h[k],t);
    ok(q.type==='best'&&q.single===true&&uniq(h.concat(tk))&&J(q.legal)===J(legal)&&good.length>=1&&good.every(k=>legal.includes(k))&&(tk.length?q.winning===refWinner(tk,t)&&q.led===tk[0].s&&q.seats.length===3:q.winning===-1)&&q.hint.length>20&&q.explain.length>40,'best '+q.scn+': legal cards and the trick winner agree with the reference');
    if(q.scn==='draw')ok(h.length===9&&tk.length===0&&h.filter(c=>c.s===t).length===4&&good.length===1&&h[good[0]].s===t&&h[good[0]].r==='U'&&h.some(c=>c.s!==t&&c.r==='A')&&!inHand(h,t,'9')&&q.kind==='tactic','draw: four Trumpf with the Puur but without the Nell, and an Ass to protect; the Puur is led');
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
ok(api.qDiscard().kind==='signal'&&api.qPull().kind==='both'&&api.qSmear(true).kind==='tactic'&&api.qCash().kind==='tactic','every situation says whether it is a tactic or a signal');

// ------------------------------------------------------------ chapter 4: Obenabe, Undenufe, Weis, Stöck
// Reference tables, typed in by hand from the rule base, strongest card first.
const REF={oben:{order:'AKOUB9876',pts:{A:11,K:4,O:3,U:2,B:10,'9':0,'8':8,'7':0,'6':0}},unde:{order:'6789BUOKA',pts:{'6':11,'7':0,'8':8,'9':0,B:10,U:2,O:3,K:4,A:0}}};
const refWinM=(cs,m)=>cs.map((c,i)=>[c,i]).filter(x=>x[0].s===cs[0].s).sort((a,b)=>REF[m].order.indexOf(a[0].r)-REF[m].order.indexOf(b[0].r))[0][1];
for(const m of ['oben','unde']){
  ok(api.orderM(m).join('')===REF[m].order,'order of '+m);
  ok(api.deck().reduce((n,c)=>n+api.pointsM(c,m),0)===152&&Object.keys(REF[m].pts).every(r=>api.pointsM(C('rose',r),m)===REF[m].pts[r])&&Object.values(REF[m].pts).reduce((a,b)=>a+b,0)===38,'points of '+m+': 38 a suit, 152 in all');
}
ok(api.trickWinnerM([C('rose','K'),C('rose','7'),C('schelle','A'),C('rose','O')],'oben')===0&&api.trickWinnerM([C('rose','K'),C('rose','7'),C('schelle','6'),C('rose','O')],'unde')===1,'same trick, two games: König wins in Obenabe, the 7 in Undenufe');
// Weis, found a second way: look at every window of consecutive ranks and every rank across the four suits
function refWeis(hand){
  const order='AKOUB9876',out=[],has=(s,r)=>hand.some(c=>c.s===s&&c.r===r);
  for(const s of SU){
    for(let a=0;a<9;a++)for(let b=a+2;b<9;b++){
      const all=order.slice(a,b+1).split('').every(r=>has(s,r)),before=a>0&&has(s,order[a-1]),after=b<8&&has(s,order[b+1]);
      if(all&&!before&&!after)out.push({pts:{3:20,4:50,5:100,6:150,7:200,8:250,9:300}[b-a+1],keys:order.slice(a,b+1).split('').map(r=>s+r)});
    }
  }
  for(const r of 'AKOUB9876')if(SU.every(s=>has(s,r)))out.push({pts:r==='U'?200:r==='9'?150:100,keys:SU.map(s=>s+r)});
  return out;
}
ok(api.findWeis(H('r:A r:K r:O e:7 e:6 s:U t:U t:8 s:9')).map(w=>w.pts).join()==='20','Ass, König, Ober: three in a row, 20');
ok(api.findWeis(H('r:7 r:6 r:A e:K e:O s:U t:U t:8 s:9')).length===0,'7, 6, Ass is round the corner: no Weis');
ok(api.findWeis(H('r:U e:U s:U t:U r:9 e:9 s:9 t:9 r:A')).map(w=>w.pts).sort().join()==='150,200','four Under 200 and four nines 150');
ok(api.findWeis(H('r:8 e:8 s:8 t:8 r:A e:K s:O t:6 r:6')).map(w=>w.pts).join()==='100','four eights: 100, like any four of a kind');
ok(api.findWeis(H('r:6 e:6 s:6 t:6 r:A e:K s:O t:9 r:9')).map(w=>w.pts).join()==='100'&&api.findWeis(H('r:7 e:7 s:7 t:7 r:A e:K s:O t:9 r:9')).map(w=>w.pts).join()==='100','four sixes and four sevens: 100 each');
ok(api.findWeis(H('r:A r:K r:O r:U r:B r:9 r:8 r:7 r:6'))[0].pts===300,'nine in a row: 300');
for(let k=0;k<20000;k++){const h=api.deck().sort(()=>Math.random()-.5).slice(0,9),a=api.findWeis(h).map(w=>w.pts+':'+w.cards.map(key).sort().join()).sort(),b=refWeis(h).map(w=>w.pts+':'+w.keys.sort().join()).sort();if(J(a)!==J(b)){ok(false,'findWeis differs from the reference '+J({h,a,b}));break}}
const W=(str,kind)=>{const cards=H(str);return kind==='four'?{kind:'four',top:cards[0].r,len:4,pts:{U:200,'9':150}[cards[0].r]||100,cards}:{kind:'seq',suit:cards[0].s,top:cards[0].r,len:cards.length,pts:{3:20,4:50,5:100}[cards.length],cards}};
ok(api.weisCompare(W('r:9 r:8 r:7 r:6'),W('e:A e:K e:O'),'schelle')===1,'Weis: 50 beats 20');
ok(api.weisCompare(W('r:B r:9 r:8 r:7 r:6'),W('r:A e:A s:A t:A','four'),'schelle')===1,'Weis: at 100 each, a row beats four of a kind');
ok(api.weisCompare(W('r:K r:O r:U'),W('e:A e:K e:O'),'schelle')===-1,'Weis: equal rows, the higher top card wins');
ok(api.weisCompare(W('r:K r:O r:U'),W('e:K e:O e:U'),'eichle')===-1&&api.weisCompare(W('r:K r:O r:U'),W('e:K e:O e:U'),'schelle')===0,'Weis: equal rows, the Trumpf suit wins; otherwise the order of play decides');
ok(api.weisCompare(W('e:U s:U t:U r:U','four'),W('r:A r:K r:O'),'schelle')===1&&api.weisCompare(W('e:9 s:9 t:9 r:9','four'),W('e:A s:A t:A r:A','four'),'schelle')===1,'Weis: four Under beat a short row, four nines beat four Asses');
const seenW={},seenS={};
for(let i=0;i<3000;i++){
  for(const m of ['oben','unde']){
    let q=api.qMWinner(m);
    ok(q.cards.length===4&&uniq(q.cards)&&q.led===q.cards[0].s&&q.answer===refWinM(q.cards,m)&&q.cards.some(c=>c.s!==q.led)&&q.mode===m&&q.cards[q.answer].s===q.led,'mwinner '+m);
    q=api.qMStronger(m);ok(q.cards.length===2&&q.cards[0].s===q.cards[1].s&&q.cards[0].r!==q.cards[1].r&&q.answer===refWinM(q.cards,m),'mstronger '+m);
    q=api.qMValue(m);ok(q.answer===REF[m].pts[q.cards[0].r]&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer),'mvalue '+m);
    q=api.qMCount(m);ok(q.cards.length===4&&uniq(q.cards)&&q.answer===q.cards.reduce((n,c)=>n+REF[m].pts[c.r],0)&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer)&&q.options.every(o=>o.id>=0),'mcount '+m);
  }
  for(const kind of ['seq3','seq4','seq5','four','foursmall','none','three']){
    const q=api.qWeisFind(kind),ws=refWeis(q.cards);
    if(kind==='foursmall')ok(q.answer===100&&'876'.split('').some(r=>q.cards.filter(c=>c.r===r).length===4)&&/older rule/.test(q.explain),'weisfind foursmall: four 8, 7 or 6 are worth 100, and the older rule is named');
    ok(q.cards.length===9&&uniq(q.cards)&&ws.length<=1&&q.answer===(ws[0]?ws[0].pts:0)&&q.options.some(o=>o.id===q.answer)&&J(q.mark.map(k=>key(q.cards[k])).sort())===J(ws[0]?ws[0].keys.sort():[])&&(kind==='none'||kind==='three'?q.answer===0:q.answer>=20),'weisfind '+kind);
    if(kind==='three')ok('AKOUB9'.split('').some(r=>q.cards.filter(c=>c.r===r).length===3),'weisfind three: three of a kind are in the hand');
    seenW[q.answer]=(seenW[q.answer]||0)+1;
  }
  for(const v of ['value','kind','top','trump']){
    const q=api.qWeisCmp(v),a=refWeis(q.mine),b=refWeis(q.theirs);
    ok(uniq(q.mine.concat(q.theirs))&&a.length===1&&b.length===1&&a[0].keys.length===q.mine.length&&b[0].keys.length===q.theirs.length,'weiscmp '+v+': each side shows exactly one Weis');
    // who is higher, decided here step by step
    const top=cs=>Math.min(...cs.map(c=>'AKOUB9876'.indexOf(c.r))),isSeq=cs=>new Set(cs.map(c=>c.s)).size===1;
    let win=a[0].pts!==b[0].pts?(a[0].pts>b[0].pts?'mine':'theirs'):isSeq(q.mine)!==isSeq(q.theirs)?(isSeq(q.mine)?'mine':'theirs'):top(q.mine)!==top(q.theirs)?(top(q.mine)<top(q.theirs)?'mine':'theirs'):q.mine[0].s===q.trump?'mine':q.theirs[0].s===q.trump?'theirs':'nobody';
    ok(q.answer===win,'weiscmp '+v+': the higher Weis is '+win);
    if(v==='kind')ok(a[0].pts===100&&b[0].pts===100&&isSeq(q.mine)!==isSeq(q.theirs),'weiscmp kind: 100 against 100, row against four');
    if(v==='trump')ok(top(q.mine)===top(q.theirs)&&q.mine.length===q.theirs.length&&(q.mine[0].s===q.trump)!==(q.theirs[0].s===q.trump),'weiscmp trump: only the Trumpf suit tells them apart');
  }
  let q=api.qWeisWrite();
  ok(Math.max(q.a,q.b)!==q.c&&q.answer===(Math.max(q.a,q.b)>q.c?q.a+q.b:0)&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer)&&q.lines.length===3,'weiswrite: only the team with the highest single Weis writes, and then everything');
  for(const v of ['yes','othersuit','split','oben']){
    q=api.qStoeck(v);const t=q.trump,both=!!t&&q.cards.some(c=>c.s===t&&c.r==='K')&&q.cards.some(c=>c.s===t&&c.r==='O');
    ok(q.cards.length===5&&uniq(q.cards)&&q.answer===(both?'yes':'no')&&(v==='yes')===both&&(v==='oben'?!q.trump&&!!q.mode:!!q.trump&&!q.mode)&&q.cards.filter(c=>c.r==='K').length===1&&q.cards.filter(c=>c.r==='O').length===1,'stoeck '+v);
    seenS[v+':'+q.answer]=1;
  }
}
ok([0,20,50,100,150,200].every(v=>seenW[v]>50),'every Weis value occurs: '+J(seenW));
ok(Object.keys(seenS).sort().join()==='oben:no,othersuit:no,split:no,yes:yes','Stöck: one yes, three kinds of no');
// ------------------------------------------------------------ the slate (stage 12)
const REF_F={eichle:1,rose:1,schelle:2,schilte:2,oben:3,unde:3};     // typed in by hand: Undenufe counts triple at this table
ok(J(api.FACTOR)===J(REF_F),'factors: Eichle and Rose single, Schelle and Schilte double, Obenabe and Undenufe triple');
const gameOf=q=>q.mode||q.trump,seenG={};
for(let i=0;i<3000;i++){
  let q=api.qFactor();seenG[gameOf(q)]=1;
  ok(q.answer===REF_F[gameOf(q)]&&q.options.map(o=>o.id).join()==='1,2,3'&&(!!q.mode)!==(!!q.trump)&&q.game===gameOf(q),'factor');
  for(const v of ['plain','weis','stoeck','match']){
    q=api.qWrite(v);const f=REF_F[gameOf(q)],nums=q.lines.join(' ').match(/<b>(\d+)<\/b>/g)||[];
    const shown=nums.map(x=>+x.replace(/\D/g,'')).reduce((a,b)=>a+b,0),base=v==='match'?257:shown;
    ok(q.answer===base*f&&(v==='match'?/all nine tricks/.test(q.lines[0])&&nums.length===0:nums.length===(v==='plain'?1:2))&&(v!=='stoeck'||(!!q.trump&&/Stöck: <b>20<\/b>/.test(q.lines[1])))&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===q.answer)&&q.options.every(o=>o.id>=0)&&q.explain.includes(String(q.answer)),'write '+v+': everything the team made, times the factor');
  }
  for(const v of ['yes','zero','close']){
    q=api.qMatchYN(v);const mine=+q.lines[0].match(/(\d+) tricks/)[1];
    ok(q.answer===(mine===9?'yes':'no')&&(v==='yes')===(mine===9)&&q.tricks[0]+q.tricks[1]===9,'match '+v+': only nine tricks make a Match');
  }
}
ok(Object.keys(seenG).length===6,'all six games occur');
ok(257*3===771&&api.MC_MATCH[2].options[0]==='771'&&api.MC_MATCH[1].options[0]==='257','Match: 257, and 771 in a triple game');
for(const list of [api.MC_MATCH,api.MC_END])list.forEach((m,i)=>{const q=api.qMC(list,i,true);ok(m.answer===0&&q.options.length===4&&q.options.find(o=>o.id===q.answer).label===m.options[0]&&q.hint.length>5&&q.explain.length>20,'mc slate '+i)});
ok(api.MC_END.length===8&&/Stöck, then Weis, then tricks/.test(api.MC_END[2].options[0])&&/first trick/.test(api.MC_END[2].prompt),'the order at the end: Stöck, Weis, Stich, in the first trick');
ok(api.MC_END[1].options[0]==='2500'&&/1000/.test(api.MC_END[1].explain)&&/1000/.test(api.MC_END[0].explain)&&/2500/.test(api.MC_END[0].explain),'the total: 1000 without factors, 2500 with');
ok(/as soon as we have enough/.test(api.MC_END[5].options[0])&&/lost/.test(api.MC_END[5].explain),'thanking in the middle of a round is allowed, and wrong thanks lose');
ok(/257/.test(api.MC_MATCH[0].explain),'a Kontermatch counts like a Match');
api.MC_WEIS.forEach((m,i)=>{const q=api.qMC(api.MC_WEIS,i,true);ok(q.options.find(o=>o.id===q.answer).label===m.options[0]&&m.answer===0&&q.options.length===4,'mc Weis '+i)});
// ---- Chapter 5: sure tricks, which game to name, the first card after a push. Everything is worked out here a second way.
const TOPDOWN='AKOUB9876',BOTTOMUP='6789BUOKA',TRUMPS='U9AKOB876';     // typed in by hand
function refSure(hand,m){                // walk down each suit until the first card that is missing
  const order=m==='unde'?BOTTOMUP:TOPDOWN;let n=0;
  for(const s of SU)for(const r of order){if(!hand.some(c=>c.s===s&&c.r===r))break;n++}
  return n;
}
for(let k=0;k<20000;k++){const h=api.deck().sort(()=>Math.random()-.5).slice(0,9);let bad=false;for(const m of ['oben','unde'])if(api.sureTricks(h,m)!==refSure(h,m)){ok(false,'sureTricks differs from the reference '+J({h,m}));bad=true}if(bad)break}
ok(api.sureTricks(H('r:A r:K r:O e:K e:O s:A s:O t:7 t:6'),'oben')===4&&api.sureTricks(H('r:A r:K r:O e:K e:O s:A s:O t:7 t:6'),'unde')===2,'Ass, König, Ober and a lone Ass: four from the top. 6 and 7: two from the bottom');
ok(api.sureTricks(H('r:K r:O r:U e:A e:O e:U s:9 t:8 t:7'),'oben')===1&&api.sureTricks(H('r:K r:O r:U e:A e:O e:U s:9 t:8 t:7'),'unde')===0,'no Ass, no sure trick; a gap ends the count; a 7 without the 6 is nothing');
const seenSure={},seenLead={};
const wouldPush=h=>SU.every(s=>refPattern(h,s)===0)&&refSure(h,'oben')<=3&&refSure(h,'unde')<=3;
for(let k=0;k<3000;k++){
  for(const m of ['oben','unde']){
    const q=api.qSure(m),n=refSure(q.cards,m),order=m==='unde'?BOTTOMUP:TOPDOWN;
    const sure=q.cards.map((c,i)=>{for(const r of order){if(r===c.r)return i;if(!inHand(q.cards,c.s,r))return -1}return -1}).filter(i=>i>=0);
    ok(q.cards.length===9&&uniq(q.cards)&&q.mode===m&&q.answer===n&&J(q.mark)===J(sure)&&sure.length===n&&q.options.length===4&&new Set(q.options.map(o=>o.id)).size===4&&q.options.some(o=>o.id===n)&&q.options.every(o=>o.id>=0)&&n>=2&&n<=6&&/not sure|does not count/.test(q.explain),'sure '+m+': the count, the marked cards, and one card that only looks strong');
    seenSure[m+n]=1;
  }
  for(const w of ['oben','unde','trump','push']){
    const q=api.qGame(w),a=refSure(q.cards,'oben'),b=refSure(q.cards,'unde'),pats=SU.filter(s=>refPattern(q.cards,s));
    const mine=a>=5?'oben':b>=5?'unde':pats.length===1?'trump':pats.length?'ambiguous':'push';       // the rule of thumb, applied here
    ok(q.cards.length===9&&uniq(q.cards)&&q.answer===w&&mine===w&&!(a>=5&&b>=5)&&q.options.map(o=>o.id).join()==='trump,oben,unde,push'&&q.kind==='tactic','game '+w+': the rule of thumb gives exactly this answer '+J([a,b,pats]));
    if(w==='oben'||w==='unde')ok((w==='oben'?a:b)<=6&&(w==='oben'?b:a)<=1&&pats.length===0,'game '+w+': five or six sure tricks, next to nothing the other way, no Trumpf suit');
    else ok(a<=3&&b<=3,'game '+w+': at most three sure tricks either way');
    if(w==='trump')ok(q.explain.includes(api.SUITS.find(x=>x.id===pats[0]).name)&&q.suit===pats[0],'game trump: the explanation names the suit');
  }
  for(const v of ['best','puur2','ass3']){
    const q=api.qLeadT(v),t=q.trump,tr=q.hand.filter(c=>c.s===t).sort((x,y)=>TRUMPS.indexOf(x.r)-TRUMPS.indexOf(y.r)),good=q.answer.map(i=>q.hand[i]);
    const want=v==='best'?tr[0]:tr[1];
    ok(q.hand.length===9&&uniq(q.hand)&&q.type==='best'&&q.cards.length===0&&q.legal.length===9&&wouldPush(q.hand)&&good.length===1&&key(good[0])===key(want)&&/You pushed/.test(q.info)&&q.info.includes(api.SUITS.find(x=>x.id===t).name)&&q.kind==='tactic','lead '+v+': one best card, in a hand that would have pushed');
    if(v==='best')ok(tr.length>=2&&tr.length<=3&&'9KO'.includes(tr[0].r)&&tr.every(c=>!'UAB'.includes(c.r)),'lead best: two or three Trumpf without Puur, Ass or Banner, and the highest is led');
    if(v==='puur2')ok(tr.length===2&&tr[0].r==='U'&&!'9AB'.includes(tr[1].r),'lead puur2: the Puur and one small Trumpf, and the small one is led');
    if(v==='ass3')ok(tr.length===3&&tr[0].r==='A'&&tr.every(c=>!'U9B'.includes(c.r)),'lead ass3: the Ass and two more, and the second-highest is led');
    seenLead[q.scn]=1;
  }
  for(const v of ['puur1','none']){
    const q=api.qLeadNoT(v),t=q.trump,tr=q.hand.filter(c=>c.s===t),good=q.answer.map(i=>key(q.hand[i])).sort();
    const four=SU.filter(s=>s!==t&&len(q.hand,s)===4);
    const want=v==='puur1'?q.hand.filter(c=>c.s===four[0]&&'6789'.includes(c.r)):q.hand.filter(c=>'KOU'.includes(c.r));
    ok(q.hand.length===9&&uniq(q.hand)&&q.cards.length===0&&wouldPush(q.hand)&&J(good)===J(want.map(key).sort())&&good.length>=1&&q.kind==='both','lead '+v+': exactly the cards the convention asks for');
    if(v==='puur1')ok(tr.length===1&&tr[0].r==='U'&&four.length===1&&inHand(q.hand,four[0],'A')&&SU.every(s=>s===t||s===four[0]||(len(q.hand,s)===2&&!inHand(q.hand,s,'A')))&&good.length===2,'lead puur1: a lone Puur, one clearly strongest suit with the Ass, two low cards to choose from');
    if(v==='none')ok(tr.length===0&&good.length<=2&&q.hand.some(c=>c.r==='A')&&SU.every(s=>len(q.hand,s)<=4),'lead none: no Trumpf at all, one or two picture cards, an Ass as a decoy');
    seenLead[q.scn]=1;
  }
  for(const v of ['low','top'])for(const m of ['oben','unde']){
    const q=api.qLeadM(v,m),order=m==='unde'?BOTTOMUP:TOPDOWN,four=SU.filter(s=>len(q.hand,s)===4),X=four[0];
    const mineX=q.hand.filter(c=>c.s===X).sort((x,y)=>order.indexOf(x.r)-order.indexOf(y.r)),twoTop=inHand(q.hand,X,order[0])&&inHand(q.hand,X,order[1]);
    const want=twoTop?mineX[0]:mineX[3],good=q.answer.map(i=>q.hand[i]);
    ok(q.hand.length===9&&uniq(q.hand)&&q.mode===m&&!q.trump&&q.cards.length===0&&four.length===1&&wouldPush(q.hand)&&twoTop===(v==='top')&&good.length===1&&key(good[0])===key(want)&&SU.every(s=>s===X||!inHand(q.hand,s,order[0]))&&q.info.includes(m==='unde'?'Undenufe':'Obenabe'),'lead after a pushed '+m+' ('+v+'): '+(v==='top'?'the top card of the two':'the weakest card of the strongest suit'));
    if(v==='low')ok(inHand(q.hand,X,order[0])!==inHand(q.hand,X,order[1]),'lead low: exactly one of the two top cards in the strongest suit');
    seenLead[q.scn+m]=1;
  }
}
ok(Object.keys(seenSure).length>=8&&Object.keys(seenLead).length===9,'chapter 5: every kind of situation occurs '+J([Object.keys(seenSure).length,Object.keys(seenLead).length]));
ok(api.STAGES.length===14&&api.STAGES[12].ch===5&&api.STAGES[12].lessons.length===6&&api.STAGES[12].lessons[5].check===true&&api.STAGES[12].lessons.every(l=>!l.round),'chapter 5 holds stage 13 with five lessons and a check');
// ---- The whole game: every round of many games is replayed here against rules written a second time.
const GAME_IDS=['eichle','rose','schelle','schilte','oben','unde'];
const refCall=h=>{const a=refSure(h,'oben'),b=refSure(h,'unde');if(a>=5&&a>=b)return 'oben';if(b>=5)return 'unde';let best=null;for(const s of SU)if(refPattern(h,s)&&(!best||len(h,s)>len(h,best)))best=s;return best};
const refLongest=h=>{const sc=s=>len(h,s)*12+(inHand(h,s,'U')?18:0)+(inHand(h,s,'9')?10:0)+(inHand(h,s,'A')?6:0);let best=SU[0];for(const s of SU)if(sc(s)>sc(best))best=s;return best};
function refWeisOutcome(hands,game,vorhand){          // who writes how much Weis
  const unde=game==='unde',trump=REF[game]?null:game;
  const of=seat=>refWeis(hands[seat]).map(w=>{const suits=new Set(w.keys.map(k=>k.slice(0,-1))),ranks=w.keys.map(k=>TOPDOWN.indexOf(k.slice(-1)));return {seat,pts:w.pts,n:w.keys.length,top:Math.min(...ranks),suit:suits.size===1?w.keys[0].slice(0,-1):null}});
  const better=(a,b)=>{
    if(a.pts!==b.pts)return a.pts>b.pts;
    if(a.n!==b.n)return a.n>b.n;                                   // the Weis with more cards: a row of five beats four of a kind
    if(a.top!==b.top)return unde?a.top>b.top:a.top<b.top;          // the higher top card, in Undenufe the lower one
    return !!trump&&a.suit===trump&&b.suit!==trump;                // then the Trumpf suit; otherwise whoever plays first keeps it
  };
  let best=null;const all=[0,1,2,3].map(of);
  for(let k=0;k<4;k++)for(const w of all[(vorhand+k)%4])if(!best||better(w,best))best=w;
  if(!best)return {team:-1,points:0};
  const team=best.seat%2;return {team,points:all[team].concat(all[team+2]).reduce((n,w)=>n+w.pts,0)};
}
function refFirst(target,before,stoeck,weis,f,tricks){   // both teams passed the total: Stöck, then Weis, then trick by trick
  const tot=before.slice(),one=()=>{const a=tot[0]>=target,b=tot[1]>=target;return a&&!b?0:b&&!a?1:-1};
  tot[0]+=stoeck[0]*f;tot[1]+=stoeck[1]*f;if(one()>=0)return one();
  tot[0]+=weis[0]*f;tot[1]+=weis[1]*f;if(one()>=0)return one();
  for(const x of tricks){tot[x[0]]+=x[1]*f;if(one()>=0)return one()}
  return tot[0]>=tot[1]?0:1;
}
{
  const h0=api.gameHands(0,true),h2=api.gameHands(2,true);
  ok(h0.every(h=>h.length===9)&&uniq([].concat(...h0))&&api.botCall(h0[0])==='oben'&&refSure(h0[0],'oben')===6,'first game, first deal: six sure tricks from the top, a hand for Obenabe');
  ok(h2.every(h=>h.length===9)&&uniq([].concat(...h2))&&api.botCall(h2[2])===null&&refCall(h2[2])===null&&api.botCallPushed(h2[0])==='schilte'&&refWeis(h2[0]).map(w=>w.pts).join()==='20,20'&&inHand(h2[0],'schilte','K')&&inHand(h2[0],'schilte','O'),'first game, third deal: your partner pushes, you hold Schilte with Stöck and two small Weis');
  ok(uniq([].concat(...api.gameHands(1,true)))&&uniq([].concat(...api.gameHands(0,false))),'the other deals are 36 different cards');
  ok(api.newGame(1000).factors===false&&api.newGame(2500).factors===true,'to 1000 everything counts single, to 2500 the factors apply');
  const seq=(s,top,n)=>({kind:'seq',suit:s,top,len:n,pts:{3:20,4:50,5:100}[n]}),four=r=>({kind:'four',top:r,len:4,pts:r==='U'?200:r==='9'?150:100});
  ok(api.weisBetter(seq('rose','K',3),seq('eichle','O',3),'schelle',null)&&!api.weisBetter(seq('rose','K',3),seq('eichle','O',3),null,'unde')&&api.weisBetter(seq('eichle','O',3),seq('rose','K',3),null,'unde'),'equal rows: the higher top card wins, in Undenufe the lower one');
  ok(api.weisBetter(seq('schelle','K',3),seq('rose','K',3),'schelle',null)&&!api.weisBetter(seq('rose','K',3),seq('eichle','K',3),'schelle',null)&&!api.weisBetter(seq('eichle','K',3),seq('rose','K',3),'schelle',null),'same top card: the Trumpf suit wins, otherwise nobody is higher');
  ok(api.weisBetter(seq('rose','B',5),four('A'),'schelle',null)&&api.weisBetter(four('6'),four('A'),null,'unde')&&api.weisBetter(four('A'),four('6'),null,'oben'),'five in a row beat four of a kind; four sixes beat four Asses in Undenufe only');
  const tie=[H('r:A r:K r:O e:9 e:7 s:8 s:6 t:B t:7'),H('e:A e:K e:O r:9 r:7 s:7 t:6 t:9 s:B'),H('s:A s:U s:9 t:A t:8 r:B r:8 e:B e:8'),H('t:K t:O t:U r:U r:6 e:U e:6 s:K s:O')];
  ok(api.weisOutcome(tie,'schelle',0).team===0&&api.weisOutcome(tie,'schelle',1).team===1&&api.weisOutcome(tie,'schelle',0).points===20&&refWeisOutcome(tie,'schelle',0).team===0&&refWeisOutcome(tie,'schelle',1).team===1,'two equal Weis: whoever plays first writes');
  const mk=(st0,st1,w0,w1)=>({factor:1,rows:[{stoeck:st0,weis:w0},{stoeck:st1,weis:w1}]});
  ok(api.gameFirst(1000,[990,990],mk(0,20,20,0),[{winner:0,points:30}])===1,'both need 20: Stöck count before Weis');
  ok(api.gameFirst(1000,[990,990],mk(0,0,20,0),[{winner:1,points:30}])===0,'both need 20: Weis count before tricks');
  ok(api.gameFirst(1000,[990,985],mk(0,0,0,0),[{winner:1,points:10},{winner:0,points:12},{winner:1,points:9}])===0&&api.gameFirst(1000,[990,985],mk(0,0,0,0),[{winner:1,points:16},{winner:0,points:12}])===1,'both pass the total with tricks: the team that gets there first wins');
}
// What the conventions of Stage 9 and Stage 13 would lead as the first card, written a second time and differently. Null: no clear convention.
function refLead(hand,trump,mode,namer,pushed){
  const key=c=>c.s+c.r,of=s=>hand.filter(c=>c.s===s),has=(s,r)=>hand.some(c=>c.s===s&&c.r===r);
  if(trump){
    const mine=['U','9','A','K','O','B','8','7','6'].filter(r=>has(trump,r));
    if(!pushed){if(namer!==0||mine.length<4||mine[0]!=='U')return null;return ['U','9'].filter(r=>has(trump,r)).map(r=>trump+r).sort()}
    if(namer!==2)return null;
    if(mine.length===0){const w=hand.filter(c=>['K','O','U'].includes(c.r)).map(key).sort();return w.length?w:null}
    if(mine.length===1){
      if(mine[0]!=='U')return null;
      const side=SU.filter(x=>x!==trump),mx=Math.max(...side.map(x=>of(x).length));
      const w=hand.filter(c=>c.s!==trump&&of(c.s).length===mx&&['6','7','8','9'].includes(c.r)).map(key).sort();return w.length?w:null;
    }
    if(mine.length===2&&mine[0]==='U')return [trump+mine[1]];
    if(mine.length===3&&mine[0]==='A')return [trump+mine[1]];
    if(mine[0]==='U'||mine[0]==='9')return [trump+mine[0]];
    if(mine.includes('A')||mine.includes('B'))return null;
    return [trump+mine[0]];
  }
  if(!pushed||namer!==2)return null;
  const order=REF[mode].order,two=SU.filter(x=>has(x,order[0])&&has(x,order[1]));
  if(two.length)return two.map(x=>x+order[0]).sort();
  const mx=Math.max(...SU.map(x=>of(x).length)),longs=SU.filter(x=>of(x).length===mx);
  if(longs.length!==1)return null;
  return [key(of(longs[0]).slice().sort((a,b)=>order.indexOf(b.r)-order.indexOf(a.r))[0])];
}
{ // the conventions, typed in by hand
  const H=str=>str.split(' ').map(x=>({s:{e:'eichle',r:'rose',s:'schelle',c:'schilte'}[x[0]],r:x.slice(1)}));
  const lead=(str,o)=>{const hand=H(str),st=Object.assign({vorhand:0,done:[],trick:[],hands:[hand],trump:null,mode:null,namer:2,pushed:true},o),a=api.leadAdvice(st);return a?a.want.map(i=>({eichle:'e',rose:'r',schelle:'s',schilte:'c'})[hand[i].s]+hand[i].r).sort().join():null};
  ok(lead('rU rA rK r7 eA e9 sK s8 c6',{trump:'rose',namer:0,pushed:false})==='rU','you named Rose with the Puur and three more: lead the Puur');
  ok(lead('rU r9 rK r7 eA e9 sK s8 c6',{trump:'rose',namer:0,pushed:false})==='r9,rU','with Puur and Nell either of them draws Trumpf');
  ok(lead('r9 rA rK r7 e9 eA sK s8 c6',{trump:'rose',namer:0,pushed:false})===null,'you named Rose without the Puur: no comment');
  ok(lead('r9 rK eA e9 e7 sK s8 c6 c7',{trump:'rose'})==='r9','after a push: your best Trumpf');
  ok(lead('rU r8 eA e9 e7 sK s8 c6 c7',{trump:'rose'})==='r8','Puur and one more: the smaller one');
  ok(lead('rA rO r7 e9 e7 sK s8 c6 c7',{trump:'rose'})==='rO','Ass and two more: the second-highest');
  ok(lead('rU eA eK e9 e7 sK s8 c6 c7',{trump:'rose'})==='e7,e9','the Puur alone: a low card of the strongest suit');
  ok(lead('eA eK e9 e7 sK s8 c6 c7 cO',{trump:'rose'})==='cO,eK,sK','no Trumpf: a König, an Ober or an Under');
  ok(lead('rK rB eA e9 e7 sK s8 c6 c7',{trump:'rose'})===null&&lead('r9 eA e9 e7 sK s8 c6 c7 cB',{trump:'rose'})===null,'where the highest Trumpf is not the most valuable one, or a lone Nell: no comment');
  ok(lead('eA eK e9 e7 sK s8 c6 c7 cO',{mode:'oben'})==='eA','pushed Obenabe with Ass and König: the top card');
  ok(lead('eA eO e9 e7 sK s8 c6 c7 cO',{mode:'oben'})==='e7'&&lead('eA eO e9 e7 sK s8 c6 c7 cO',{mode:'unde'})==='c6','pushed Obenabe: the weakest card of the longest suit; pushed Undenufe with 6 and 7 of Schilte: the 6');
  ok(lead('eA eO e9 sK s8 s7 c6 c8 cO',{mode:'oben'})===null,'three suits of the same length: no comment');
  ok(lead('eA eO e9 e7 sK s8 c6 c7 cO',{mode:'oben',namer:0,pushed:false})===null&&api.leadAdvice({vorhand:1,done:[],trick:[],hands:[H('eA')],trump:'rose',namer:3,pushed:true})===null,'your own Obenabe, or somebody else is Vorhand: no comment');
}
{ // thanking: who has enough, and who is first
  const st=(o)=>Object.assign({game:'eichle',done:[],score:[0,0],won:[0,0],weis:{team:-1,points:0},stoeckSeat:-1,stoeck:-1},o),gm=(t,a,b)=>({target:t,factors:t>1000,total:[a,b]});
  ok(J(api.gameRun(gm(1000,990,990),st({weis:{team:0,points:20},stoeckSeat:1})))===J([990,990])&&J(api.gameHas(gm(1000,990,990),st({})))===J([false,false]),'nothing is written before the first trick is over');
  const s1=st({done:[{winner:0,points:0}],weis:{team:0,points:20},stoeckSeat:1});
  ok(J(api.gameHas(gm(1000,990,990),s1))===J([true,true])&&api.gameOrder(gm(1000,990,990),s1)===1,'both need 20, you hold the Weis, they hold Stöck: Stöck count first');
  const s2=st({done:[{winner:1,points:30}],score:[0,30],won:[0,1],weis:{team:0,points:20}});
  ok(api.gameOrder(gm(1000,990,990),s2)===0,'Weis count before the first trick');
  const s3=st({game:'schelle',done:[{winner:0,points:20},{winner:1,points:11}],score:[20,11],won:[1,1],weis:{team:1,points:50}});
  ok(J(api.gameRun(gm(2500,2400,2300),s3))===J([2440,2422])&&J(api.gameHas(gm(2500,2400,2300),s3))===J([false,false]),'the running count carries the factor: tricks, Weis and Stöck times two');
  const s4=st({game:'oben',done:Array.from({length:9},(_,i)=>({winner:0,points:i===8?35:15})),score:[157,0],won:[9,0]});
  ok(api.gameRun(gm(2500,1800,0),s4)[0]===1800+257*3,'a Match is counted when the ninth trick is in');
  // a Weis that is not announced is not written
  const C2=(s,r)=>({s,r}),hands=[[C2('rose','A'),C2('rose','K'),C2('rose','O'),C2('eichle','6'),C2('eichle','8'),C2('schelle','6'),C2('schelle','8'),C2('schilte','6'),C2('schilte','8')],
    [C2('eichle','K'),C2('eichle','O'),C2('eichle','U'),C2('schelle','A'),C2('schelle','B'),C2('schilte','A'),C2('schilte','B'),C2('rose','6'),C2('rose','8')],
    [C2('eichle','A'),C2('eichle','B'),C2('eichle','7'),C2('rose','U'),C2('rose','9'),C2('schelle','K'),C2('schelle','U'),C2('schelle','7'),C2('schilte','O')],
    [C2('eichle','9'),C2('rose','B'),C2('rose','7'),C2('schelle','O'),C2('schelle','9'),C2('schilte','K'),C2('schilte','U'),C2('schilte','9'),C2('schilte','7')]];
  ok(uniq([].concat(...hands))&&[].concat(...hands).length===36&&J(hands.map(h=>refWeis(h).length))===J([1,1,0,0]),'the four hands for the forgotten Weis are a whole deck, with one Weis each for you and for the player on your right');
  const said=api.weisOutcome(hands,'eichle',0),mute=api.weisOutcome(hands,'eichle',0,0);
  ok(said.team===0&&said.points===20&&said.missed.length===0&&mute.team===1&&mute.points===20&&mute.missed.length===1&&mute.missed[0].pts===20&&mute.list[0].length===0,'you hold three in a row and say nothing: the other team writes its own Weis, and yours is gone '+J([said.team,said.points,mute.team,mute.points]));
}
const seenGame={},gameStats={rounds:0,early:0,thanks:[0,0],order:0,late:0,match:0,pushed:0,weis:0,silent:0,stoeck:0,shown:0,leads:0,noLead:0,max:0};
for(let k=0;k<700;k++){
  const target=k%2?2500:1000,gm=api.newGame(target,k<2),totals=[0,0];let bad=false;
  const learnerThanks=k%4!==3,forgets=k%7===3;                         // one learner in four never thanks, one in seven never announces a Weis
  ok(gm.total.join()==='0,0'&&gm.round===0&&gm.over===false,'a new game starts at nil');
  for(let rd=0;rd<60&&!gm.over&&!bad;rd++){
    const st=api.gameDeal(gm),v=st.vorhand,all=[].concat(...st.hands);
    ok(v===rd%4&&st.dealer===(v+3)%4&&st.leader===v&&st.turn===v&&all.length===36&&uniq(all),'game: Vorhand moves on by one seat every round, to the right of the dealer');
    let call,namer=v,pushed=false;
    if(k%5===0){call=GAME_IDS[rnd(6)]}                                // every fifth game: any call is made, like a bold learner
    else{call=api.botCall(st.hands[v]);ok(call===refCall(st.hands[v]),'game: what Vorhand says follows the rule of thumb');
      if(!call){pushed=true;namer=(v+2)%4;call=api.botCallPushed(st.hands[namer]);ok(call===(refCall(st.hands[namer])||refLongest(st.hands[namer])),'game: after a push the partner has to make the call')}}
    const start=st.hands.map(h=>h.slice());
    api.gameSetGame(st,call,namer,pushed);
    const mode=REF[call]?call:null,trump=mode?null:call,f=gm.factors?REF_F[call]:1;
    const stoeckSeat=trump?[0,1,2,3].find(s=>inHand(start[s],trump,'K')&&inHand(start[s],trump,'O')):undefined;
    let rw=refWeisOutcome(start,call,v);
    ok(st.weis.team===rw.team&&st.weis.points===rw.points&&st.leader===v&&!!st.mode===!!mode&&(st.trump||null)===trump,'game: who writes the Weis, and how much '+J([call,v,st.weis.team,st.weis.points,rw]));
    if(forgets&&refWeis(start[0]).length){                              // the learner says nothing: that Weis is not written
      st.weis=api.weisOutcome(st.start,call,v,0);rw=refWeisOutcome(start.map((h,s)=>s?h:[]),call,v);gameStats.silent++;
      ok(st.weis.team===rw.team&&st.weis.points===rw.points&&st.weis.missed.reduce((n,w)=>n+w.pts,0)===refWeis(start[0]).reduce((n,w)=>n+w.pts,0),'game: a Weis that is not announced is not written '+J([st.weis.team,st.weis.points,rw]));
    }
    // the first card of the round, when the learner is Vorhand
    const adv=api.leadAdvice(st),refAdv=v===0?refLead(start[0],trump,mode,namer,pushed):null;
    ok((adv?J(adv.want.map(i=>st.hands[0][i].s+st.hands[0][i].r).sort()):'null')===(refAdv?J(refAdv):'null')&&(!adv||(adv.good&&adv.hint&&[9,13].includes(adv.stage)&&['tactic','both'].includes(adv.kind))),'game: the convention for the first card '+J([call,namer,pushed,refAdv]));
    if(v===0){if(adv)gameStats.leads++;else gameStats.noLead++}
    const before=gm.total.slice(),tricks=[],pts=[0,0],won=[0,0],held=[0,1].map(tm=>stoeckSeat!==undefined&&stoeckSeat%2===tm?20:0),weis=[0,1].map(tm=>rw.team===tm?rw.points:0);
    let stoeckTeam=-1,calls=0,out=-1,could=0;
    for(let n=0;n<9&&!bad&&out<0;n++){
      const lead=st.leader;
      for(let j=0;j<4;j++){
        const seat=st.turn,hand=st.hands[seat];
        const legal=!st.trick.length?hand.map((_,i)=>i):mode?(hand.some(c=>c.s===st.trick[0].s)?hand.map((c,i)=>c.s===st.trick[0].s?i:-1).filter(i=>i>=0):hand.map((_,i)=>i)):refLegal(hand,st.trick,trump);
        const idx=seat===0&&k%3===0?legal[rnd(legal.length)]:api.botMove(st,seat);
        if(!legal.includes(idx)){ok(false,'game: illegal card '+J({seat,hand,trick:st.trick,call,idx}));bad=true;break}
        const c=hand[idx],second=seat===stoeckSeat&&c.s===trump&&'KO'.includes(c.r)&&!hand.some((x,i)=>i!==idx&&x.s===trump&&'KO'.includes(x.r));
        const r=api.gamePlay(st,seat,idx);
        ok(r.full===(j===3)&&r.stoeck===second,'game: the trick is full after four cards, and Stöck is called with the second of the two');
        if(second){stoeckTeam=seat%2;calls++}
      }
      if(bad)break;
      const cards=st.trick.slice();
      let w,p;
      if(mode){const o=REF[mode].order;w=0;cards.forEach((c,i)=>{if(c.s===cards[0].s&&o.indexOf(c.r)<o.indexOf(cards[w].r))w=i});p=cards.reduce((a,c)=>a+REF[mode].pts[c.r],0)}
      else{w=refWinner(cards,trump);p=cards.reduce((a,c)=>a+refPts(c,trump),0)}
      const seat=(lead+w)%4;if(n===8)p+=5;
      const t=api.roundCloseTrick(st);
      ok(t.winner===seat&&t.points===p,'game: winner and points of a trick in '+call);
      tricks.push([seat%2,p]);pts[seat%2]+=p;won[seat%2]++;
      // after every trick: who has enough? Weis are written from the first trick on, Stöck count for whoever holds them
      const run=[0,1].map(tm=>before[tm]+f*(pts[tm]+weis[tm]+held[tm]+(n===8&&won[tm]===9?100:0))),has=run.map(x=>x>=target);
      ok(J(api.gameRun(gm,st))===J(run)&&J(api.gameHas(gm,st))===J(has),'game: the running count after trick '+(n+1)+' '+J([run,api.gameRun(gm,st)]));
      if(has[1]){
        if(has[0]&&!could){out=refFirst(target,before,held,weis,f,tricks);ok(api.gameOrder(gm,st)===out,'game: both teams have enough in the same trick, the order decides '+J([before,held,weis,tricks,out]));gameStats.order++}
        else{out=1;if(could)gameStats.late++}
      }else if(has[0]){if(!could)could=n+1;if(learnerThanks)out=0}
    }
    if(bad)break;
    const full=tricks.length===9;
    if(full)ok(pts[0]+pts[1]===157&&st.stoeck===stoeckTeam&&calls===(stoeckSeat===undefined?0:1),'game: 157 points in the tricks, and Stöck goes to the hand that held König and Ober of Trumpf');
    const match=full?(won[0]===9?0:won[1]===9?1:-1):-1;
    const stoeckFor=tm=>stoeckTeam===tm||(out===tm&&held[tm])?20:0;      // called, or shown by the team that thanks
    const want=[0,1].map(tm=>(pts[tm]+(match===tm?100:0)+weis[tm]+stoeckFor(tm))*f);
    const res=api.gameApply(gm,st,out);
    totals[0]+=want[0];totals[1]+=want[1];
    ok(res.factor===f&&res.rows[0].written===want[0]&&res.rows[1].written===want[1]&&gm.total[0]===totals[0]&&gm.total[1]===totals[1]&&res.before.join()===before.join()&&res.match===match&&gm.round===rd+1&&gm.log.length===rd+1&&res.out===out&&res.tricks===tricks.length,'game: what goes on the slate '+J([call,f,want,res.rows.map(x=>x.written),out,tricks.length]));
    const reached=[0,1].filter(tm=>totals[tm]>=target);
    const winner=out>=0?out:reached.length===0?-1:reached.length===1?reached[0]:refFirst(target,before,[stoeckTeam===0?20:0,stoeckTeam===1?20:0],weis,f,tricks);
    ok(gm.over===(out>=0||reached.length>0)&&gm.winner===winner&&(out<0||totals[out]>=target),'game: over exactly when a team thanks or has reached the total, and the right team wins '+J([totals,target,gm.winner,winner,out]));
    seenGame[call]=1;gameStats.rounds++;if(!full)gameStats.early++;if(out>=0)gameStats.thanks[out]++;if(match>=0)gameStats.match++;if(pushed)gameStats.pushed++;if(rw.team>=0)gameStats.weis++;if(stoeckTeam>=0)gameStats.stoeck++;
    if(out>=0&&held[out]&&stoeckTeam!==out)gameStats.shown++;
  }
  if(bad)break;
  ok(gm.over&&gm.round<=40,'game: every game comes to an end ('+gm.round+' rounds)');gameStats.max=Math.max(gameStats.max,gm.round);
}
ok(Object.keys(seenGame).length===6&&gameStats.thanks[0]>0&&gameStats.thanks[1]>0&&gameStats.early>0&&gameStats.late>0&&gameStats.match>0&&gameStats.pushed>0&&gameStats.weis>0&&gameStats.silent>0&&gameStats.stoeck>0&&gameStats.leads>0&&gameStats.noLead>0,'whole games: all six calls, pushes, Weis (also forgotten ones), Stöck, a Match, both teams thanking, rounds that stop early, and a learner who thanks too late '+J(gameStats));
console.log('whole games: '+J(gameStats));
// ---- after the critical read-through: a check asks nothing its own stage has not practised
{
  const variant=q=>[q.type,q.v,q.want,q.type==='best'||q.type==='tlegal'?q.scn:undefined,['mwinner','mvalue','mcount','mstronger','sure'].includes(q.type)?q.mode:undefined,
    q.type==='number'?q.covered:undefined,q.type==='tcount'?q.last:undefined,q.type==='mc'?q.prompt:undefined].filter(x=>x!==undefined).join('|');
  api.STAGES.forEach((st,si)=>{
    const check=st.lessons.find(l=>l.check);if(!check)return;
    const practised=new Set(),asked=new Set();
    for(let r=0;r<250;r++){st.lessons.forEach(ls=>{if(!ls.gen)return;for(let i=0;i<ls.n;i++)(ls.check?asked:practised).add(variant(ls.gen(i)))})}
    const news=Array.from(asked).filter(k=>!practised.has(k));
    ok(news.length===0,'stage '+(si+1)+': the check asks only what a lesson of the stage has practised '+J(news));
  });
  const wants=(si,li,f)=>{const ls=api.STAGES[si].lessons[li],c={};for(let i=0;i<ls.n;i++){const k=f(ls.gen(i));c[k]=(c[k]||0)+1}return J(Object.keys(c).sort().map(k=>k+'×'+c[k]))};
  ok(wants(5,1,q=>q.want)===J(['1×1','2×1','3×1','4×1','push×2']),'«Name it or push?» shows each of the four hands of the rule of thumb once '+wants(5,1,q=>q.want));
  ok(wants(12,2,q=>q.scn)===J(['lead-ass3×2','lead-best×2','lead-puur2×2']),'«After the push: lead Trumpf» practises the rule and both exceptions twice each '+wants(12,2,q=>q.scn));
  ok(wants(10,3,q=>q.type==='mc'?'mc':q.v)===J(['mc×2','oben×1','othersuit×1','split×1','yes×1']),'«Stöck» shows all four hands '+wants(10,3,q=>q.type==='mc'?'mc':q.v));
  ok(api.MC_WEIS.length===5&&/first trick/.test(api.STAGES[10].lessons[2].text)&&/round the corner/.test(api.STAGES[10].lessons[0].text),'when a Weis is announced and «not round the corner» stand in a lesson text');
  // «round» means nine tricks and nothing else; the partner is «he» throughout
  const texts=[];api.STAGES.forEach(st=>st.lessons.forEach(ls=>{texts.push(ls.text);if(ls.gen)for(let i=0;i<ls.n*8;i++){const q=ls.gen(i%ls.n);texts.push(q.prompt,q.explain,q.hint||'',q.info||'')}}));
  const all=texts.join(' \n ');
  ok(!/two rounds|extra round|rounds are/i.test(all),'no lesson calls a lead of Trumpf a «round»');
  const she=all.match(/partner[^.]{0,90}\b(she|her)\b/gi)||[];
  ok(she.filter(x=>!/her partner/i.test(x)).length===0,'the partner is «he» in every lesson '+J(she.slice(0,3)));
  const mixed=[];api.STAGES.forEach((st,si)=>st.lessons.forEach((ls,li)=>{if(ls.mix)mixed.push((si+1)+'.'+(li+1))}));
  ok(J(mixed)===J(['6.2','9.1','9.2','9.3','10.5','11.1','11.2','12.1','13.2','13.3','13.4','13.5']),'twelve lessons deal their exercises in a new order '+J(mixed));
  let total=0;api.STAGES.forEach(st=>st.lessons.forEach(ls=>{if(ls.gen)total+=ls.n}));
  ok(total===360,'the course has 360 exercises ('+total+')');
  // less adding up: twenty tricks to add and twenty-two single cards to value in the whole course
  const kinds={};api.STAGES.forEach(st=>st.lessons.forEach(ls=>{if(ls.gen)for(let i=0;i<ls.n;i++){const t=ls.gen(i).type;kinds[t]=(kinds[t]||0)+1}}));
  ok(kinds.count+kinds.tcount+kinds.mcount===20&&kinds.value+kinds.tvalue+kinds.mvalue===22,'adding up a trick is asked 20 times, the worth of one card 22 times '+J([kinds.count,kinds.tcount,kinds.mcount,kinds.value,kinds.tvalue,kinds.mvalue]));
  const short=[];api.STAGES.forEach((st,si)=>st.lessons.forEach((ls,li)=>{if(ls.gen&&ls.n<6)short.push((si+1)+'.'+(li+1)+'×'+ls.n)}));
  ok(J(short)===J(['3.2×4','4.3×4','4.4×5','6.3×4','8.4×4','9.1×4','9.2×4','9.4×4','10.1×4','10.2×4','10.4×4','13.4×4']),'twelve lessons are shorter than six exercises '+J(short));
  // «game» is the whole thing to 1000; what Vorhand names is a «call»
  const titles=[];api.STAGES.forEach(st=>{titles.push(st.title,st.blurb);st.lessons.forEach(ls=>titles.push(ls.title,ls.text))});
  const tt=titles.join(' \n ');
  ok(!/\b(two|three|six|every|which|all six) games?\b|name the game|named the game|factor of the game|not every game/i.test(tt+all),'no lesson calls a Trumpf suit, Obenabe or Undenufe a «game»');
  ok(/Making the call/.test(tt)&&/Which call\?/.test(tt)&&/Three calls, one table/.test(tt)&&/The whole game/.test(tt)&&/A game of Schieber/.test(tt),'the calls and the game keep their own words');
}
ok(api.STAGES.length===14&&api.STAGES[13].ch===5&&api.STAGES[13].lessons.length===1&&api.STAGES[13].lessons[0].game===true,'fourteen stages: the whole game is stage 14');
// ---- the link preview: Open Graph tags in the head and a picture that WhatsApp accepts
{
  const meta=k=>{const m=html.match(new RegExp('<meta (?:property|name)="'+k+'" content="([^"]*)">'));return m?m[1]:null};
  ok(meta('og:type')==='website'&&meta('og:title')==='Jass with Vreni'&&(meta('og:description')||'').length>40&&meta('og:url')==='https://jass-with-vreni.netlify.app/'
    &&meta('og:image')==='https://jass-with-vreni.netlify.app/share.jpg'&&meta('og:image:width')==='1200'&&meta('og:image:height')==='630'&&(meta('og:image:alt')||'').length>20,
    'the head carries the link preview: title, text, address and an absolute picture address');
  const pth=require('path'),img=fs.readFileSync(pth.join(pth.dirname(process.argv[2]),'share.jpg'));
  // read the size of the JPEG from its frame header
  let w=0,h=0;for(let i=2;i<img.length-9&&img[i]===0xFF;){const mk=img[i+1],len=img.readUInt16BE(i+2);if(mk>=0xC0&&mk<=0xCF&&mk!==0xC4&&mk!==0xC8&&mk!==0xCC){h=img.readUInt16BE(i+5);w=img.readUInt16BE(i+7);break}i+=2+len}
  ok(img[0]===0xFF&&img[1]===0xD8&&w===1200&&h===630&&img.length>20000&&img.length<300*1024,'share.jpg is a JPEG of 1200 x 630 pixels under 300 KB '+J([w,h,img.length]));
  ok(/function idahoMan\(/.test(html)&&/function matesHTML\(/.test(html)&&!/<img /.test(html),'the man from Idaho is a drawing made by the app, no photo is built in');
}
console.log(fail?fail+' failures':'all logic checks passed ('+count+' checks)');
