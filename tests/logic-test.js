const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const logic=html.split('/*LOGIC-START*/')[1].split('/*LOGIC-END*/')[0];
const api=new Function(logic+';return {SUITS,RANKS,trickWinner,legalCards,trickPoints,points,qSuit,qPick,qBridge,qNumber,qStronger,qWinner,qLegal,qValue,qCount,STAGES,deck,trickWinnerT,pointsT,legalT,qTPick,qTStronger,qTWinner,qTValue,qTCount,qMC,MC_POINTS,qTLegal};')();
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
for(const st of api.STAGES)for(const ls of st.lessons)for(let i=0;i<ls.n;i++){const q=ls.gen(i);ok(q&&q.prompt&&q.explain,'lesson gen')}
console.log(fail?fail+' failures':'all logic checks passed ('+count+' checks)');
