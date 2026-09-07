const assert = require('node:assert/strict');
module.exports = async page => {
  await page.evaluate(() => {
    const card = document.querySelector('glucifer-card'), now = Date.now();
    window.beforePredictionReadings = JSON.stringify(card.data.readings);
    card.data.predictions = ['raw','auto','calibrated'].map((kind,i) => ({kind,points:[
      {time_ms:now,mgdl:180.16},{time_ms:now+3600000,mgdl:200+i*10}]}));
    card.render();
  });
  const curves = () => page.evaluate(() => document.querySelector('glucifer-card').chartElement.chart.getOption().series.filter(s=>s.id.startsWith('prediction_')));
  assert.equal((await curves()).length,0);
  await page.evaluate(() => {const c=document.querySelector('glucifer-card');c.setConfig({...c.config,show_predictions:true});});
  await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series.filter(s=>s.id.startsWith('prediction_')).length===3);
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.style.setProperty('--card-background-color','#eee');c.scheduleThemeUpdate();});
  await page.clock.runFor(200);
  assert.equal((await curves())[0].lineStyle.type,'dashed');
  assert.equal(await page.evaluate(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().xAxis[0].max), await page.evaluate(()=>document.querySelector("glucifer-card").data.predictions[0].points.at(-1).time_ms));
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.setConfig({...c.config,locale:'de-DE'});const old=c._hass;c.hass={...old,states:{...old.states,[c.config.entity]:{...old.states[c.config.entity],attributes:{...old.states[c.config.entity].attributes,unit_of_measurement:'mmol/L'}}}};});
  await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series.find(s=>s.id==='prediction_auto')?.name==='Prognose (Auto)');
  assert.equal((await curves())[0].data[0][1],10);
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.data.predictions[0].points[1].mgdl=216.192;c.render();});
  await page.waitForFunction(()=>document.querySelector('glucifer-card').chartElement.chart.getOption().series.find(s=>s.id==='prediction_raw')?.data[1][1]===216.192/18.016);
  assert.equal(await page.evaluate(()=>JSON.stringify(document.querySelector('glucifer-card').data.readings)===window.beforePredictionReadings),true);
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.setConfig({...c.config,show_predictions:false});});
  await page.waitForFunction(()=>!document.querySelector('glucifer-card').chartElement.chart.getOption().series.some(s=>s.id.startsWith('prediction_')));
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.setConfig({...c.config,show_predictions:true});c.data.predictions=[];c.render();});
  await page.waitForFunction(()=>!document.querySelector('glucifer-card').chartElement.chart.getOption().series.some(s=>s.id.startsWith('prediction_')));
  await page.evaluate(()=>{const c=document.querySelector('glucifer-card');c.data.predictions=[{kind:'auto',points:[{time_ms:Date.now()-600001,mgdl:100},{time_ms:Date.now()+3600000,mgdl:150}]}];c.render();});
  assert.equal((await curves()).length,0);
};
