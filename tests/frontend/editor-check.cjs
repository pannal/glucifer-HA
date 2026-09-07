const assert = require('node:assert/strict');
const {loadNativeEditor} = require('./ha-native.cjs');
async function checkNativeEditor(page) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await loadNativeEditor(page);
  await page.evaluate(async () => {
    const card=document.querySelector('glucifer-card');
    window.previewData=card.data; window.previewCalls=window.fetches;
    window.previewChart=card.chartElement; window.previewEdits=[];
    card.chartElement.zoom(35,90); card.toggleJournal('j2');
    window.originalEditorConfig=Object.freeze({type:'custom:glucifer-card',entity:'sensor.g',hours:1,show_journal:true,show_glucose_unit:false,custom_setting:'preserve'});
    const editor=await customElements.get('glucifer-card').getConfigElement();
    const hass={...window.fixture, auth:{}, translationMetadata:{translations:{}}, states:Object.fromEntries(Object.entries(window.fixture.states).map(([id,state])=>[id,{...state,entity_id:id}])), entities:{},devices:{},areas:{},floors:{},labels:{},services:{},
      loadBackendTranslation:async()=>{},formatEntityName:entity=>entity.entity_id};
    const contexts={states:hass.states,hassInternationalization:hass,hassRegistries:hass,hassConfig:hass,hassFormatters:hass,hassApi:hass,hassConnection:hass};
    editor.addEventListener('context-request',event=>{
      if (!(event.context in contexts)) return;
      event.stopPropagation();event.callback(contexts[event.context],()=>{});
    });
    editor.hass=hass;
    editor.addEventListener('config-changed',event=>{window.previewEdits.push(event.detail.config);card.setConfig(event.detail.config);});
    editor.setConfig(window.originalEditorConfig);
    document.body.append(editor);
  });
  const editor=page.locator('glucifer-card-editor');
  await editor.getByRole('button',{name:'Display',exact:true}).click();
  await page.clock.runFor(500); // Finish the native expansion animation before pointer input.
  await page.waitForFunction(()=>document.querySelector('glucifer-card-editor').form.updateComplete);
  assert.equal(await editor.getByRole('radio',{name:'Beside glucose',exact:true}).getAttribute('aria-checked'),'true');
  assert.equal(await editor.getByRole('radio',{name:'Left',exact:true}).getAttribute('aria-checked'),'true');
  assert.equal(await editor.getByRole('radio',{name:'Normal',exact:true}).getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>window.previewEdits.length),0,'Opening an old card must not save defaults');
  const number = label => editor.locator('ha-selector-number').filter({hasText:label});
  const glucose=number('Glucose font size (px)');
  assert.equal(await glucose.getByRole('slider').count(),1);
  assert.equal(await glucose.getByRole('spinbutton').inputValue(),'42');
  await glucose.getByRole('spinbutton').fill('72');
  for (const key of ['ArrowUp','ArrowUp','ArrowDown']) await glucose.getByRole('spinbutton').press(key);
  assert.equal(await glucose.getByRole('spinbutton').inputValue(),'73');
  await page.waitForFunction(()=>document.querySelector('glucifer-card').config.glucose_size===73);
  // Exercise the slider with real keyboard and pointer input, and keep numeric entry in sync.
  await glucose.getByRole('slider').focus(); await glucose.getByRole('slider').press('ArrowRight');
  assert.equal(await glucose.getByRole('spinbutton').inputValue(),'74');
  await glucose.getByRole('slider').scrollIntoViewIfNeeded();
  const slider=await glucose.getByRole('slider').boundingBox();
  await page.mouse.move(slider.x+slider.width*.7,slider.y+slider.height/2);
  await page.mouse.down(); await page.clock.runFor(32);
  await page.mouse.move(slider.x+slider.width*.15,slider.y+slider.height/2,{steps:5});
  await page.clock.runFor(32); await page.mouse.up();
  await page.clock.runFor(100);
  await page.waitForFunction(()=>document.querySelector('glucifer-card').config.glucose_size!==74);
  assert.notEqual(await glucose.getByRole('spinbutton').inputValue(),'74');
  await editor.getByRole('radio',{name:'Lower, beside delta and IOB',exact:true}).click();
  await editor.getByRole('radio',{name:'Italic',exact:true}).click();
  await editor.getByRole('textbox',{name:'Glucose font family',exact:true}).fill('Georgia');
  await number('Arrow length (px)').getByRole('spinbutton').fill('140');
  await number('Arrow stroke width (px)').getByRole('spinbutton').fill('9');
  await editor.locator('ha-selector-select').filter({hasText:'Locale'}).click();
  await page.clock.runFor(500);
  await editor.getByText('Deutsch (Deutschland)',{exact:true}).click();
  await page.clock.runFor(500);
  await page.waitForFunction(()=>document.querySelector('glucifer-card').config.locale==='de-DE',null,{polling:50});
  const result=await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card'),editor=document.querySelector('glucifer-card-editor');
    return {saved:window.previewEdits.at(-1),calls:window.fetches,originalCalls:window.previewCalls,
      sameData:card.data===window.previewData,sameChart:card.chartElement===window.previewChart,
      selection:card.selectedJournalId,zoom:card.chartElement.chart.getOption().dataZoom[0].start,
      font:getComputedStyle(card.shadowRoot.querySelector('.glucose')).fontFamily,
      style:getComputedStyle(card.shadowRoot.querySelector('.glucose')).fontStyle};
  });
  assert.equal(result.sameData,true);assert.equal(result.sameChart,true);assert.equal(result.calls,result.originalCalls);
  assert.equal(result.zoom,35);assert.equal(result.selection,'j2');
  assert.equal(result.saved.arrow_position,'details');assert.equal(result.saved.arrow_length,140);assert.equal(result.saved.arrow_width,9);
  assert.equal(result.saved.locale,'de-DE');assert.equal(result.saved.custom_setting,'preserve');assert.equal(result.saved.show_glucose_unit,false);
  assert.equal(Object.hasOwn(result.saved,'glucose_alignment'),false,'Unedited defaults remain absent from saved YAML');
  assert.equal(result.font,'Georgia');assert.equal(result.style,'italic');
  await page.evaluate(()=>{const editor=document.querySelector('glucifer-card-editor');editor.setConfig(window.previewEdits.at(-1));});
  assert.equal(await editor.getByRole('radio',{name:'Darunter, neben Glukoseänderung und IOB',exact:true}).getAttribute('aria-checked'),'true');
  // A display edit while a push is loading retains old data until the response arrives.
  await page.evaluate(()=>{
    const card=document.querySelector('glucifer-card'),original=window.fixture.callWS;
    window.fixture.callWS=()=>new Promise(resolve=>{window.finishPreviewPush=async()=>{window.fixture.callWS=original;resolve(await original());};});
    card.refresh(true);
  });
  await number('Glukose-Schriftgröße (px)').getByRole('spinbutton').fill('80');
  assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').data===window.previewData),true);
  assert.equal(await page.locator('glucifer-card .native-chart').isVisible(),true);
  await page.evaluate(()=>window.finishPreviewPush());
  await page.waitForFunction(()=>!document.querySelector('glucifer-card').loading);
  assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').config.glucose_size),80);
  assert.equal(await page.evaluate(()=>window.fetches),result.originalCalls+1);
  await editor.locator('ha-selector-select').filter({hasText:'Sprache und Region'}).click();
  await page.clock.runFor(500);
  await editor.getByText('Home Assistant verwenden',{exact:true}).click();
  await page.clock.runFor(500);
  await page.waitForFunction(()=>document.querySelector('glucifer-card').config.locale==='',null,{polling:50});
  assert.equal(await page.evaluate(()=>Object.hasOwn(window.previewEdits.at(-1),'locale')),false);
  assert.match(await editor.locator('ha-selector-select').filter({hasText:'Locale'}).ariaSnapshot(),/Home Assistant/);
  await page.evaluate(()=>document.querySelector('glucifer-card-editor').remove());
}
module.exports={checkNativeEditor};
