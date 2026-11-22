'use strict';
/* FitNapló v1 – no external libraries and no network data transfer. */
const DB_NAME='fitnaplo-db';
const DB_VERSION=1;
const STORE_NAMES=['profile','weights','measurements','workouts'];
const DEFAULT_PROFILE={id:'main',height:null,sex:'male',goal:null,name:''};
const $=id=>document.getElementById(id);
const decimal=v=>v===null||v===undefined||v===''?null:Number(String(v).replace(',','.'));
const finitePositive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const format=(v,dec=1)=>Number.isFinite(v)?new Intl.NumberFormat('hu-HU',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v):'—';
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateObj=s=>new Date(`${s}T12:00:00`);
const localISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>localISO(new Date());
const dateLabel=s=>s?new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'2-digit',day:'2-digit'}).format(dateObj(s)):'—';
const shortDate=s=>s?new Intl.DateTimeFormat('hu-HU',{month:'2-digit',day:'2-digit'}).format(dateObj(s)):'—';
const startOfWeek=s=>{const d=dateObj(s),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return localISO(d);};
const plusDays=(s,n)=>{const d=dateObj(s);d.setDate(d.getDate()+n);return localISO(d);};
const safeDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&localISO(dateObj(s))===s;
const sortAsc=(a,b)=>a.date.localeCompare(b.date);
const sortDesc=(a,b)=>b.date.localeCompare(a.date);
const uid=()=>globalThis.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));

function bmi(weight,height){if(!finitePositive(weight)||!finitePositive(height))return null;return weight/(height/100)**2;}
function navyFat(sex,height,neck,waist,hip){
  if(!finitePositive(height)||!finitePositive(neck)||!finitePositive(waist))return null;
  const h=height/2.54;
  const diff=(sex==='female'?waist+(hip||0)-neck:waist-neck)/2.54;
  if(diff<=0||(sex==='female'&&!finitePositive(hip)))return null;
  const result=sex==='female'
    ?163.205*Math.log10(diff)-97.684*Math.log10(h)-78.387
    :86.010*Math.log10(diff)-70.041*Math.log10(h)+36.76;
  return Number.isFinite(result)&&result>=0&&result<=75?result:null;
}
const estimated1RM=r=>r.reps>=1&&r.reps<=12&&r.weight>0?r.weight*(1+r.reps/30):null;
const volume=r=>r.sets*r.reps*r.weight;
function weeklyWeights(rows){
  const groups=new Map();
  for(const r of rows){const week=startOfWeek(r.date);if(!groups.has(week))groups.set(week,[]);groups.get(week).push(r.weight);}
  return [...groups].map(([week,values])=>({date:week,week,average:values.reduce((a,b)=>a+b,0)/values.length,count:values.length})).sort(sortAsc);
}

let db,profile={...DEFAULT_PROFILE},weights=[],measurements=[],workouts=[];
let toastTimer,activePage='dashboard';
function notify(text){const node=$('toast');node.textContent=text;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3400);}
function showError(error){console.error(error);notify('Hiba: '+(error?.message||String(error)));}
function requireDB(){if(!db)throw Error('Az adatbázis nem érhető el. Nyisd meg a HTTPS-en közzétett alkalmazást Safari böngészőben.');}
function openDatabase(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB'in globalThis))return reject(Error('Az IndexedDB nem támogatott ebben a böngészőben.'));
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const d=req.result;for(const name of STORE_NAMES){if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:name==='weights'||name==='measurements'?'date':'id'});}};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Az adatbázist másik megnyitott lap zárolja.'));
  });
}
function operation(store,method,...args){
  requireDB();return new Promise((resolve,reject)=>{
    let result;
    const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');
    const req=tx.objectStore(store)[method](...args);
    req.onsuccess=()=>{result=req.result;};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||req.error);
    tx.onabort=()=>reject(tx.error||Error('Az adatbázis-művelet megszakadt.'));
  });
}
async function refreshData(){
  requireDB();
  const [savedProfile,w,m,r]=await Promise.all([operation('profile','get','main'),operation('weights','getAll'),operation('measurements','getAll'),operation('workouts','getAll')]);
  profile={...DEFAULT_PROFILE,...(savedProfile||{})};weights=w.sort(sortAsc);measurements=m.sort(sortAsc);workouts=r.sort(sortAsc);render();
}
function updateMeasuredResults(){
  const h=profile.height;
  weights=weights.map(r=>({...r,bmi:bmi(r.weight,h)}));
  measurements=measurements.map(r=>({...r,bodyFatPercent:navyFat(profile.sex,h,r.neck,r.waist,r.hip)}));
}
async function storeProfileAndDerived(nextProfile){
  requireDB();
  profile={...DEFAULT_PROFILE,...nextProfile};
  updateMeasuredResults();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['profile','weights','measurements'],'readwrite');
    tx.objectStore('profile').put(profile);
    for(const row of weights)tx.objectStore('weights').put(row);
    for(const row of measurements)tx.objectStore('measurements').put(row);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Nem sikerült menteni.'));
  });
}

