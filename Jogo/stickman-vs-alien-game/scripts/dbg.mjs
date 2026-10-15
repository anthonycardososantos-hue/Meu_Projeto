import { chromium } from '/home/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.getByText('START PURGE').click({ force: true });
await page.waitForTimeout(600);
await page.evaluate(() => { const g = window.__game; g.setStick(1,0,true); g.setFire(true); });
await page.waitForTimeout(900);
await page.evaluate(() => window.__game.touchDash());
await page.waitForTimeout(1200);
const d = await page.evaluate(() => {
  const g = window.__game;
  return {
    px: Math.round(g.p.x), py: Math.round(g.p.y), vx: Math.round(g.p.vx),
    scarf: g.p.scarf.map(s => [Math.round(s.x), Math.round(s.y)]),
    beams: g.parts.pool.filter(p => p.active && p.kind === 'beam').map(p => [Math.round(p.x), Math.round(p.y), Math.round(p.x2), Math.round(p.y2), p.color]),
    bullets: g.bullets.filter(b => b.active).map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.len), b.color]),
  };
});
console.log(JSON.stringify(d));
await browser.close();
