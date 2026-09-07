const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadNativeChart} = require('./ha-native.cjs');
(async()=>{
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:640,height:900},timezoneId:'UTC'});
    const errors=[]; page.on('pageerror',error=>errors.push(String(error)));
    await loadNativeChart(page);
    await page.clock.install({time:new Date('2026-09-06T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-09-06T12:00:00Z'));
    await page.evaluate(html=>{document.body.innerHTML=html;}, '<style>body{font-family:Arial;--primary-text-color:#222;--secondary-text-color:#555;--card-background-color:white;--divider-color:#ddd;--primary-color:#00868c;--info-color:#00868c;--graph-color-1:#00868c;--color-1:#00868c;--direction:ltr}</style>');
    await page.addScriptTag({path:path.join(__dirname,'../../custom_components/glucifer/frontend/glucifer-card.js')});
    await page.evaluate(()=>{
      const now=Date.now(); window.fetches=0;
      window.readings=Array.from({length:60},(_,i)=>({time_ms:now-(59-i)*60000,mgdl:100+i})).filter((_,i)=>i<10||i>25);
      window.journal=[{id:'j1',kind:'carbs',amount:25,label:'Carbohydrates',note:'<img src=x onerror=alert(1)>',time_ms:now-5*60000}];
      window.fixture={locale:{language:'en-GB',time_format:'24',date_format:'DMY',time_zone:'server'},config:{time_zone:'Europe/Berlin'},localize:key=>key,
        states:{'sensor.g':{state:'159',attributes:{unit_of_measurement:'mg/dL'}},'sensor.time':{state:new Date(now-42000).toISOString(),attributes:{}}},
        callWS:async()=>{window.fetches++;return {entities:{measurement_time:'sensor.time'},readings:window.readings,journal:window.journal,journal_enabled:true};}};
      const card=document.createElement('glucifer-card');document.body.append(card);card.setConfig({entity:'sensor.g',hours:1,show_journal:true});card.hass=window.fixture;
    });
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement?.chart?.getOption().series?.length===4);
    const root=page.locator('glucifer-card');
    assert.equal(await root.locator('.history-chart').isVisible(),false);
    assert.equal(await root.locator('ha-chart-base canvas').count(),1);
    const data=await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series);
    assert.equal(data[0].data.filter(point=>point[1]===null).length,1);
    assert.equal(data[2].data[0].journalId,'j1');
    assert.equal(data[2].symbolSize,0);
    assert.equal(await root.locator('.journal-legend').isVisible(),false);
    // Enable optional symbols and retain the real canvas marker interaction checks.
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.config.show_journal_symbols=true;card.historySignature=null;card.render();});
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].symbolSize===12);
    assert.equal(await root.locator('.journal-legend').isVisible(),true);
    // Click the actual ECharts canvas marker, not a synthetic chart-click event.
    const marker=await page.evaluate(()=>{
      const chart=document.querySelector('glucifer-card').chartElement;
      const point=chart.chart.convertToPixel({seriesIndex:2},chart.data[2].data[0].value);
      const rect=chart.shadowRoot.querySelector('canvas').getBoundingClientRect();
      return {x:rect.left+point[0],y:rect.top+point[1]};
    });
    await page.mouse.click(marker.x,marker.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),true);
    assert.match(await root.locator('.journal-entry.selected').textContent(),/25 g/);
    assert.equal(await root.locator('.selection-label').textContent(),'');
    assert.equal(await root.locator('img:not(.brand-logo)').count(),0);
    // The rendered chip itself opens details, just like its underlying marker.
    await root.locator('.journal-selection button').click();
    const chip=await page.evaluate(()=>{
      const chart=document.querySelector('glucifer-card').chartElement;
      const symbol=chart.chart.getModel().getSeriesByIndex(2).getData().getItemGraphicEl(0);
      let label=symbol.getTextContent();
      symbol.traverse?.(item=>{if(item.getTextContent?.())label=item.getTextContent();});
      const rect=label.getBoundingRect(),m=label.getComputedTransform()||[1,0,0,1,0,0];
      const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
      const canvas=chart.shadowRoot.querySelector('canvas').getBoundingClientRect();
      return {x:canvas.left+m[0]*x+m[2]*y+m[4],y:canvas.top+m[1]*x+m[3]*y+m[5],text:label.style.text};
    });
    assert.match(chip.text,/25 g/);
    await page.mouse.click(chip.x,chip.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),true);
    // A second click on the same chip closes it; clicking again reopens it.
    await page.mouse.click(chip.x,chip.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),false);
    await page.mouse.click(chip.x,chip.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),true);
    // Pointer inspection has a localized timestamp and units.
    await page.mouse.move(marker.x-20,marker.y+10);
    await page.clock.runFor(100);
    assert.match(await root.locator('ha-chart-base .chart').textContent(),/mg\/dL/);
    const visibleTooltips = () => page.evaluate(() => [...document.querySelector('glucifer-card').chartElement.shadowRoot.querySelectorAll('.chart > div')]
      .filter(el => getComputedStyle(el).position === 'absolute' && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0').length);
    assert.equal(await visibleTooltips(),1);
    for (const point of [marker,chip]) {
      await page.mouse.move(point.x,point.y);
      await page.clock.runFor(200);
      assert.equal(await visibleTooltips(),0, 'Journal hover must hide the glucose tooltip');
      await page.mouse.move(marker.x-20,marker.y+10);
      await page.clock.runFor(100);
      assert.equal(await visibleTooltips(),1, 'Glucose inspection resumes outside journal entries');
    }
    await page.evaluate(()=>{
      const card=document.querySelector('glucifer-card');window.savedChart=card.chartElement;window.savedClose=card.shadowRoot.querySelector('.journal-selection button');
      window.chartUpdates=0;const update=card.chartElement.chart.setOption.bind(card.chartElement.chart);card.chartElement.chart.setOption=(...args)=>{window.chartUpdates++;return update(...args);};
      card.chartElement.zoom(50,100);
    });
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().dataZoom[0].start===50);
    const zoom=await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().dataZoom[0].start);
    const calls=await page.evaluate(()=>window.fetches);
    const updates=await page.evaluate(()=>window.chartUpdates);
    await page.clock.runFor(1000);
    assert.match(await root.locator('.reading-age').textContent(),/Reading 43s old/);
    await page.evaluate(()=>{for(let i=0;i<100;i++){window.fixture.states['sensor.other']={state:String(i),attributes:{}};document.querySelector('glucifer-card').hass=window.fixture;}});
    assert.equal(await page.evaluate(()=>window.fetches),calls);
    assert.equal(await page.evaluate(()=>window.chartUpdates),updates);
    // Apply nested theme variables after the chart is already painted, without a HA state change.
    await page.evaluate(()=>{
      document.body.style.setProperty('--late-background','#1c1c1c');
      document.body.style.setProperty('--late-text','#e1e1e1');
      document.body.style.setProperty('--ha-card-background','var(--late-background)');
      document.body.style.setProperty('--primary-text-color','var(--late-text)');
    });
    await page.clock.runFor(32);
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].label.backgroundColor==='rgb(28, 28, 28)');
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].label.rich.value.color),'rgb(225, 225, 225)');
    assert.equal(await page.evaluate(()=>window.fetches),calls);
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().dataZoom[0].start),zoom);
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-selection button')===window.savedClose),true);
    await page.evaluate(()=>document.body.style.setProperty('--late-background','#eef2f6'));
    await page.clock.runFor(32);
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].label.backgroundColor==='rgb(238, 242, 246)');
    await page.evaluate(()=>{window.journal=window.journal.map(e=>({...e,amount:30}));document.querySelector('glucifer-card').refresh(true);});
    await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-entry.selected > .journal-entry-label').textContent.includes('30 g'));
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement===window.savedChart),true);
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().dataZoom[0].start),zoom);
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-selection button')===window.savedClose),true);
    await root.locator('.journal-selection button').click();
    await page.evaluate(()=>{window.journal=[];document.querySelector('glucifer-card').refresh(true);});
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.data[2].data.length===0);
    assert.equal(await root.locator('.journal-selection').isVisible(),false);
    // HA's own reset control restores the full window.
    await root.locator('ha-chart-base .zoom-reset').click();
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().dataZoom[0].start===0);
    await page.evaluate(()=>{
      const card=document.querySelector('glucifer-card');card.config.show_journal_symbols=false;
      window.journal=[{id:'j2',kind:'carbs',amount:20,note:'After lunch',time_ms:Date.now()-5*60000,label:'Carbohydrates'},
        {id:'j3',kind:'insulin',amount:2,time_ms:Date.now()-5*60000-30000,label:'Insulin'},
        {id:'j4',kind:'note',time_ms:Date.now()-5*60000+30000,label:'Note'}];card.refresh(true);
    });
    await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].data.length===1 && document.querySelector('glucifer-card').chartElement.chart.getOption().series[2].symbolSize===0);
    assert.equal(await root.locator('.journal-legend').isVisible(),false);
    const connectors=await page.evaluate(()=>{const chart=document.querySelector('glucifer-card').chartElement;return chart.data.slice(1).flatMap((s,i)=>s.data.map((d,j)=>{
      const symbol=chart.chart.getModel().getSeriesByIndex(i+1).getData().getItemGraphicEl(j);let host=symbol;symbol.traverse?.(child=>{if(child.getTextContent?.())host=child;});
      const label=host.getTextContent(),background=label._children.find(child=>child.type==='rect');
      const bounds=background.getBoundingRect().clone();bounds.applyTransform(background.getComputedTransform());
      const points=host.getTextGuideLine().shape.points,end=points.at(-1),pixel=chart.chart.convertToPixel({seriesIndex:i+1},d.value);
      return {hidden:label.ignore,gap:Math.min(Math.abs(end[0]-bounds.x),Math.abs(end[0]-bounds.x-bounds.width),Math.abs(end[1]-bounds.y),Math.abs(end[1]-bounds.y-bounds.height)),anchorGap:Math.hypot(points[0][0]-pixel[0],points[0][1]-pixel[1])};
    }));});
    assert.ok(connectors.filter(c=>!c.hidden).length>=2,'Exercise labels moved to avoid overlap');
    for(const connector of connectors.filter(c=>!c.hidden)) {assert.ok(connector.gap<1,'Moved pill connector reaches its painted edge');assert.ok(connector.anchorGap<1,'Connector starts at the glucose anchor');}
    const pill=await page.evaluate(()=>{
      const card=document.querySelector('glucifer-card'),chart=card.chartElement;
      const symbol=chart.chart.getModel().getSeriesByIndex(2).getData().getItemGraphicEl(0);
      let host=symbol;symbol.traverse?.(child=>{if(child.getTextContent?.())host=child;});
      const label=host.getTextContent(),background=label._children.find(child=>child.type==='rect');
      const bounds=background.getBoundingRect().clone();bounds.applyTransform(background.getComputedTransform());
      const line=host.getTextGuideLine(),end=line.shape.points.at(-1);
      const edgeDistance=Math.min(Math.abs(end[0]-bounds.x),Math.abs(end[0]-bounds.x-bounds.width),Math.abs(end[1]-bounds.y),Math.abs(end[1]-bounds.y-bounds.height));
      const canvas=chart.shadowRoot.querySelector('canvas').getBoundingClientRect();
      return {x:canvas.x+bounds.x+bounds.width/2,y:canvas.y+bounds.y+bounds.height/2,edgeDistance,opacity:line.style.opacity,width:line.style.lineWidth};
    });
    assert.ok(pill.edgeDistance<1,'Connector reaches the painted pill border');
    assert.equal(pill.opacity,0.8);assert.equal(pill.width,1.5);
    await page.mouse.click(pill.x,pill.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),true);
    assert.match(await root.locator('.journal-selection').textContent(),/After lunch/);
    assert.doesNotMatch(await root.locator('.journal-selection').textContent(),/20 g/);
    await page.mouse.click(pill.x,pill.y);
    assert.equal(await root.locator('.journal-selection').isVisible(),false);
    // Full-range chart space uses the normal cursor; zoom restores native pan affordance.
    const chartSpace=await page.evaluate(()=>{const c=document.querySelector('glucifer-card').chartElement;const r=c.shadowRoot.querySelector('canvas').getBoundingClientRect();return{x:r.x+120,y:r.y+35};});
    const chartCursor=()=>page.evaluate(()=>getComputedStyle(document.querySelector('glucifer-card').chartElement.chart.getZr().painter.getViewportRoot()).cursor);
    await page.mouse.move(chartSpace.x,chartSpace.y);assert.equal(await chartCursor(),'default');
    await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.zoom(30,80));
    await page.mouse.move(chartSpace.x+5,chartSpace.y);assert.equal(await chartCursor(),'grab');
    await root.locator('ha-chart-base .zoom-reset').click();
    await page.mouse.move(chartSpace.x,chartSpace.y);assert.equal(await chartCursor(),'default');
    // Chart pills expand their matching visible row. Hidden/collapsed/limited lists use the fallback.
    await page.mouse.move(pill.x,pill.y);assert.equal(await chartCursor(),'pointer');
    await page.mouse.click(pill.x,pill.y);
    assert.equal(await root.locator('.journal-entry[data-journal-id="j2"] > .journal-selection').isVisible(),true);
    assert.equal(await root.locator('.journal-entry[data-journal-id="j2"] > button').getAttribute('aria-expanded'),'true');
    await root.locator('.journal-entry[data-journal-id="j2"] > button').click();
    assert.equal(await root.locator('.journal-selection').isVisible(),false);
    await root.locator('.journal-entry[data-journal-id="j2"] > button').click();
    assert.equal(await root.locator('.journal-entry[data-journal-id="j2"] > .journal-selection').isVisible(),true);
    await root.locator('.journal-section summary').click();
    await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-selection').parentElement.tagName==='HA-CARD');
    assert.equal(await root.locator('ha-card > .journal-selection').isVisible(),true);
    await root.locator('.journal-section summary').click();
    await page.waitForFunction(()=>document.querySelector('glucifer-card').shadowRoot.querySelector('.journal-selection').parentElement.dataset.journalId==='j2');
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,journal_limit:1});});
    assert.equal(await root.locator('ha-card > .journal-selection').isVisible(),true);
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,journal_limit:25,show_journal:false});});
    assert.equal(await root.locator('ha-card > .journal-selection').isVisible(),true);
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,show_journal:true,locale:'de-DE',show_journal_symbols:true});});
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').journalLabel({kind:'note',label:'My personal Note'})), 'My personal Note');
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').journalLabel({kind:'insulin',label:'Fiasp'})), 'Fiasp');
    assert.equal(await root.locator('.journal-title').textContent(),'Tagebuch');
    assert.equal(await root.locator('.journal-summary-count').textContent(),'3 Einträge');
    assert.match(await root.locator('.reading-age').textContent(),/^Messwert /);
    assert.match(await root.locator('.journal-entry[data-journal-id="j3"] > .journal-entry-label').textContent(),/Insulin · 2 E/);
    assert.match(await root.locator('.journal-entry[data-journal-id="j4"] > .journal-entry-label').textContent(),/^Notiz ·/);
    assert.equal(await root.locator('.journal-selection button').textContent(),'Schließen');
    assert.equal(await root.locator('ha-card > button').textContent(),'Weitere Details');
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.data[1].label.formatter({data:{journalId:'j3'}})), '{icon| } {value|2 E}');
    assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.data[3].label.formatter({data:{journalId:'j4'}})), '{icon| } {value|Notiz}');
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.toggleJournal('j4');});
    assert.equal(await root.locator('.journal-selection').isVisible(),false);
    assert.equal(await root.locator('.journal-entry[data-journal-id="j4"].selected').count(),1);
    assert.equal(await root.locator('.journal-entry[data-journal-id="j4"] > button').count(),0);
    // No expansion when the note only repeats the visible label, including whitespace.
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.journalEntries.find(e=>e.id==='j4').note=' Note ';card.render();});
    assert.equal(await root.locator('.journal-entry[data-journal-id="j4"] > button').count(),0);
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,show_journal:false});});
    assert.equal(await root.locator('ha-card > .journal-selection').isVisible(),true);
    assert.match(await root.locator('.selection-label').textContent(),/^Notiz ·/);
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,show_journal:true});});
    await page.evaluate(()=>{const card=document.querySelector('glucifer-card');card.setConfig({...card.config,locale:''});card.selectedJournalId=null;card.renderSelection();});
    await require('./editor-check.cjs').checkNativeEditor(page);
    await require('./prediction-check.cjs')(page);
    assert.deepEqual(errors,[]);
    console.log('Native HA chart checks passed: real canvas chip toggle, journal hover isolation, delayed nested theme colors, tooltip, gaps, seconds-only updates, stable selection, edits/deletes, zoom preservation, native editor defaults, slider drag/keyboard input, font/locale controls and retained preview data.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
