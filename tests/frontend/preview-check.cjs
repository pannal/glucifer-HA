const assert = require('node:assert/strict');
async function checkPreviewReplacement(page) {
  await page.evaluate(()=>{
    const now=Date.now();window.previewRequests=0;window.previewPending=false;window.previewResponses=[];
    window.cacheHistory={entities:{trend:'sensor.cache_trend'},readings:[{time_ms:now,mgdl:135}],journal:[],journal_enabled:true};
    window.cacheHass={user:{id:'cache-user'},locale:{language:'en-GB'},states:{'sensor.cache':{state:'135',attributes:{unit_of_measurement:'mg/dL'}},'sensor.other_cache':{state:'180',attributes:{unit_of_measurement:'mg/dL'}},'sensor.cache_trend':{state:'Flat',attributes:{}}},connection:{subscribeMessage:async()=>()=>{}},callWS:()=>{
      window.previewRequests++;
      return window.previewPending ? new Promise(resolve=>window.previewResponses.push(resolve)) : Promise.resolve(window.cacheHistory);
    }};
    window.createPreview=(hass=window.cacheHass,entity='sensor.cache')=>{
      const card=document.createElement('glucifer-card');card.className='replacement-preview';
      card.setConfig({entity,show_history:true});card.hass=hass;document.body.append(card);return card;
    };
    window.preview=window.createPreview();
  });
  await page.waitForFunction(()=>window.preview.data && !window.preview.loading);
  const reuse=await page.evaluate(()=>{
    const data=window.preview.data;
    for(let i=0;i<8;i++){
      window.preview.remove();window.preview=window.createPreview();
      if(window.preview.data!==data) return false;
    }
    return window.previewRequests===1;
  });
  assert.equal(reuse,true,'HA preview replacements reuse receiver history immediately without refetching');
  await page.evaluate(()=>{
    window.previewPending=true;window.preview.refresh(true);window.oldPreviewData=window.preview.data;
    window.preview.remove();window.preview=window.createPreview();
  });
  assert.equal(await page.evaluate(()=>window.preview.data===window.oldPreviewData),true);
  assert.equal(await page.evaluate(()=>window.previewRequests),2,'Replacement joins the pending request');
  await page.evaluate(()=>window.previewResponses.shift()({...window.cacheHistory,readings:[{time_ms:Date.now(),mgdl:142}]}));
  await page.waitForFunction(()=>window.preview.data?.readings[0]?.mgdl===142 && !window.preview.loading);
  // Neither another receiver, another user nor another connection may inherit history.
  for(const scope of ['entity','user','connection']) {
    const isolated=await page.evaluate(scope=>{
      const hass=scope==='user'?{...window.cacheHass,user:{id:'other-user'}}:scope==='connection'?{...window.cacheHass,connection:{subscribeMessage:async()=>()=>{}}}:window.cacheHass;
      const card=window.createPreview(hass,scope==='entity'?'sensor.other_cache':'sensor.cache');
      const empty=!card.data;card.remove();return empty;
    },scope);
    assert.equal(isolated,true,`Preview history is isolated by ${scope}`);
    await page.evaluate(()=>window.previewResponses.shift()({entities:{},readings:[],journal:[]}));
  }
  // A successful empty response is authoritative, even if the previous history had points.
  await page.evaluate(()=>{window.preview.refresh(true);window.previewResponses.shift()({entities:{},readings:[],journal:[]});});
  await page.waitForFunction(()=>window.preview.data?.readings.length===0 && !window.preview.loading);
  assert.equal(await page.evaluate(()=>{window.preview.remove();window.preview=window.createPreview();return window.preview.data.readings.length;}),0);
  // No connected cards remain while the short-lived cache ages out.
  await page.evaluate(()=>window.preview.remove());
  await page.clock.runFor(300001);
  assert.equal(await page.evaluate(()=>{window.preview=window.createPreview();const empty=!window.preview.data;window.preview.remove();return empty;}),true);
  await page.evaluate(()=>window.previewResponses.shift()({entities:{},readings:[],journal:[]}));
}
module.exports={checkPreviewReplacement};
