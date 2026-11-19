const fs=require('fs');
const html=fs.readFileSync(process.argv[2],'utf8');
const logic=html.split('/*LOGIC-START*/')[1].split('/*LOGIC-END*/')[0];
const api=new Function(logic+';return {SUITS,RANKS,trickWinner,legalCards,trickPoints,points,qSuit,qPick,qBridge,qNumber,qStronger,qWinner,qLegal,qValue,qCount,STAGES,deck};')();
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}};
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
for(const st of api.STAGES)for(const ls of st.lessons)for(let i=0;i<ls.n;i++){const q=ls.gen(i);ok(q&&q.prompt&&q.explain,'lesson gen')}
console.log(fail?fail+' failures':'all logic checks passed');
