import { chromium } from '/home/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const URL = process.env.URL || 'http://localhost:4173/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/01-start.png' });

await page.getByText('START PURGE').click({ force: true });
await page.waitForTimeout(500);

// play: move right, jump, dash, fire at mouse position
await page.mouse.move(820, 420);
await page.keyboard.down('d');
await page.mouse.down();
await page.waitForTimeout(700);
await page.keyboard.press('Space');
await page.waitForTimeout(250);
await page.keyboard.down('Shift');
await page.waitForTimeout(80);
await page.keyboard.up('Shift');
await page.waitForTimeout(1200);
await page.keyboard.up('d');
await page.mouse.move(400, 380);
await page.waitForTimeout(1500);
await page.mouse.up();

const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        else res(Math.round((n / (performance.now() - t0)) * 1000));
      };
      requestAnimationFrame(tick);
    }),
);

const snap = await page.evaluate(() => {
  const g = window.__game;
  return {
    state: g.state,
    wave: g.wave,
    aliens: g.aliens.length,
    queue: g.queue.length,
    score: Math.round(g.score),
    kills: g.kills,
    shots: g.shots,
    hp: Math.round(g.p.hp),
    px: Math.round(g.p.x),
    py: Math.round(g.p.y),
    particles: g.parts.pool.filter((p) => p.active).length,
    ragdolls: g.ragdolls.length,
  };
});
await page.screenshot({ path: '/tmp/02-play.png' });

// pause + resume
await page.keyboard.press('p');
await page.waitForTimeout(350);
await page.screenshot({ path: '/tmp/03-pause.png' });
const paused = await page.evaluate(() => window.__game.state);
await page.keyboard.press('p');

// force death to check game over screen
await page.evaluate(() => {
  const g = window.__game;
  g.p.hp = 1;
  g.p.iFrames = 0;
  g.score = 4321;
});
await page.waitForTimeout(100);
await page.evaluate(() => {
  const g = window.__game;
  g.p.hp = 0;
});
await page.waitForTimeout(4200);
await page.screenshot({ path: '/tmp/04-over.png' });
const dead = await page.evaluate(() => window.__game.state);

console.log(JSON.stringify({ fps, snap, paused, dead, errors }, null, 2));
await browser.close();
