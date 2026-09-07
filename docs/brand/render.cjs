// SPDX-License-Identifier: GPL-3.0-or-later
// npm ci && npx playwright install chromium && node docs/brand/render.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const directory = __dirname;
const brand = path.resolve(directory, '../../custom_components/glucifer/brand');
const body = svg => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')).replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, '');
(async () => {
  const master = await fs.readFile(path.join(directory, 'glucifer.svg'), 'utf8');
  const mark = body(master);
  const [, , frameWidth, frameHeight] = master.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const app = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254"><title>Glucifer app icon</title><rect x="8" y="8" width="1238" height="1238" rx="232" fill="#101a2a"/>${mark}</svg>\n`;
  const homeAssistant = body(await fs.readFile(path.join(directory, 'home-assistant.svg'), 'utf8'));
  const font = (await fs.readFile(path.join(directory, 'Outfit.ttf'))).toString('base64');
  const banner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2172 724"><title>Glucifer HA</title><style>@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${font})}text{font-family:Outfit,sans-serif;font-weight:600}</style><rect width="2172" height="724" fill="#101a2a"/><g transform="translate(-25 -28) scale(.61)">${mark}</g><g transform="translate(738 238) scale(.96)">${homeAssistant}</g><text x="1038" y="432" fill="#f2f4f9" font-size="178">Glucifer HA</text></svg>\n`;
  await fs.writeFile(path.join(brand, 'mark.svg'), master);
  await fs.writeFile(path.join(directory, 'icon.svg'), app);
  await fs.writeFile(path.join(directory, 'banner.svg'), banner);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({deviceScaleFactor:1});
    for (const [svg, width, height, target] of [
      [app,1254,1254,path.join(directory,'icon.png')],
      [app,256,256,path.join(brand,'icon.png')],
      [app,512,512,path.join(brand,'icon@2x.png')],
      [master,512,Math.round(512*frameHeight/frameWidth),path.join(directory,'mark.png')],
      [banner,2172,724,path.join(directory,'banner.png')],
    ]) {
      await page.setViewportSize({width,height});
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({path:target,omitBackground:true});
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