function changePage(name){
  activePage=name;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelectorAll('.tabbar button').forEach(b=>{const selected=b.dataset.page===name;b.classList.toggle('selected',selected);b.setAttribute('aria-current',selected?'page':'false');});
  window.scrollTo({top:0,behavior:'auto'});
  if(name==='dashboard'||name==='workout')requestAnimationFrame(renderCharts);
}
function card(label,value,minor,icon){return `<div class="metric-card"><span class="mini-icon">${icon}</span><div class="label">${label}</div><div class="value">${value}</div><div class="minor">${minor}</div></div>`;}
function renderDashboard(){
  const latest=weights.at(-1),lastMeasure=measurements.at(-1),weeks=weeklyWeights(weights);
  const currentWeek=startOfWeek(today()),week=weeks.find(w=>w.week===currentWeek),prev=weeks.find(w=>w.week===plusDays(currentWeek,-7));
  const avg=week?.average;
  const delta=avg!==undefined&&prev!==undefined?avg-prev.average:null;
  const avgNote=week?`${week.count}/7 nap · ${delta===null?'nincs előző heti adat':(delta>0?'+':'')+format(delta)+' kg előző héthez'}`:'Még nincs adat ezen a héten';
  const latestBMI=latest?bmi(latest.weight,profile.height):null;
  const bf=lastMeasure?navyFat(profile.sex,profile.height,lastMeasure.neck,lastMeasure.waist,lastMeasure.hip):null;
  $('dashboard-cards').innerHTML=
    card('Legutóbbi testsúly',latest?`${format(latest.weight)} <span class="unit">kg</span>`:'—',latest?dateLabel(latest.date):'Még nincs mérés','◉')+
    card('Aktuális heti átlag',Number.isFinite(avg)?`${format(avg)} <span class="unit">kg</span>`:'—',avgNote,'≈')+
    card('BMI',Number.isFinite(latestBMI)?format(latestBMI):'—',profile.height?'Utolsó mért súly alapján':'Add meg a magasságot','◇')+
    card('Becsült testzsír',Number.isFinite(bf)?`${format(bf)} <span class="unit">%</span>`:'—',lastMeasure?dateLabel(lastMeasure.date):'Körfogatmérés szükséges','%');
  const rows=[];
  rows.push(`<div class="inline-row"><span>Heti testsúlymérések</span><b>${week?.count||0} / 7 nap</b></div>`);
  rows.push(`<div class="progress-track"><div class="progress-fill" style="width:${Math.min((week?.count||0)/7,1)*100}%"></div></div>`);
  if(latest&&Number.isFinite(profile.goal)){
    const dist=latest.weight-profile.goal;
    rows.push(`<div class="inline-row"><span>Céltestsúly</span><b>${format(profile.goal)} kg</b></div>`);
    rows.push(`<div class="inline-row"><span>Eltérés a céltól</span><b>${dist>0?'+':''}${format(dist)} kg</b></div>`);
  }
  rows.push(`<div class="inline-row"><span>Összes testsúlymérés</span><b>${weights.length}</b></div>`);
  rows.push(`<div class="inline-row"><span>Összes rögzített gyakorlat</span><b>${workouts.length}</b></div>`);
  $('week-summary').innerHTML=`<h2>Heti összefoglaló</h2><p class="hint">${dateLabel(currentWeek)} – ${dateLabel(plusDays(currentWeek,6))}</p>${rows.join('')}`;
}
function emptyTable(msg){return `<div class="table-empty">${escapeHTML(msg)}</div>`;}
function renderBodyTables(){
  const weekRows=weeklyWeights(weights).sort(sortDesc);
  $('weekly-weight').innerHTML=weekRows.length?`<table><thead><tr><th>Hét kezdete</th><th>Mérések</th><th>Heti átlag</th></tr></thead><tbody>${weekRows.map(r=>`<tr><td>${dateLabel(r.week)}</td><td><span class="pill">${r.count}/7 nap</span></td><td>${format(r.average)} kg</td></tr>`).join('')}</tbody></table>`:emptyTable('Még nincs heti átlag. Rögzíts legalább egy testsúlyt.');
  $('weights-table').innerHTML=weights.length?`<table><thead><tr><th>Dátum</th><th>Testsúly</th><th>BMI</th><th>Művelet</th></tr></thead><tbody>${[...weights].reverse().map(r=>`<tr><td>${dateLabel(r.date)}</td><td>${format(r.weight)} kg</td><td>${format(bmi(r.weight,profile.height))}</td><td><div class="row-actions"><button class="mini-btn" data-action="edit-weight" data-id="${r.date}">Szerk.</button><button class="mini-btn delete-btn" data-action="delete-weight" data-id="${r.date}">Törlés</button></div></td></tr>`).join('')}</tbody></table>`:emptyTable('Még nincs testsúlyadat.');
  $('measures-table').innerHTML=measurements.length?`<table><thead><tr><th>Dátum</th><th>Nyak</th><th>Derék/has</th>${profile.sex==='female'?'<th>Csípő</th>':''}<th>Testzsír</th><th>Művelet</th></tr></thead><tbody>${[...measurements].reverse().map(r=>`<tr><td>${dateLabel(r.date)}</td><td>${format(r.neck)} cm</td><td>${format(r.waist)} cm</td>${profile.sex==='female'?`<td>${format(r.hip)} cm</td>`:''}<td>${format(navyFat(profile.sex,profile.height,r.neck,r.waist,r.hip))} %</td><td><div class="row-actions"><button class="mini-btn" data-action="edit-measure" data-id="${r.date}">Szerk.</button><button class="mini-btn delete-btn" data-action="delete-measure" data-id="${r.date}">Törlés</button></div></td></tr>`).join('')}</tbody></table>`:emptyTable('Még nincs körfogatmérés.');
}
function distinctExerciseNames(){
  const names=new Map();for(const r of workouts){const key=r.name.trim().toLocaleLowerCase('hu-HU');if(!names.has(key))names.set(key,r.name.trim());}
  return [...names.values()].sort((a,b)=>a.localeCompare(b,'hu-HU'));
}
function updateExerciseSelect(){
  const names=distinctExerciseNames();const sel=$('exercise-filter');const previous=sel.value;
  sel.replaceChildren();
  const dl=$('exercise-suggestions');dl.replaceChildren();
  for(const name of names){let opt=document.createElement('option');opt.value=name;opt.textContent=name;sel.append(opt);opt=document.createElement('option');opt.value=name;dl.append(opt);}
  sel.disabled=names.length===0;
  if(names.includes(previous))sel.value=previous;
  else if(names.length)sel.value=names[0];
}
function renderWorkouts(){
  updateExerciseSelect();
  $('workouts-table').innerHTML=workouts.length?`<table><thead><tr><th>Dátum</th><th>Gyakorlat</th><th>Sor. × ism.</th><th>Súly</th><th>Volumen</th><th>Művelet</th></tr></thead><tbody>${[...workouts].reverse().map(r=>`<tr><td>${dateLabel(r.date)}</td><td><b>${escapeHTML(r.name)}</b>${r.note?`<div class="muted small">${escapeHTML(r.note)}</div>`:''}</td><td>${r.sets} × ${r.reps}</td><td>${format(r.weight)} kg</td><td>${format(volume(r),0)} kg</td><td><div class="row-actions"><button class="mini-btn" data-action="edit-workout" data-id="${escapeHTML(r.id)}">Szerk.</button><button class="mini-btn delete-btn" data-action="delete-workout" data-id="${escapeHTML(r.id)}">Törlés</button></div></td></tr>`).join('')}</tbody></table>`:emptyTable('Még nincs edzésbejegyzés.');
}
function showSexFields(){
  const female=profile.sex==='female';$('hip-row').classList.toggle('hidden',!female);$('measure-hip').required=female;
  $('waist-label').textContent=female?'Derékkörfogat – legkeskenyebb rész (cm)':'Haskörfogat – köldöknél (cm)';
  $('measure-explain').textContent=female?'Női képlet: derék a legkeskenyebb részen, csípő a legszélesebb részen, nyak a gége alatt.':'Férfi képlet: haskörfogat a köldök magasságában, nyak közvetlenül a gége alatt.';
}
function renderProfile(){
  $('profile-height').value=profile.height??'';
  $('profile-sex').value=profile.sex;
  $('profile-goal').value=profile.goal??'';
  $('profile-name').value=profile.name||'';
  showSexFields();
}
function render(){renderDashboard();renderBodyTables();renderWorkouts();renderProfile();renderCharts();}

