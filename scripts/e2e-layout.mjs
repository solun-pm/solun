// Run against a built web server: WEB_URL=http://127.0.0.1:4280 pnpm test:layout
// Uses the Chromium/playwright-core already used by e2e-local.sh. API writes are mocked.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const versions = (await readdir(root + 'node_modules/.pnpm')).filter(n => n.startsWith('playwright-core@')).sort();
const pw = process.env.PW_CORE ?? root + 'node_modules/.pnpm/' + versions.at(-1) + '/node_modules/playwright-core';
const { chromium } = await import(pw + '/index.mjs');
const base = process.env.WEB_URL ?? 'http://127.0.0.1:4280';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
let checks = 0;
const check = (name, value) => { assert.ok(value, name); checks++; console.log('PASS ' + name); };
async function setup(width, javaScriptEnabled = true) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, javaScriptEnabled });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://rybbit.scpx.de/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  return page;
}
async function layout(page, name) {
  check(name + ': no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
async function footer(page, name) {
  check(name + ': footer follows active form', await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    const footer = document.querySelector('footer');
    const card = footer.parentElement;
    return footer.getBoundingClientRect().top >= panel.getBoundingClientRect().bottom + 16 && card.getBoundingClientRect().bottom >= footer.getBoundingClientRect().bottom;
  }));
  for (const link of await page.locator('footer a').all()) {
    await link.scrollIntoViewIfNeeded();
    check(name + ': link hit target ' + await link.getAttribute('href'), await link.evaluate(e => {
      const r = e.getBoundingClientRect();
      return r.height >= 44 && e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }));
  }
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const nojs = await setup(width, false);
    await nojs.goto(base + '/');
    await footer(nojs, width + ' before JavaScript');
    await nojs.getByRole('link', { name: 'Learn', exact: true }).click();
    check(width + ': footer navigation without JavaScript', new URL(nojs.url()).pathname === '/learn');
    await nojs.close();
    const page = await setup(width);
    await page.route('https://v6.solun.pm/api/ip', r => r.fulfill({ json: { ip: '2001:0db8:1234:5678:9abc:def0:1234:5678', version: 6, city: 'Frankfurt am Main', region: 'Hesse', country: 'DE', timezone: 'Europe/Berlin', coordinates: '50.1109, 8.6821' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.route('**/api/paste', r => r.fulfill({ json: { id: 'layoutcheck', expiresAt: null }, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await page.goto(base + '/');
    for (const mode of ['Message', 'File', 'Message']) {
      await page.getByRole('tab', { name: new RegExp(mode) }).click();
      await footer(page, width + ' ' + mode);
      await layout(page, width + ' ' + mode);
      check(width + ' ' + mode + ': only active panel accessible', await page.getByRole('tabpanel').count() === 1);
    }
    await page.locator('textarea').fill('layout test');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('Your link', { exact: true }).waitFor();
    await footer(page, width + ' generated link');
    for (const [name, path] of [['Learn', '/learn'], ['Roadmap', '/roadmap'], ['IP', '/ip']]) {
      await page.goto(base + '/');
      await page.getByRole('tab', { name: /File/ }).click();
      await page.getByRole('link', { name, exact: true }).click();
      await page.waitForURL(base + path);
      check(width + ': real footer click ' + path, new URL(page.url()).pathname === path);
    }
    await page.getByText('2001:0db8:1234:5678:9abc:def0:1234:5678', { exact: true }).waitFor();
    await layout(page, width + ' full IPv6 address');
    await page.goto(base + '/learn');
    const guides = await page.locator('a[href^="/learn/"]').evaluateAll(es => [...new Set(es.map(e => e.getAttribute('href')))]);
    for (const path of [...guides, '/roadmap', '/p/layoutmissing', '/s/layoutmissing', '/f/layoutmissing', '/layoutmissing']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await layout(page, width + ' ' + path);
    }
    await page.close();
  }
  const page = await setup(390);
  await page.route('https://v6.solun.pm/api/ip', r => r.fulfill({ json: { ip: '192.0.2.1', version: 4 }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(base + '/ip');
  await page.getByText('Not available on this connection.').waitFor();
  check('IPv4 response cannot be labelled IPv6', await page.getByText('192.0.2.1', { exact: true }).count() === 0);
  await page.unroute('https://v6.solun.pm/api/ip');
  await page.route('https://v6.solun.pm/api/ip', async r => { await new Promise(resolve => setTimeout(resolve, 8000)); await r.abort().catch(() => {}); });
  const started = Date.now();
  await page.goto(base + '/ip');
  await page.getByText('Not available on this connection.').waitFor({ timeout: 7500 });
  check('Unreachable IPv6 probe stops loading within seven seconds', Date.now() - started < 7500);
  await page.close();
  check('No JavaScript errors', errors.length === 0);
  console.log(`ALL ${checks} LAYOUT/IP CHECKS PASSED`);
} finally {
  await browser.close();
}
