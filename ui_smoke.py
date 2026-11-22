from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text().replace('<script src="app.js" defer></script>','').replace('<link rel="stylesheet" href="styles.css">','').replace('<link rel="manifest" href="manifest.webmanifest">','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
 page=ctx.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(root/'styles.css').read_text())
 page.add_script_tag(content=(root/'app.js').read_text())
 page.evaluate('''async()=>{
    const map={profile:new Map(),weights:new Map(),measurements:new Map(),workouts:new Map(),plans:new Map()};
    const mockDB={transaction:()=>{let tx={};tx.objectStore=(store)=>({put(row){map[store].set(row.date||row.id,row)},clear(){map[store].clear()}});queueMicrotask(()=>tx.oncomplete?.());return tx;}};
    openDatabase=async()=>mockDB;
    operation=async(store,method,...args)=>{
      if(method==='get')return map[store].get(args[0]);
      if(method==='getAll')return [...map[store].values()];
      if(method==='put'){map[store].set(args[0].date||args[0].id,args[0]);return args[0];}
      if(method==='delete'){map[store].delete(args[0]);return undefined;}
    };
    await init();
  }''')
 assert page.locator('#storage-status').inner_text().startswith('A helyi adatbázis működik')
 today=datetime.now().strftime('%Y-%m-%d')
 for id in ['weight-date','measure-date','workout-date','plan-session-date']:
  assert page.locator('#'+id).input_value()==today,id
 page.locator('[data-page=body]').click()
 for id,form in [('weight-date','weight-form'),('measure-date','measure-form')]:
  a=page.locator('#'+id).bounding_box();b=page.locator('#'+form).bounding_box();assert a['x']>=b['x'] and a['x']+a['width']<=b['x']+b['width']+1,(id,a,b)
 page.locator('#weight-value').fill('85.2')
 page.locator('#weight-form button[type=submit]').click();page.wait_for_timeout(200)
 assert '85,2' in page.locator('#weights-table').inner_text()
 page.locator('[data-page=workout]').click()
 page.locator('#new-plan-name').fill('A nap – felsőtest')
 page.locator('#create-plan-form button[type=submit]').click();page.wait_for_timeout(100)
 for name in ['Fekvenyomás','Evezés']:
  page.locator('#new-plan-exercise').fill(name)
  page.locator('#add-exercise-form button[type=submit]').click();page.wait_for_timeout(100)
 assert page.locator('.session-exercise').count()==2
 node=page.locator('.session-exercise').first
 node.locator('input[data-field=sets]').fill('3');node.locator('input[data-field=reps]').fill('8');node.locator('input[data-field=weight]').fill('60')
 page.locator('#save-plan-session').click();page.wait_for_timeout(200)
 assert page.locator('#workouts-table tbody tr').count()==1, page.locator('#workouts-table').inner_text()
 node=page.locator('.session-exercise').first;node.locator('input[data-field=weight]').fill('62.5')
 page.locator('#save-plan-session').click();page.wait_for_timeout(200)
 assert page.locator('#workouts-table tbody tr').count()==1
 page.locator('#plan-session-date').fill('2026-11-20')
 node=page.locator('.session-exercise').first
 node.locator('input[data-field=sets]').fill('3');node.locator('input[data-field=reps]').fill('10');node.locator('input[data-field=weight]').fill('55')
 page.locator('#save-plan-session').click();page.wait_for_timeout(200)
 assert page.locator('#workouts-table tbody tr').count()==2, page.locator('#workouts-table').inner_text()
 page.screenshot(path='/mnt/data/fitnaplo_v1_1_edzesterv_elonezet.png',full_page=True)
 page.locator('[data-page=dashboard]').click()
 assert 'BMI' in page.locator('#dashboard-interpretation').inner_text()
 assert not errors,errors
 print('PASS: 390px date-box containment, today dates, weight input, create/edit plan, session save/upsert, historical date, interpretations')
 browser.close()
