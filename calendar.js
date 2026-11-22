'use strict';
/* FitNapló 1.3 — Saját, mobilképernyőhöz igazodó dátumválasztó. */
(() => {
  let currentField=null, returnFocus=null, year=0, month=0;
  const overlay=document.createElement('div');
  overlay.id='calendar-overlay';
  overlay.className='calendar-overlay hidden';
  overlay.innerHTML=
    '<div class="calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-title" tabindex="-1">'+
    '<div class="calendar-top"><h2 id="calendar-title">Válassz dátumot</h2><button type="button" class="calendar-close" data-calendar-action="close" aria-label="Bezárás">×</button></div>'+
    '<div class="calendar-controls"><button type="button" class="calendar-arrow" data-calendar-action="prev" aria-label="Előző hónap">‹</button>'+
    '<select id="calendar-month" aria-label="Hónap"></select><select id="calendar-year" aria-label="Év"></select>'+
    '<button type="button" class="calendar-arrow" data-calendar-action="next" aria-label="Következő hónap">›</button></div>'+
    '<div class="calendar-weekdays" aria-hidden="true"><span>H</span><span>K</span><span>Sze</span><span>Cs</span><span>P</span><span>Szo</span><span>V</span></div>'+
    '<div class="calendar-days" id="calendar-days" role="group" aria-label="Nap kiválasztása"></div>'+
    '<div class="calendar-bottom"><button type="button" data-calendar-action="today" class="primary">Ma</button><button type="button" data-calendar-action="close">Mégse</button></div></div>';
  document.body.append(overlay);
  const months=['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
  const monthSelect=overlay.querySelector('#calendar-month');
  const yearSelect=overlay.querySelector('#calendar-year');
  const days=overlay.querySelector('#calendar-days');
  const dialog=overlay.querySelector('.calendar-dialog');
  const two=n=>String(n).padStart(2,'0');
  const iso=(y,m,d)=>y+'-'+two(m+1)+'-'+two(d);
  const today=()=>{const d=new Date();return iso(d.getFullYear(),d.getMonth(),d.getDate());};
  const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
  const upperYear=Math.max(2100,new Date().getFullYear()+20);
  months.forEach((name,i)=>{const option=new Option(name,String(i));monthSelect.add(option);});
  for(let y=1900;y<=upperYear;y++)yearSelect.add(new Option(String(y),String(y)));
  function draw(){
    monthSelect.value=String(month);yearSelect.value=String(year);days.replaceChildren();
    const offset=(new Date(year,month,1).getDay()+6)%7;
    for(let i=0;i<offset;i++){
      const blank=document.createElement('span');blank.className='calendar-blank';blank.setAttribute('aria-hidden','true');days.append(blank);
    }
    const last=new Date(year,month+1,0).getDate();
    for(let day=1;day<=last;day++){
      const value=iso(year,month,day),btn=document.createElement('button');
      btn.type='button';btn.className='calendar-day';btn.textContent=String(day);
      btn.dataset.calendarDate=value;
      btn.setAttribute('aria-label',year+'. '+months[month]+' '+day+'.');
      if(value===today())btn.classList.add('today');
      if(value===currentField?.value){btn.classList.add('selected');btn.setAttribute('aria-pressed','true');}
      days.append(btn);
    }
  }
  function show(id,trigger){
    const field=document.getElementById(id);if(!field)return;
    currentField=field;returnFocus=trigger;
    const selected=isDate(field.value)?field.value:today();
    const p=selected.split('-').map(Number);year=p[0];month=p[1]-1;draw();
    overlay.classList.remove('hidden');document.body.classList.add('calendar-open');
    dialog.focus({preventScroll:true});
  }
  function close(){
    overlay.classList.add('hidden');document.body.classList.remove('calendar-open');
    const target=returnFocus;currentField=null;returnFocus=null;
    if(target&&target.isConnected)target.focus({preventScroll:true});
  }
  function choose(value){
    if(!currentField||!isDate(value))return;
    currentField.value=value;
    currentField.dispatchEvent(new Event('input',{bubbles:true}));
    currentField.dispatchEvent(new Event('change',{bubbles:true}));
    if(typeof syncDateControls==='function')syncDateControls();
    close();
  }
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('.date-trigger');
    if(trigger){show(trigger.dataset.dateFor,trigger);return;}
    if(e.target===overlay)close();
  });
  overlay.addEventListener('click',e=>{
    const selected=e.target.closest('[data-calendar-date]');
    if(selected){choose(selected.dataset.calendarDate);return;}
    const action=e.target.closest('[data-calendar-action]')?.dataset.calendarAction;
    if(action==='close')close();
    if(action==='today')choose(today());
    if(action==='prev'||action==='next'){
      const next=new Date(year,month+(action==='prev'?-1:1),1);
      if(next.getFullYear()<1900||next.getFullYear()>upperYear)return;
      year=next.getFullYear();month=next.getMonth();draw();
    }
  });
  monthSelect.addEventListener('change',()=>{month=Number(monthSelect.value);draw();});
  yearSelect.addEventListener('change',()=>{year=Number(yearSelect.value);draw();});
  document.addEventListener('keydown',e=>{
    if(overlay.classList.contains('hidden'))return;
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){
      const nodes=[...overlay.querySelectorAll('button:not([disabled]),select:not([disabled])')].filter(x=>x.offsetParent!==null);
      const first=nodes[0],last=nodes[nodes.length-1];
      if(!first||!last)return;
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
})();