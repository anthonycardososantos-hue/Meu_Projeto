import { chromium, devices } from '/home/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const URL = process.env.URL || 'http://localhost:4173/';
const browser = await chromium.launch();
const errors = [];

async function run(deviceName, tag) {
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(tag + ' PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' CONSOLE: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/${tag}-start.png` });
  await page.getByText('START PURGE').click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/${tag}-fresh.png` });
  await page.evaluate(() => { const g = window.__game; g.setStick(1, 0, true); g.setFire(true); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__game.touchDash());
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__game.setStick(-0.6, 0, true); });
  await page.waitForTimeout(1500);
  const snap = await page.evaluate(() => { const g = window.__game; return { state: g.state, kills: g.kills, score: Math.round(g.score), hp: Math.round(g.p.hp) }; });
  await page.screenshot({ path: `/tmp/${tag}-play.png` });
  await ctx.close();
  return snap;
}

const land = await run('iPhone 13 landscape', 'ml');
const port = await run('iPhone 13', 'mp');
console.log(JSON.stringify({ land, port, errors }, null, 2));
await browser.close();
