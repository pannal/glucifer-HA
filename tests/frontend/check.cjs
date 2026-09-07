const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:640,height:720},timezoneId:'UTC'});
  await page.route('http://glucifer.test/**', route => new URL(route.request().url()).pathname === '/glucifer/mark.svg'
    ? route.fulfill({contentType:'image/svg+xml',path:path.join(__dirname,'../../custom_components/glucifer/brand/mark.svg')})
    : route.fulfill({contentType:'text/html',body:'<body></body>'}));
  await page.goto('http://glucifer.test/');
  await page.clock.install({time:new Date('2026-09-06T12:00:00Z')});
  await page.clock.pauseAt(new Date('2026-09-06T12:00:00Z'));
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
  assert.equal(await root.locator('.summary').textContent(),'Δ 0.0 mg/dL · Reading 1m 0s old');
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='FortyFiveDown';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.trend').textContent(),'↘');
  const glucoseBox=await root.locator('.glucose').boundingBox();
  const trendBox=await root.locator('.trend').boundingBox();
  assert.ok(trendBox.x>=glucoseBox.x+glucoseBox.width && trendBox.height>glucoseBox.height && trendBox.x+trendBox.width>580);
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='unavailable';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.trend').textContent(),'');
  assert.equal(await root.locator('.summary').textContent(),'Δ 0.0 mg/dL · Reading 1m 0s old');
  await page.evaluate(()=>{window.fixture.states['sensor.phone_trend'].state='Flat';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal((await root.locator('.history-chart path').getAttribute('d')).match(/M/g).length,2);
  assert.equal(await root.locator('img:not(.brand-logo)').count(),0);
  await root.locator('ha-card > button').click();assert.equal(await page.evaluate(()=>window.moreInfo),'sensor.phone_glucose');
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
    window.notifyJournal({}); // Publish the newly added history through the live subscription.
  });
  await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelectorAll('.journal-marker').length===3);
  assert.equal(await root.locator('.journal-entry-toggle').count(),2);
  assert.equal(await root.locator('.glucose').evaluate(el=>el.style.color),'rgb(67, 160, 71)');
  assert.equal(await root.locator('.trend').evaluate(el=>el.style.color),'rgb(251, 140, 0)');
  assert.equal(await root.locator('circle.journal-marker').getAttribute('cy'),'177');
  assert.equal(Math.round(Number(await root.locator('circle.journal-marker').getAttribute('cx'))),500);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_journal_symbols=true;card.render();});
  await root.locator('circle.journal-marker').click();
  assert.match(await root.locator('.journal-selection').textContent(), /25 g/);
  assert.match(await root.locator('.journal-selection').textContent(), /<img src=x/);
  assert.equal(await root.locator('img:not(.brand-logo)').count(),0);
  // Native details remembers the browser's choice across a newly created card.
  assert.equal(await root.locator('.journal-section').getAttribute('open'),'');
  assert.equal(await root.locator('.journal-entry-toggle').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  const compactHeight=(await root.locator('.journal-section').boundingBox()).height;
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.journal_compact=false;card.render();});
  assert.ok((await root.locator('.journal-section').boundingBox()).height>compactHeight);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.journal_compact=true;card.render();});
  await root.locator('.journal-section summary').click();
  await page.waitForFunction(()=>localStorage.getItem(document.querySelector('glucifer-card').journalStorageKey)==='closed');
  await page.evaluate(()=>{
    const old=document.querySelector('glucifer-card'),config=old.config;
    old.remove();const card=document.createElement('glucifer-card');document.body.append(card);
    card.setConfig(config);card.hass=window.fixture;
  });
  await page.waitForFunction(()=>document.querySelector('glucifer-card').data && !document.querySelector('glucifer-card').loading);
  assert.equal(await root.locator('.journal-section').getAttribute('open'),null);
  await page.evaluate(()=>{document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.journal-list').isVisible(),false);
  await root.locator('.journal-section summary').click();
  await page.waitForFunction(()=>localStorage.getItem(document.querySelector('glucifer-card').journalStorageKey)==='open');
  await root.locator('circle.journal-marker').click();
  // Unrelated HA traffic must neither redraw the card nor dismiss journal details.
  await page.evaluate(() => {
    const card=document.querySelector('glucifer-card');
    window.savedClose=card.shadowRoot.querySelector('.journal-selection button');
    window.cardRenders=0;
    const render=card.render.bind(card);
    card.render=()=>{window.cardRenders++;return render();};
    window.fetchesBeforeUnrelated=window.fetches;
    for(let i=0;i<100;i++) {
      window.fixture.states['sensor.unrelated_clock']={state:String(i),attributes:{}};
      card.hass=window.fixture;
    }
  });
  assert.equal(await page.evaluate(()=>window.cardRenders),0);
  assert.equal(await page.evaluate(()=>window.fetches),await page.evaluate(()=>window.fetchesBeforeUnrelated));
  assert.equal(await root.locator('.journal-selection').isVisible(),true);
  await root.locator('.journal-selection button').focus();
  await page.evaluate(()=>{
    window.fixture.states['sensor.phone_glucose'].state='124';
    document.querySelector('glucifer-card').hass=window.fixture;
  });
  assert.equal(await root.locator('.glucose').textContent(),'124 mg/dL');
  assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').shadowRoot.activeElement===window.savedClose),true);
  // A relevant state change between mouse-down and mouse-up must not replace Close.
  await root.locator('.journal-selection button').hover();
  await page.mouse.down();
  await page.evaluate(()=>{
    window.fixture.states['sensor.phone_glucose'].state='125';
    document.querySelector('glucifer-card').hass=window.fixture;
  });
  await page.mouse.up();
  assert.equal(await root.locator('.journal-selection').isVisible(),false);
  await page.evaluate(()=>{
    window.fixture.states['sensor.phone_glucose'].state='126';
    document.querySelector('glucifer-card').hass=window.fixture;
  });
  assert.equal(await root.locator('.journal-selection').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-selection button')===window.savedClose),true);
  const rendersBeforeAge=await page.evaluate(()=>window.cardRenders);
  await page.evaluate(()=>{
    window.fixture.states['sensor.phone_age'].state='61';
    document.querySelector('glucifer-card').hass=window.fixture;
  });
  assert.equal(await page.evaluate(()=>window.cardRenders),rendersBeforeAge);
  await page.evaluate(()=>{
    window.fixture.states['sensor.phone_age'].state='120';
    document.querySelector('glucifer-card').hass=window.fixture;
  });
  assert.match(await root.locator('.summary').textContent(),/Reading 2m 0s old/);
  assert.equal(await page.evaluate(()=>window.cardRenders),rendersBeforeAge);
  // Seconds tick locally from measurement time, independently of HA traffic.
  await page.clock.setSystemTime(new Date('2026-09-06T12:00:00Z'));
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    card.data.entities.measurement_time='sensor.phone_measurement_time';
    window.fixture.states['sensor.phone_measurement_time']={state:'2026-09-06T11:59:18Z',attributes:{}};
    card.hass=window.fixture;
  });
  assert.match(await root.locator('.reading-age').textContent(),/Reading 42s old/);
  const ageFetches=await page.evaluate(()=>window.fetches);
  await page.clock.runFor(1000);
  assert.match(await root.locator('.reading-age').textContent(),/Reading 43s old/);
  assert.equal(await page.evaluate(()=>window.cardRenders),rendersBeforeAge);
  assert.equal(await page.evaluate(()=>window.fetches),ageFetches);
  await page.clock.setSystemTime(new Date('2026-09-06T12:00:00Z'));

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
  assert.equal(await root.locator('.history-chart').isVisible(),false);
  assert.equal(await root.locator('.journal-entry-toggle').count(),1);
  await page.setViewportSize({width:360,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Every sender field has a matching display control, including sensor identity.
  for (const key of ['trend','delta_mgdl','rate_mgdl_min','raw_mgdl','auto_mgdl','iob_u','eiob_u','cob_g','battery_percent','sensor_id','sensor_generation','sensor_started_ms','sensor_expires_ms','sensor_warmup']) {
    assert.ok(fields.find(field=>field.name===`show_${key}`)?.selector.boolean);
  }
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    window.fixture.locale={language:'de',time_format:'24',date_format:'DMY',time_zone:'server'};
    window.fixture.config={time_zone:'Europe/Berlin'};
    Object.assign(card.data.entities,{sensor_id:'sensor.id',sensor_generation:'sensor.gen',sensor_expires_ms:'sensor.expiry',sensor_warmup:'binary_sensor.warmup',iob_u:'sensor.iob'});
    Object.assign(window.fixture.states,{'sensor.id':{state:'ABC123',attributes:{}},'sensor.gen':{state:'3',attributes:{}},'sensor.expiry':{state:'2026-09-06T23:30:00+00:00',attributes:{}},'binary_sensor.warmup':{state:'off',attributes:{}},'sensor.iob':{state:'1.2',attributes:{unit_of_measurement:'U'}}});
    card.hass=window.fixture;
  });
  assert.match(await root.locator('.lifecycle').textContent(),/Sensorkennung: ABC123/);
  assert.match(await root.locator('.lifecycle').textContent(),/Sensorgeneration: 3/);
  assert.match(await root.locator('.lifecycle').textContent(),/Erwartetes Ende: 7\.9\.2026, 01:30/);
  assert.match(await root.locator('.lifecycle').textContent(),/Sensor in Aufwärmphase: Nein/);
  assert.match(await root.locator('.optional-values').textContent(),/Aktives Insulin: 1,2 E/);
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    card.config.show_sensor_id=false;card.config.show_sensor_generation=false;card.config.show_iob_u=false;card.render();
  });
  assert.doesNotMatch(await root.locator('.lifecycle').textContent(),/ABC123|Sensorgeneration/);
  assert.equal(await root.locator('.optional-values').isVisible(),false);
  await page.evaluate(()=>{window.fixture.locale={language:'en-US',date_format:'MDY',time_format:'12',time_zone:'local'};document.querySelector('glucifer-card').hass=window.fixture;});
  assert.match(await root.locator('.lifecycle').textContent(),/Expected end: 9\/6\/2026, 11:30 PM/);
  await page.evaluate(()=>{window.fixture.states['sensor.expiry'].state='unavailable';document.querySelector('glucifer-card').hass=window.fixture;});
  assert.doesNotMatch(await root.locator('.lifecycle').textContent(),/Expected end/);
  assert.equal(form.defaults.show_glucose_unit,true);
  assert.equal(fields.find(field=>field.name==='show_glucose_unit').default,true);
  assert.deepEqual(await page.evaluate(()=>{
    const form=customElements.get('glucifer-card').getConfigForm();
    form.assertConfig({entity:'sensor.phone_glucose',show_lifecycle:false,show_sensor_id:true,show_details:false});
    return Object.fromEntries(form.schema.flatMap(s=>s.schema||[s]).filter(s=>['show_sensor_id','show_sensor_generation','show_delta_mgdl','show_reading_age','show_glucose_unit'].includes(s.name)).map(s=>[s.name,s.default]));
  }),{show_sensor_id:true,show_sensor_generation:false,show_delta_mgdl:false,show_reading_age:false,show_glucose_unit:true});
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_glucose_unit=false;card.render();});
  assert.equal(await root.locator('.glucose').textContent(),'6.8');
  await page.evaluate(()=>{window.fixture.states['sensor.phone_glucose']={state:'139.0',attributes:{unit_of_measurement:'mg/dL'}};document.querySelector('glucifer-card').hass=window.fixture;});
  assert.equal(await root.locator('.glucose').textContent(),'139');
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_glucose_unit=true;card.render();});
  assert.equal(await root.locator('.glucose').textContent(),'139 mg/dL');
  // Size and logo controls retain the title/value layout, including double arrows.
  assert.equal(form.defaults.arrow_size,84);
  assert.equal(form.defaults.arrow_position,'glucose');
  assert.deepEqual(fields.find(field=>field.name==='arrow_position').selector.select.options.map(option=>option.value),['glucose','details']);
  assert.equal(form.defaults.show_logo,true);
  assert.equal(form.defaults.journal_compact,true);
  assert.equal(form.defaults.show_journal_symbols,false);
  await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.brand-logo').naturalWidth>0);
  assert.equal(await root.locator('img').count(),1);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_logo=false;card.render();});
  assert.equal(await root.locator('.brand-logo').isVisible(),false);
  await page.setViewportSize({width:800,height:900});
  for(const size of [24,84,160]) {
    await page.evaluate(size=>{const card=document.querySelector('glucifer-card');card.config.arrow_size=size;card.render();},size);
    assert.equal(await root.locator('.trend').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),size);
  }
  for(const width of [360,280]) {
    await page.setViewportSize({width,height:900});
    for(const trend of ['DoubleUp','DoubleDown','FortyFiveDown']) {
      await page.evaluate(trend=>{window.fixture.states['sensor.phone_trend'].state=trend;document.querySelector('glucifer-card').hass=window.fixture;},trend);
      const a=await root.locator('.trend').boundingBox(),g=await root.locator('.glucose').boundingBox();
      assert.ok(a.x>=g.x+g.width && a.x+a.width<=width);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
  }
  assert.equal(await page.evaluate(()=>{try{customElements.get('glucifer-card').getConfigForm().assertConfig({arrow_size:200});return false;}catch{return true;}}),true);
  // Size/alignment are native editor controls. SVG arrows share geometry and rotate about their center.
  await page.setViewportSize({width:800,height:900});
  for (const size of [24,42,72,96]) {
    await page.evaluate(size=>{const card=document.querySelector('glucifer-card');card.config.glucose_size=size;card.render();},size);
    assert.equal(await root.locator('.glucose').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),size);
  }
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.glucose_alignment='center';card.render();});
  assert.equal(await root.locator('.glucose').evaluate(el=>getComputedStyle(el).textAlign),'center');
  // Center means the card's center, independent of the arrow's width or visibility.
  for (const [width,size,arrow,unit,showUnit,showTrend] of [
    [528,64,84,'mg/dL',false,true], [800,96,160,'mg/dL',true,true],
    [280,96,160,'mg/dL',true,true], [280,96,160,'mmol/L',true,true],
    [360,42,24,'mmol/L',false,true], [528,64,160,'mg/dL',false,false],
  ]) {
    await page.setViewportSize({width,height:1100});
    await page.evaluate(({size,arrow,unit,showUnit,showTrend})=>{
      const card=document.querySelector('glucifer-card');
      Object.assign(card.config,{glucose_size:size,arrow_size:arrow,show_glucose_unit:showUnit,show_trend:showTrend});
      window.fixture.states['sensor.phone_glucose']={state:unit==='mg/dL'?'135':'7.5',attributes:{unit_of_measurement:unit}};
      card.render();
    },{size,arrow,unit,showUnit,showTrend});
    const boxes=await root.evaluate(card=>{
      const root=card.shadowRoot,range=document.createRange();range.selectNodeContents(root.querySelector('.glucose'));
      const text=range.getBoundingClientRect(),frame=root.querySelector('ha-card').getBoundingClientRect(),arrow=root.querySelector('.trend').getBoundingClientRect();
      return {textCenter:text.x+text.width/2,cardCenter:frame.x+frame.width/2,textRight:text.right,arrowLeft:arrow.left,arrowRight:arrow.right,rowRight:root.querySelector('.reading').getBoundingClientRect().right};
    });
    assert.ok(Math.abs(boxes.textCenter-boxes.cardCenter)<1,`Value must be centered across the card at ${width}px`);
    if(showTrend) {
      assert.ok(boxes.textRight<=boxes.arrowLeft,'Centered text must not overlap the arrow');
      assert.ok(Math.abs(boxes.arrowRight-boxes.rowRight)<1,'Arrow stays against the right edge');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:800,height:900});
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_trend=true;card.render();});
  // Moving the arrow lower preserves its horizontal position and size.
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');Object.assign(card.config,{arrow_size:84,glucose_size:64,show_glucose_unit:false});card.render();});
  const topArrow=await root.locator('.trend').boundingBox();
  for (const width of [800,528,280]) {
    await page.setViewportSize({width,height:1100});
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.arrow_position='glucose';card.render();});
    const original=await root.locator('.trend').boundingBox();
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.arrow_position='details';card.render();});
    const lower=await root.locator('.trend').boundingBox(),reading=await root.locator('.reading').boundingBox();
    assert.ok(Math.abs(lower.x-original.x)<1,'Lower arrow retains the same horizontal position');
    assert.equal(lower.width,original.width);
    assert.ok(lower.y>=reading.y+reading.height,'Lower arrow is below the glucose row');
    const boxes=await root.evaluate(card=>{
      const range=document.createRange();range.selectNodeContents(card.shadowRoot.querySelector('.glucose'));
      const value=range.getBoundingClientRect(),frame=card.shadowRoot.querySelector('ha-card').getBoundingClientRect();
      return {value:value.x+value.width/2,frame:frame.x+frame.width/2};
    });
    assert.ok(Math.abs(boxes.value-boxes.frame)<1);
    assert.equal(await root.locator('.details-row .trend').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:800,height:900});
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.arrow_position='glucose';card.render();});
  assert.equal(await root.locator('.reading .trend').count(),1);
  assert.equal((await root.locator('.trend').boundingBox()).x,topArrow.x);
  const shapes=[];
  for(const [trend,angle] of [['Flat',0],['FortyFiveUp',-45],['SingleUp',-90],['FortyFiveDown',45],['SingleDown',90]]) {
    await page.evaluate(trend=>{window.fixture.states['sensor.phone_trend'].state=trend;document.querySelector('glucifer-card').hass=window.fixture;},trend);
    shapes.push(await root.locator('.trend path').getAttribute('d'));
    assert.equal(await root.locator('.trend path').getAttribute('transform'),`rotate(${angle} 50 50)`);
    const a=await root.locator('.trend svg').boundingBox(),g=await root.locator('.glucose').boundingBox();
    assert.ok(Math.abs(a.y+a.height/2-g.y-g.height/2)<1,'Arrow and glucose boxes share a vertical center');
  }
  assert.equal(new Set(shapes).size,1);
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');card.config.show_iob_u=true;
    Object.assign(card.data.entities,{eiob_u:'sensor.eiob'});
    window.fixture.states['sensor.eiob']={state:'0.0',attributes:{unit_of_measurement:'U'}};
    card.config.show_eiob_u=true;card.render();
  });
  assert.match(await root.locator('.optional-values').textContent(),/Insulin on board: .* \(Active: 0.0 U\)/);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_eiob_u=false;card.render();});
  assert.doesNotMatch(await root.locator('.optional-values').textContent(),/Active:/);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_eiob_u=true;window.fixture.states['sensor.eiob'].state='unavailable';card.render();});
  assert.doesNotMatch(await root.locator('.optional-values').textContent(),/Active:/);
  // Font size is honored on a normal card, with independently styled local text.
  await page.setViewportSize({width:528,height:1000});
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    window.fixture.states['sensor.phone_glucose']={state:'135',attributes:{unit_of_measurement:'mg/dL'}};
    window.fixture.states['sensor.phone_trend'].state='Flat';
    card.setConfig({...card.config,glucose_size:96,glucose_alignment:'center',show_glucose_unit:false,arrow_position:'details',glucose_style:'italic',glucose_weight:700,glucose_font:'Georgia'});
  });
  const font=await root.locator('.glucose').evaluate(el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontStyle,s.fontWeight,s.fontFamily];});
  assert.deepEqual(font,['96px','italic','700','Georgia']);
  // Locale affects all rendered numbers and dates, without changing units/time zone.
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card');
    window.fixture.states['sensor.phone_glucose']={state:'7.5',attributes:{unit_of_measurement:'mmol/L'}};
    window.fixture.states['sensor.phone_delta'].state='1.2';
    card.setConfig({...card.config,locale:'de-DE',show_glucose_unit:true,show_delta_mgdl:true});
  });
  assert.equal(await root.locator('.glucose').textContent(),'7,5 mmol/L');
  assert.match(await root.locator('.delta').textContent(),/1,2/);
  assert.match(await root.locator('.optional-values').textContent(),/Aktives Insulin: 1,2 E/);
  assert.match(await page.evaluate(()=>document.querySelector('glucifer-card').formatDateTime('2026-09-06T12:00:00Z')),/6\.9\.2026, 12:00/);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,locale:'en-US'});});
  assert.equal(await root.locator('.glucose').textContent(),'7.5 mmol/L');
  assert.match(await page.evaluate(()=>document.querySelector('glucifer-card').formatDateTime('2026-09-06T12:00:00Z')),/9\/6\/2026, 12:00 PM/);
  await page.evaluate(()=>{const card=document.querySelector('glucifer-card');window.fixture.locale.number_format='decimal_comma';card.setConfig({...card.config,locale:''});});
  assert.equal(await root.locator('.glucose').textContent(),'7,5 mmol/L');
  assert.equal(await page.evaluate(()=>{try{customElements.get('glucifer-card').getConfigForm().assertConfig({locale:'not_a_locale'});return false;}catch{return true;}}),true);
  // Independent length and stroke width keep consistent arrow geometry in every direction.
  await page.setViewportSize({width:800,height:1000});
  for(const trend of ['Flat','FortyFiveUp','SingleUp','DoubleDown']) {
    await page.evaluate(trend=>{const card=document.querySelector('glucifer-card');window.fixture.states['sensor.phone_trend'].state=trend;card.setConfig({...card.config,arrow_size:84,arrow_length:140,arrow_width:8});},trend);
    const before=await root.locator('.trend').boundingBox();
    assert.ok(Math.max(before.width,before.height)>110);
    const thickness=await root.locator('.trend path').evaluate(el=>parseFloat(getComputedStyle(el).strokeWidth)*el.getScreenCTM().a);
    if(trend==='Flat') assert.ok(Math.abs(thickness-8)<.01);
    for(const width of [528,280]) {
      await page.setViewportSize({width,height:1100});
      await page.evaluate(()=>document.querySelector('glucifer-card').render());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const bounds=await root.locator('.trend').boundingBox(); assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
    }
    await page.setViewportSize({width:800,height:1000});
  }
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
  await require('./preview-check.cjs').checkPreviewReplacement(page);
  assert.deepEqual(errors,[]);
  await browser.close();console.log('Dashboard browser checks passed: values, units, history gaps, stale/unavailable states, safe text rendering, more-info interaction, native editor schema, independent colors, journal markers/details/filters, live edits/deletes, mobile layout, subscription cleanup and entity-switch race.');
})();
