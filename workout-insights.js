'use strict';
/* FitNapló 1.7 - értelmezhető, kattintható edzésgrafikonok. A meglévő adatbázist nem módosítja. */
let workoutSelectedWeek=null;

function workoutMetricInfo(metric){
  if(metric==='volume')return {
    title:'Számított terhelési volumen',
    description:'Sorozatok × ismétlések × súly összesen, kizárólag a rögzített bejegyzésekből. Az Excelből importált sorozat- és ismétlésszám tervadat is lehet, ezért nem feltétlenül a valóban elvégzett heti volumen.',
    precision:0
  };
  if(metric==='estimated1rm')return {
    title:'Becsült egyismétléses maximum (1RM)',
    description:'Epley-becslés: súly × (1 + ismétlések / 30). Csak 1–12 ismétlésnél számítjuk, nem tényleges maximumteszt. Másik gép vagy eltérő kivitelezés esetén az eredmények nem közvetlenül összehasonlíthatók.',
    precision:1
  };
  return {
    title:'Legnagyobb rögzített súly',
    description:'A gyakorlatnál az adott héten rögzített legnagyobb terhelés. Az Excelben egyes kézisúlyzós értékek kilogramm/kéz formában szerepelnek. Ugyanaz a súly eltérő gépen nem feltétlenül jelent azonos nehézséget.',
    precision:1
  };
}

function workoutWeekDetails(){
  const name=$('exercise-filter').value,metric=$('workout-metric').value;
  const actual=workouts.filter(r=>r.name===name&&!String(r.variation||'').trim());
  const actualWeeks=new Set(actual.map(r=>startOfWeek(r.date)));
  const legacy=historyWorkouts.filter(r=>r.name===name&&r.comparable&&Number.isFinite(r.weight)&&!actualWeeks.has(startOfWeek(r.date)));
  const groups=new Map();
  for(const r of actual){
    const week=startOfWeek(r.date);
    if(!groups.has(week))groups.set(week,[]);
    groups.get(week).push(r);
  }
  for(const r of legacy){
    const week=r.date; // Excel heti oszlop: ez nem bizonyított edzésnap!
    if(!groups.has(week))groups.set(week,[]);
    groups.get(week).push(r);
  }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>{
    const scores=rows.map(r=>({row:r,value:estimated1RM(r)})).filter(x=>Number.isFinite(x.value));
    const representative=metric==='estimated1rm'
      ?scores.sort((a,b)=>b.value-a.value)[0]?.row??null
      :[...rows].sort((a,b)=>b.weight-a.weight)[0]??null;
    let value=null;
    if(metric==='maxLoad')value=Math.max(...rows.map(r=>r.weight));
    else if(metric==='volume')value=rows.reduce((sum,r)=>sum+r.sets*r.reps*r.weight*(r.pairCount||1),0);
    else if(scores.length)value=Math.max(...scores.map(x=>x.value));
    const isExcel=rows.every(r=>r.source==='Excel');
    return {
      date, value:Number.isFinite(value)?value:null,
      source:isExcel?'Excel heti adat':'Saját napló',
      weekLabel:isExcel?(rows[0].weekLabel||''):'',
      representative, rows
    };
  });
}

function workoutNumber(value,metric){
  return Number.isFinite(value)?format(value,workoutMetricInfo(metric).precision)+' kg':'—';
}

function workoutRowDescription(row){
  if(!row)return 'Nincs részletes bejegyzés';
  const count=Number.isFinite(row.sets)&&Number.isFinite(row.reps)
    ?row.sets+' × '+row.reps:'Nincs teljes sorozatadat';
  const perHand=row.pairCount===2?' / kéz':'';
  return count+' · '+format(row.weight)+' kg'+perHand;
}

function showWorkoutDetail(point,metric){
  const container=$('workout-point-detail');
  if(!point){container.textContent='Nincs kiválasztott hét.';return;}
  const title=point.source==='Excel heti adat'
    ?(point.weekLabel+' · Excel heti oszlop ('+dateLabel(point.date)+')')
    :('Hét kezdete: '+dateLabel(point.date)+' · Saját napló');
  const items=point.rows.slice(0,8).map(r=>{
    const annotation=[
      r.variation?'Másik gép: '+r.variation:'',
      r.note||'',
      r.source==='Excel'&&r.raw?'Eredeti Excel: '+r.raw:''
    ].filter(Boolean).join(' · ');
    return '<li>'+escapeHTML(workoutRowDescription(r))+
      (annotation?'<div class="muted small">'+escapeHTML(annotation)+'</div>':'')+'</li>';
  }).join('');
  container.innerHTML=
    '<div class="workout-detail-heading">'+escapeHTML(title)+'</div>'+
    '<div class="workout-detail-value">'+escapeHTML(workoutMetricInfo(metric).title)+': <strong>'+workoutNumber(point.value,metric)+'</strong></div>'+
    '<div class="workout-detail-caption">A számításhoz figyelembe vett bejegyzés(ek):</div>'+
    '<ul>'+items+'</ul>';
}

