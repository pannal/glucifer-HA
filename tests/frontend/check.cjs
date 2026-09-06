const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:640,height:720}});
  const errors=[];page.on('pageerror', error=>errors.push(String(error)));
  await page.setContent('<style>body{font-family:Arial;background:#f4f6f8;--primary-color:#007d82;--secondary-text-color:#58656d;--warning-color:#a05300}ha-card{display:block;background:white;border-radius:16px}</style><glucifer-card></glucifer-card>');
  await page.addScriptTag({path:path.join(__dirname, '../../custom_components/glucifer/frontend/glucifer-card.js')});
  await page.evaluate(()=>{
    const now=Date.now();
    const entities={glucose:'sensor.phone_glucose',trend:'sensor.phone_trend',delta_mgdl:'sensor.phone_delta',reading_age:'sensor.phone_age',connected:'binary_sensor.phone_connected',stale:'binary_sensor.phone_stale',alert_high:'binary_sensor.phone_high'};
    const state=(state,attributes={})=>({state,attributes});
    window.fixture={states:{'sensor.phone_glucose':state('123',{unit_of_measurement:'mg/dL'}),'sensor.phone_trend':state('Flat'),'sensor.phone_delta':state('0',{unit_of_measurement:'mg/dL'}),'sensor.phone_age':state('60'),'binary_sensor.phone_connected':state('on'),'binary_sensor.phone_stale':state('off'),'binary_sensor.phone_high':state('on',{friendly_name:'High glucose alert <img src=x onerror=alert(1)>'})},callWS:async()=>({entities,unit:'mg/dL',readings:[{time_ms:now-7200000,mgdl:100},{time_ms:now-7140000,mgdl:110},{time_ms:now-60000,mgdl:123},{time_ms:now,mgdl:123}]})};
    const card=document.querySelector('glucifer-card');
    card.setConfig({entity:'sensor.phone_glucose',hours:6});card.hass=window.fixture;
    card.addEventListener('hass-more-info',event=>window.moreInfo=event.detail.entityId);
  });
  await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.history').textContent.startsWith('4 readings'));
  const root=page.locator('glucifer-card');
  assert.equal(await root.locator('.glucose').textContent(),'123 mg/dL');
  assert.equal(await root.locator('.range').textContent(),'100 to 123 mg/dL');
  assert.equal(await root.locator('.trend').textContent(),'→');
  assert.equal(await root.locator('.summary').textContent(),'Δ 0.0 mg/dL · Reading 1 min old');
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='FortyFiveDown';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.trend').textContent(),'↘');
  const glucoseBox=await root.locator('.glucose').boundingBox();
  const trendBox=await root.locator('.trend').boundingBox();
  assert.ok(trendBox.x>=glucoseBox.x+glucoseBox.width && Math.abs(trendBox.y-glucoseBox.y)<2);
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='unavailable';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.trend').textContent(),'');
  assert.equal(await root.locator('.summary').textContent(),'Δ 0.0 mg/dL · Reading 1 min old');
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='Flat';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal((await root.locator('path').getAttribute('d')).match(/M/g).length,2);
  assert.equal(await root.locator('img').count(),0);
  await root.locator('button').click();assert.equal(await page.evaluate(()=>window.moreInfo),'sensor.phone_glucose');
  if (process.env.GLUCIFER_SCREENSHOT) await page.screenshot({path:process.env.GLUCIFER_SCREENSHOT});
  await page.evaluate(()=>{window.fixture.states['sensor.phone_glucose']={state:'6.8',attributes:{unit_of_measurement:'mmol/L'}};window.fixture.states['binary_sensor.phone_stale'].state='on';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.glucose').textContent(),'6.8 mmol/L');
  assert.match(await root.locator('.health').textContent(),/stale/);
  await page.evaluate(()=>{window.fixture.states['sensor.phone_glucose'].state='unavailable';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.glucose').textContent(),'Unavailable');
  assert.equal(await root.locator('.trend').textContent(),'');
  // The card exposes HA's native form contract; no hand-written YAML editor.
  const form = await page.evaluate(() => {
    const type = customElements.get('glucifer-card');
    const form = type.getConfigForm();
    return {schema:form.schema, defaults:type.getStubConfig(window.fixture), helper:form.computeHelper({name:'low'})};
  });
  const fields = form.schema.flatMap(field => field.schema || [field]);
  assert.ok(fields.find(field => field.name === 'entity').selector.entity);
  assert.ok(fields.find(field => field.name === 'glucose_normal_color').selector.color_rgb);
  assert.ok(fields.find(field => field.name === 'trend_falling_color').selector.color_rgb);
  assert.equal(form.defaults.show_journal, false);
  assert.equal(form.defaults.journal_days, 7);
  assert.equal(form.defaults.journal_limit, 25);
  assert.match(form.helper, /70 mg\/dL/);
  assert.equal(await page.evaluate(() => {
    try { customElements.get('glucifer-card').getConfigForm().assertConfig({low:200,high:180}); return false; }
    catch { return true; }
  }), true);
  await page.evaluate(() => {
    const now = Date.now();
    window.journal = [
      {id:'j1',time_ms:now-7200000,kind:'insulin',amount:0.05,label:'Insulin'},
      {id:'j2',time_ms:now-3600000,kind:'carbs',amount:25,label:'Carbohydrates',note:'<img src=x onerror=alert(1)>'},
      {id:'j3',time_ms:now-60000,kind:'note',label:'Note',note:'Sample note'},
      {id:'j4',time_ms:now-2*86400000,kind:'carbs',amount:10,label:'Older carbs'},
    ];
    window.fetches=0;window.removed=0;
    const history=window.fixture.callWS;
    window.fixture.callWS=async message => { window.fetches++;return {...await history(message),journal:window.journal,journal_enabled:true,journal_history_days:7}; };
    window.fixture.connection={subscribeMessage:async (callback,message) => {window.notifyJournal=callback;window.subscribed=message;return () => {window.removed++;};}};
    window.fixture.states['sensor.phone_glucose']={state:'123',attributes:{unit_of_measurement:'mg/dL'}};
    window.fixture.states['sensor.phone_trend'].state='FortyFiveDown';
    const card=document.querySelector('glucifer-card');
    card.hass=window.fixture;
    card.setConfig({entity:'sensor.phone_glucose',hours:6,show_journal:true,journal_limit:2,journal_days:1});
  });
  await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelectorAll('.journal-marker').length===3);
  assert.equal(await root.locator('.journal-list button').count(),2);
  assert.equal(await root.locator('.glucose').evaluate(el=>el.style.color),'rgb(67, 160, 71)');
  assert.equal(await root.locator('.trend').evaluate(el=>el.style.color),'rgb(251, 140, 0)');
  assert.equal(await root.locator('circle.journal-marker').getAttribute('cy'),'177');
  assert.equal(Math.round(Number(await root.locator('circle.journal-marker').getAttribute('cx'))),500);
  await root.locator('circle.journal-marker').click();
  assert.match(await root.locator('.journal-selection').textContent(), /25 g/);
  assert.match(await root.locator('.journal-selection').textContent(), /<img src=x/);
  assert.equal(await root.locator('img').count(),0);
  await root.locator('polygon.journal-marker').focus();
  await page.keyboard.press('Enter');
  assert.match(await root.locator('.journal-selection').textContent(), /0.05 U/);
  const fetches=await page.evaluate(()=>window.fetches);
  await page.evaluate(()=>{window.journal=window.journal.filter(e=>e.id!=='j3').map(e=>e.id==='j2'?{...e,amount:30}:e);window.notifyJournal({changed:true});});
  await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelectorAll('.journal-marker').length===2);
  assert.equal(await page.evaluate(()=>window.fetches),fetches+1);
  assert.match(await root.locator('.journal-list').textContent(),/30 g/);
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    window.fixture.states['sensor.phone_glucose']={state:'6.8',attributes:{unit_of_measurement:'mmol/L'}};
    card.setConfig({entity:'sensor.phone_glucose',show_history:false,show_journal:true,journal_types:['insulin'],glucose_normal_color:[1,2,3],trend_falling_color:[4,5,6]});
  });
  await page.waitForFunction(()=>!document.querySelector('glucifer-card').loading);
  assert.equal(await root.locator('.glucose').evaluate(el=>el.style.color),'rgb(1, 2, 3)');
  assert.equal(await root.locator('.trend').evaluate(el=>el.style.color),'rgb(4, 5, 6)');
  assert.equal(await root.locator('svg').isVisible(),false);
  assert.equal(await root.locator('.journal-list button').count(),1);
  await page.setViewportSize({width:360,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // An entity change during an outstanding request must fetch the new entity.
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    const original=window.fixture.callWS;
    window.fixture.callWS=message => new Promise(resolve => {window.resolveOld=()=>resolve({readings:[],journal:[],entities:{},unit:'mg/dL'});window.fixture.callWS=async next=>{window.requestedEntity=next.entity_id;return original(next);};});
    card.refresh(true);
    card.setConfig({entity:'sensor.other_glucose'});
    window.resolveOld();
  });
  await page.waitForFunction(()=>window.requestedEntity==='sensor.other_glucose'&&!document.querySelector('glucifer-card').loading);
  const unsubscribed=await page.evaluate(()=>window.removed);
  await page.evaluate(()=>document.querySelector('glucifer-card').remove());
  assert.equal(await page.evaluate(()=>window.removed),unsubscribed+1);
  assert.deepEqual(errors,[]);
  await browser.close();console.log('Dashboard browser checks passed: values, units, history gaps, stale/unavailable states, safe text rendering, more-info interaction, native editor schema, independent colors, journal markers/details/filters, live edits/deletes, mobile layout, subscription cleanup and entity-switch race.');
})();