/* SVG charts: self-contained, offline, and resize-safe. */
function lineChart(id,series,unit){
  const host=$(id);if(!host)return;
  const all=series.flatMap(s=>s.data.filter(p=>Number.isFinite(p.value)&&safeDate(p.date)));
  host.replaceChildren();
  if(!all.length){host.classList.add('empty-chart');host.textContent='Nincs még elég rögzített adat a grafikonhoz.';return;}
  host.classList.remove('empty-chart');
  const rect=host.getBoundingClientRect(),W=Math.max(Math.round(rect.width||600),290),H=Math.max(Math.round(rect.height||230),190);
  const margin={left:49,right:18,top:18,bottom:37};const cw=W-margin.left-margin.right,ch=H-margin.top-margin.bottom;
  const dates=[...new Set(all.map(p=>p.date))].sort();
  const xT=dates.map(d=>dateObj(d).getTime());
  const minT=xT[0],maxT=xT[xT.length-1];
  const X=d=>maxT===minT?margin.left+cw/2:margin.left+(dateObj(d).getTime()-minT)/(maxT-minT)*cw;
  const vals=all.map(p=>p.value);let lo=Math.min(...vals),hi=Math.max(...vals);
  let pad=Math.max((hi-lo)*0.13,hi===lo?Math.max(Math.abs(hi)*0.04,1):0.2);lo=Math.max(0,lo-pad);hi+=pad;
  if(hi<=lo)hi=lo+1;
  const Y=v=>margin.top+(hi-v)/(hi-lo)*ch;
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','chart-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${series.map(s=>s.name).join(', ')} grafikonja ${unit} egységben`);
  const el=(name,attrs={},str=null)=>{const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(str!==null)n.textContent=String(str);svg.append(n);return n;};
  for(let i=0;i<5;i++){
    const v=lo+(hi-lo)*i/4,y=Y(v);
    el('line',{x1:margin.left,x2:W-margin.right,y1:y,y2:y,stroke:'#2e435b','stroke-width':1,'stroke-dasharray':'3 5'});
    el('text',{x:margin.left-9,y:y+4,'text-anchor':'end',fill:'#8fa5b8','font-size':11},format(v,Math.abs(hi-lo)>30?0:1));
  }
  const tickCount=Math.min(5,dates.length);
  const selected=[];for(let i=0;i<tickCount;i++){const idx=Math.round(i*(dates.length-1)/Math.max(tickCount-1,1));if(!selected.includes(idx))selected.push(idx);}
  for(const idx of selected){const x=X(dates[idx]);el('text',{x,y:H-9,'text-anchor':'middle',fill:'#8fa5b8','font-size':11},shortDate(dates[idx]));}
  for(const s of series){const clean=s.data.filter(p=>Number.isFinite(p.value)&&safeDate(p.date)).sort((a,b)=>a.date.localeCompare(b.date));
    if(!clean.length)continue;
    const path=clean.map((p,i)=>(i===0?'M':'L')+X(p.date).toFixed(2)+','+Y(p.value).toFixed(2)).join(' ');
    if(clean.length>1)el('path',{d:path,fill:'none',stroke:s.color,'stroke-width':2.7,'stroke-linecap':'round','stroke-linejoin':'round'});
    for(const p of clean){el('circle',{cx:X(p.date),cy:Y(p.value),r:clean.length>25?2.6:3.8,fill:s.color,stroke:'#14243a','stroke-width':1.3});}
  }
  host.append(svg);
}
function workoutWeeklySeries(){
  const exercise=$('exercise-filter').value,metric=$('workout-metric').value;
  const items=workouts.filter(r=>r.name===exercise);
  const groups=new Map();
  for(const r of items){const week=startOfWeek(r.date);if(!groups.has(week))groups.set(week,[]);groups.get(week).push(r);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>{
    const value=metric==='volume'?rows.reduce((sum,r)=>sum+volume(r),0):metric==='maxLoad'?Math.max(...rows.map(r=>r.weight)):
      Math.max(...rows.map(estimated1RM).filter(Number.isFinite));
    return {date,value:Number.isFinite(value)?value:null};
  });
}
function renderCharts(){
  if(activePage==='dashboard'){
    lineChart('dash-weight-chart',[
      {name:'Napi testsúly',color:'#64e1d0',data:weights.map(r=>({date:r.date,value:r.weight}))},
      {name:'Heti átlag',color:'#a4a0ff',data:weeklyWeights(weights).map(r=>({date:r.week,value:r.average}))}
    ],'kg');
    const m=$('dash-body-metric').value;
    const data=m==='bmi'?weights.map(r=>({date:r.date,value:bmi(r.weight,profile.height)})):
      measurements.map(r=>({date:r.date,value:m==='fat'?navyFat(profile.sex,profile.height,r.neck,r.waist,r.hip):m==='neck'?r.neck:r.waist}));
    lineChart('dash-body-chart',[{name:m,color:'#a4a0ff',data}],m==='fat'?'%':m==='bmi'?'BMI':'cm');
  }
  if(activePage==='workout'){
    const m=$('workout-metric').value;
    lineChart('workout-chart',[{name:m,color:'#65e0cf',data:workoutWeeklySeries()}],'kg');
  }
}
function validRange(value,min,max,name){if(!Number.isFinite(value)||value<min||value>max)throw Error(`${name}: adj meg ${min}–${max} közötti értéket.`);}
function confirmDelete(label){return window.confirm(`Biztosan törölni szeretnéd ezt a bejegyzést?\n${label}`);}
function resetWorkoutForm(){ $('workout-form').reset();$('workout-edit-id').value='';$('workout-date').value=today();$('workout-sets').value='3';$('workout-reps').value='8';$('workout-save').textContent='Gyakorlat mentése';}
function resetWeightForm(){ $('weight-form').reset();$('weight-date').value=today();}
function resetMeasureForm(){ $('measure-form').reset();$('measure-date').value=today();showSexFields();}
async function onWeightSubmit(e){
  e.preventDefault();try{const date=$('weight-date').value,weight=decimal($('weight-value').value);if(!safeDate(date))throw Error('Érvénytelen dátum.');validRange(weight,20,400,'Testsúly');
    await operation('weights','put',{date,weight,bmi:bmi(weight,profile.height)});await refreshData();resetWeightForm();notify('Testsúly rögzítve.');
  }catch(err){showError(err);}
}
async function onMeasureSubmit(e){
  e.preventDefault();try{
    const date=$('measure-date').value,neck=decimal($('measure-neck').value),waist=decimal($('measure-waist').value),hip=profile.sex==='female'?decimal($('measure-hip').value):null;
    if(!safeDate(date))throw Error('Érvénytelen dátum.');validRange(neck,20,80,'Nyak');validRange(waist,30,250,'Derék/has');if(profile.sex==='female')validRange(hip,40,250,'Csípő');
    if(profile.sex==='male'&&waist<=neck)throw Error('A haskörfogatnak nagyobbnak kell lennie a nyakkörfogatnál.');
    if(profile.sex==='female'&&waist+hip<=neck)throw Error('Érvénytelen körfogatadatok.');
    const fat=navyFat(profile.sex,profile.height,neck,waist,hip);
    await operation('measurements','put',{date,neck,waist,hip,bodyFatPercent:fat});await refreshData();resetMeasureForm();
    notify(fat===null?'Mérés mentve. A testzsírbecsléshez érvényes magasság és mérések kellenek.':'Körfogatmérés és testzsírbecslés mentve.');
  }catch(err){showError(err);}
}
async function onWorkoutSubmit(e){
  e.preventDefault();try{
    const id=$('workout-edit-id').value||uid(),date=$('workout-date').value,name=$('workout-name').value.trim();
    const sets=decimal($('workout-sets').value),reps=decimal($('workout-reps').value),weight=decimal($('workout-load').value),note=$('workout-note').value.trim();
    if(!safeDate(date))throw Error('Érvénytelen dátum.');if(!name||name.length>90)throw Error('A gyakorlat neve nem lehet üres.');
    validRange(sets,1,30,'Sorozat');validRange(reps,1,100,'Ismétlés');validRange(weight,0,1000,'Súly');
    if(!Number.isInteger(sets)||!Number.isInteger(reps))throw Error('A sorozat és ismétlés egész szám legyen.');
    await operation('workouts','put',{id,date,name,sets,reps,weight,note});await refreshData();resetWorkoutForm();notify('Edzésbejegyzés mentve.');
  }catch(err){showError(err);}
}
async function onProfileSubmit(e){
  e.preventDefault();try{
    const height=decimal($('profile-height').value),sex=$('profile-sex').value,goal=decimal($('profile-goal').value),name=$('profile-name').value.trim();
    validRange(height,100,250,'Magasság');if(!['male','female'].includes(sex))throw Error('Érvénytelen képletválasztás.');if(goal!==null)validRange(goal,20,400,'Céltestsúly');
    await storeProfileAndDerived({id:'main',height,sex,goal,name});await refreshData();notify('Profil és számított mutatók frissítve.');
  }catch(err){showError(err);}
}
async function onTableClick(e){
  const btn=e.target.closest('button[data-action]');if(!btn)return;
  const action=btn.dataset.action,id=btn.dataset.id;
  try{
    if(action==='delete-weight'||action==='delete-measure'||action==='delete-workout'){
      if(!confirmDelete(id))return;
      const store=action==='delete-weight'?'weights':action==='delete-measure'?'measurements':'workouts';
      await operation(store,'delete',id);await refreshData();notify('Bejegyzés törölve.');return;
    }
    if(action==='edit-weight'){
      const r=weights.find(x=>x.date===id);if(!r)return;$('weight-date').value=r.date;$('weight-value').value=r.weight;changePage('body');$('weight-form').scrollIntoView({behavior:'smooth',block:'start'});notify('Módosítsd az értéket, majd mentsd el.');
    }else if(action==='edit-measure'){
      const r=measurements.find(x=>x.date===id);if(!r)return;$('measure-date').value=r.date;$('measure-neck').value=r.neck;$('measure-waist').value=r.waist;$('measure-hip').value=r.hip??'';changePage('body');$('measure-form').scrollIntoView({behavior:'smooth',block:'start'});notify('Módosítsd az értékeket, majd mentsd el.');
    }else if(action==='edit-workout'){
      const r=workouts.find(x=>x.id===id);if(!r)return;
      $('workout-edit-id').value=r.id;$('workout-date').value=r.date;$('workout-name').value=r.name;$('workout-sets').value=r.sets;$('workout-reps').value=r.reps;$('workout-load').value=r.weight;$('workout-note').value=r.note||'';$('workout-save').textContent='Módosítás mentése';
      changePage('workout');$('workout-form').scrollIntoView({behavior:'smooth',block:'start'});
    }
  }catch(err){showError(err);}
}
function download(name,content,mime){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function exportJSON(){
  const contents={app:'FitNapló',schemaVersion:1,exportedAt:new Date().toISOString(),profile,weights,measurements,workouts};
  download('fitnaplo-mentes-'+today()+'.json',JSON.stringify(contents,null,2),'application/json;charset=utf-8');notify('Biztonsági mentés letöltése elindítva.');
}
function exportCSV(){
  const header=['tipus','datum','gyakorlat','testsuly_kg','nyak_cm','derek_has_cm','csipo_cm','bmi','testzsir_szazalek','sorozat','ismetles','suly_kg','volumen_kg','megjegyzes'];
  const rows=[header];
  for(const r of weights)rows.push(['testsuly',r.date,'',r.weight,'','','',bmi(r.weight,profile.height),'','','','','','']);
  for(const r of measurements)rows.push(['korfogat',r.date,'','',r.neck,r.waist,r.hip??'','',navyFat(profile.sex,profile.height,r.neck,r.waist,r.hip),'','','','','']);
  for(const r of workouts)rows.push(['edzes',r.date,r.name,'','','','','','',r.sets,r.reps,r.weight,volume(r),r.note||'']);
  const escapeCell=v=>{let s=v===null||v===undefined?'':typeof v==='number'?String(v).replace('.',','):String(v);return '"'+s.replaceAll('"','""')+'"';};
  download('fitnaplo-tablazat-'+today()+'.csv','\uFEFF'+rows.map(row=>row.map(escapeCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');notify('CSV exportálás elindítva.');
}
function validateBackup(data){
  if(!data||data.app!=='FitNapló'||data.schemaVersion!==1)throw Error('Nem kompatibilis FitNapló-mentés.');
  if(!['weights','measurements','workouts'].every(k=>Array.isArray(data[k])&&data[k].length<=200000))throw Error('Érvénytelen vagy túl nagy mentés.');
  const p=data.profile;if(!p||!['male','female'].includes(p.sex))throw Error('Hiányzó vagy hibás profil.');
  if(p.height!==null)validRange(p.height,100,250,'Magasság');
  if(p.goal!==null&&p.goal!==undefined)validRange(p.goal,20,400,'Cél');
  const uniqueWeight=new Set(),uniqueMeasure=new Set(),uniqueWorkout=new Set();
  for(const w of data.weights){if(!safeDate(w.date)||uniqueWeight.has(w.date))throw Error('Hibás / ismétlődő testsúlydátum.');uniqueWeight.add(w.date);validRange(w.weight,20,400,'Testsúly');}
  for(const m of data.measurements){if(!safeDate(m.date)||uniqueMeasure.has(m.date))throw Error('Hibás / ismétlődő körfogatdátum.');uniqueMeasure.add(m.date);validRange(m.neck,20,80,'Nyak');validRange(m.waist,30,250,'Derék/has');if(m.hip!==null&&m.hip!==undefined)validRange(m.hip,40,250,'Csípő');}
  for(const w of data.workouts){if(typeof w.id!=='string'||!w.id||uniqueWorkout.has(w.id)||!safeDate(w.date)||typeof w.name!=='string'||!w.name.trim()||w.name.length>90)throw Error('Érvénytelen edzésbejegyzés.');uniqueWorkout.add(w.id);validRange(w.sets,1,30,'Sorozat');validRange(w.reps,1,100,'Ismétlés');validRange(w.weight,0,1000,'Edzéssúly');if(!Number.isInteger(w.sets)||!Number.isInteger(w.reps))throw Error('Hibás ismétlés- vagy sorozatszám.');}
  return {profile:{id:'main',sex:p.sex,height:p.height??null,goal:p.goal??null,name:String(p.name||'').slice(0,50)},weights:data.weights.map(({date,weight})=>({date,weight,bmi:bmi(weight,p.height)})),measurements:data.measurements.map(({date,neck,waist,hip})=>({date,neck,waist,hip:hip??null,bodyFatPercent:navyFat(p.sex,p.height,neck,waist,hip)})),workouts:data.workouts.map(({id,date,name,sets,reps,weight,note})=>({id,date,name,sets,reps,weight,note:String(note||'').slice(0,180)}))};
}
async function restoreJSON(){
  try{
    const file=$('import-file').files[0];if(!file)throw Error('Először válassz egy JSON mentésfájlt.');
    if(file.size>15*1024*1024)throw Error('A fájl mérete meghaladja a 15 MB-ot.');
    const backup=validateBackup(JSON.parse(await file.text()));
    if(!window.confirm(`Visszaállítod ezt a mentést?\nTestsúly: ${backup.weights.length}, körfogat: ${backup.measurements.length}, edzés: ${backup.workouts.length} bejegyzés.\n\nA jelenlegi adatbázis TELJES TARTALMA lecserélődik. Előtte készíts biztonsági mentést.`))return;
    requireDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAMES,'readwrite');
      for(const store of STORE_NAMES)tx.objectStore(store).clear();
      tx.objectStore('profile').put(backup.profile);
      for(const name of ['weights','measurements','workouts'])for(const row of backup[name])tx.objectStore(name).put(row);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Visszaállítás megszakítva.'));
    });
    $('import-file').value='';await refreshData();notify('Mentés sikeresen visszaállítva.');
  }catch(err){showError(err);}
}
async function init(){
  const date=today();$('weight-date').value=date;$('measure-date').value=date;$('workout-date').value=date;
  document.querySelectorAll('.tabbar button').forEach(b=>b.addEventListener('click',()=>changePage(b.dataset.page)));
  $('weight-form').addEventListener('submit',onWeightSubmit);$('measure-form').addEventListener('submit',onMeasureSubmit);
  $('workout-form').addEventListener('submit',onWorkoutSubmit);$('profile-form').addEventListener('submit',onProfileSubmit);
  $('weight-reset').addEventListener('click',resetWeightForm);$('measure-reset').addEventListener('click',resetMeasureForm);$('workout-reset').addEventListener('click',resetWorkoutForm);
  document.addEventListener('click',onTableClick);
  $('dash-body-metric').addEventListener('change',renderCharts);$('exercise-filter').addEventListener('change',renderCharts);$('workout-metric').addEventListener('change',renderCharts);
  $('export-json').addEventListener('click',exportJSON);$('export-csv').addEventListener('click',exportCSV);$('restore-json').addEventListener('click',restoreJSON);
  if('ResizeObserver' in globalThis){let raf;const resize=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(renderCharts);});document.querySelectorAll('.chart-host').forEach(x=>resize.observe(x));}
  try{db=await openDatabase();await refreshData();$('storage-status').textContent='A helyi adatbázis működik. Készíts rendszeresen JSON biztonsági mentést.';}
  catch(e){showError(e);$('storage-status').textContent='Az adatbázis nem érhető el: '+e.message;document.querySelectorAll('form button[type=submit]').forEach(b=>b.disabled=true);}
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline gyorsítótár nem telepíthető:',e));
  }
}
window.addEventListener('DOMContentLoaded',init);