function showWorkoutTable(series,metric,selectedDate){
  const rows=series.slice().reverse().slice(0,12).map(r=>{
    const selected=r.date===selectedDate?' class="workout-table-selected"':'';
    const row=r.representative?workoutRowDescription(r.representative):(r.rows.length+' rögzített sor');
    return '<tr'+selected+'><td>'+dateLabel(r.date)+'</td>'+
      '<td><strong>'+workoutNumber(r.value,metric)+'</strong></td>'+
      '<td>'+escapeHTML(row)+'</td>'+
      '<td>'+escapeHTML(r.source)+'</td></tr>';
  }).join('');
  $('workout-insight-table').innerHTML='<table><thead><tr><th>Hét</th><th>Érték</th><th>Sorozat / ismétlés</th><th>Forrás</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function renderWorkoutInsights(){
  const metric=$('workout-metric').value,exercise=$('exercise-filter').value;
  const info=workoutMetricInfo(metric);
  const all=workoutWeekDetails();
  const valid=all.filter(x=>Number.isFinite(x.value));
  $('workout-metric-help').textContent=info.description;
  if(!valid.length){
    $('workout-summary').innerHTML='<p class="muted">Ehhez a gyakorlathoz ennél a mutatónál még nincs számítható adat.</p>';
    $('workout-point-detail').textContent='Válassz másik mutatót, vagy rögzíts új edzést.';
    $('workout-insight-table').innerHTML=emptyTable('Nincs összehasonlítható heti adat.');
    $('workout-source-note').textContent='Az Excelben szereplő szöveges, bizonytalan terheléseket nem használjuk számításhoz.';
    lineChart('workout-chart',[], 'kg');
    return;
  }
  const latest=valid.at(-1),previous=valid.length>1?valid.at(-2):null;
  const diff=previous?latest.value-previous.value:null;
  const diffText=diff===null?'—':(diff>0?'+':'')+format(diff,info.precision)+' kg';
  $('workout-summary').innerHTML=
    '<div class="workout-stat"><span>Utolsó rögzített hét</span><strong>'+workoutNumber(latest.value,metric)+'</strong><small>'+dateLabel(latest.date)+'</small></div>'+
    '<div class="workout-stat"><span>Előző rögzített hét</span><strong>'+(previous?workoutNumber(previous.value,metric):'—')+'</strong><small>'+(previous?dateLabel(previous.date):'Még nincs')+'</small></div>'+
    '<div class="workout-stat"><span>Eltérés</span><strong>'+diffText+'</strong><small>Nem feltétlenül erőfejlődés</small></div>';
  const hasExcel=valid.some(x=>x.source==='Excel heti adat');
  const excluded=workouts.some(r=>r.name===exercise&&String(r.variation||'').trim());
  $('workout-source-note').textContent=
    (hasExcel?'Az Excel heti oszlopdátuma nem feltétlenül a tényleges edzés napja. Az ottani sorozatadatok esetenként tervadatok. ':'')+
    (excluded?'Az eltérő géppel vagy helyettesítő gyakorlattal rögzített bejegyzéseket kihagytuk a terhelés összehasonlításából. ':'')+
    'A különböző gépeken használt kilogrammértékek nem mindig összehasonlíthatók.';
  const initial=valid.find(x=>x.date===workoutSelectedWeek)||latest;
  workoutSelectedWeek=initial.date;
  showWorkoutDetail(initial,metric);
  showWorkoutTable(valid,metric,workoutSelectedWeek);
  lineChart('workout-chart',[{name:info.title,color:'#65e0cf',data:valid}],'kg');

  // Az ábra pontjai nagyobb, láthatatlan érintési felületet kapnak az iPhone-on.
  const host=$('workout-chart'), svg=host.querySelector('svg');
  if(!svg)return;
  const nodes=[...svg.querySelectorAll('circle')];
  const svgNS='http://www.w3.org/2000/svg';
  nodes.forEach((circle,index)=>{
    const point=valid[index];
    if(!point)return;
    const hit=document.createElementNS(svgNS,'circle');
    for(const attr of ['cx','cy'])hit.setAttribute(attr,circle.getAttribute(attr));
    hit.setAttribute('r','19');
    hit.setAttribute('fill','transparent');
    hit.setAttribute('role','button');
    hit.setAttribute('tabindex','0');
    hit.setAttribute('aria-label',dateLabel(point.date)+': '+workoutNumber(point.value,metric));
    hit.style.cursor='pointer';
    const activate=()=>{
      workoutSelectedWeek=point.date;
      showWorkoutDetail(point,metric);
      showWorkoutTable(valid,metric,workoutSelectedWeek);
      for(const node of nodes)node.setAttribute('stroke-width','1.3');
      circle.setAttribute('stroke','#f2f9ff');
      circle.setAttribute('stroke-width','3');
    };
    hit.addEventListener('click',activate);
    hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
    svg.append(hit);
    if(point.date===workoutSelectedWeek){
      circle.setAttribute('stroke','#f2f9ff');
      circle.setAttribute('stroke-width','3');
    }
  });
}
