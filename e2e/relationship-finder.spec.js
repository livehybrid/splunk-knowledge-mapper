/*
 * End-to-end check of the Relationship Finder page on a real Splunk.
 *
 * Expected paths come from this file's own breadth-first search over the raw
 * lookups read over REST (`| inputlookup`), never from the app's macros,
 * search service or path code. What the page found is read from what it
 * shows: the result row's text (entity labels joined by arrows) and its
 * degrees cell.
 */
const fs = require('fs');
const { test, expect, request } = require('@playwright/test');

const MGMT_URL = process.env.SPLUNK_MGMT_URL || 'https://localhost:8089';
const USER = process.env.SPLUNK_USER || 'admin';
const PASS = process.env.SPLUNK_PASSWORD || 'Changeme1!';
const APP = 'knowledge-mapper';

let entities; // [{ id, label }]
let relationships; // [{ source, target, label }]

async function oneshot(api, spl) {
    const r = await api.post(`/servicesNS/${USER}/${APP}/search/jobs/export`, {
        form: { search: spl, output_mode: 'json', earliest_time: '-24h', latest_time: 'now' },
    });
    expect(r.ok(), `search failed (${r.status()}): ${spl}`).toBeTruthy();
    return (await r.text())
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
        .filter((o) => o.result && !o.preview)
        .map((o) => o.result);
}

const label = (id) => entities.find((e) => e.id === id).label;
const linked = (a, b) => relationships.some((r) => (r.source === a && r.target === b) || (r.source === b && r.target === a));

// Hops between two entities, relationships taken in either direction.
function distance(from, to) {
    const seen = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
        const n = queue.shift();
        if (n === to) return seen.get(n);
        for (const r of relationships) {
            const m = r.source === n ? r.target : r.target === n ? r.source : null;
            if (m !== null && !seen.has(m)) {
                seen.set(m, seen.get(n) + 1);
                queue.push(m);
            }
        }
    }
    return Infinity;
}

test.beforeAll(async () => {
    const api = await request.newContext({
        baseURL: MGMT_URL,
        ignoreHTTPSErrors: true,
        httpCredentials: { username: USER, password: PASS },
    });
    entities = await oneshot(api, '| inputlookup entities_lookup | table id label');
    relationships = await oneshot(api, '| inputlookup relationships_lookup | table source target label');
    await api.dispose();
    expect(relationships.length).toBeGreaterThan(1);
});

test.beforeEach(async ({ page }) => {
    fs.mkdirSync('e2e-results', { recursive: true });
    await page.goto('/en-US/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL(/\/(app|launcher|home)/, { timeout: 60000 });
});

async function openFinder(page) {
    await page.goto(`/en-US/app/${APP}/finder`);
    await expect(page.getByRole('heading', { name: 'Relationship Finder' })).toBeVisible({ timeout: 60000 });
}

async function chooseEntity(page, which, id) {
    // The combo box straight after its visible label (the label is not tied
    // to the input, so reach it by position in the form).
    const input = page.locator(`label:has-text("${which} Entity") + *`).locator('input').first();
    await input.click();
    await input.fill(id);
    await page.getByRole('option', { name: `${label(id)} (${id})` }).click();
}

async function setMaxDegrees(page, n) {
    const shown = page.getByText(/Max Degrees of Separation \(\d+\)/);
    const handle = page.getByRole('slider').first();
    await handle.focus();
    for (let i = 0; i < 10; i++) await handle.press('ArrowLeft'); // down to the minimum, 1
    for (let i = 1; i < n; i++) await handle.press('ArrowRight');
    await expect(shown).toHaveText(`Max Degrees of Separation (${n})`);
}

// Run a search and return what the results card shows.
async function findPath(page, from, to, shot) {
    await chooseEntity(page, 'Start', from);
    await chooseEntity(page, 'End', to);
    await page.getByRole('button', { name: 'Find Paths' }).click();
    const summary = page.getByText(/Found \d+ path\(s\)/);
    await expect(summary).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('Searching for paths...')).toHaveCount(0, { timeout: 120000 });
    await page.screenshot({ path: `e2e-results/${shot}.png` });
    const rows = page.locator('table tbody tr').filter({ has: page.getByRole('button', { name: 'View' }) });
    const paths = [];
    for (const row of await rows.all()) {
        const cells = await row.locator('td').allInnerTexts();
        paths.push({ hops: cells[0].split('→').map((t) => t.trim()), degrees: Number(cells[1].trim()) });
    }
    return { summary: (await summary.innerText()).trim(), paths };
}

// The shown path must be a real chain from `from` to `to` of the shortest length.
function expectShortestPath(result, from, to) {
    const d = distance(from, to);
    console.log(`${from} -> ${to}: shortest is ${d} hop(s); shown ${JSON.stringify(result)}`);
    expect(result.paths.length, 'no path shown').toBeGreaterThan(0);
    const { hops, degrees } = result.paths[0];
    expect(degrees).toBe(d);
    expect(hops.length).toBe(d + 1);
    expect(hops[0]).toBe(label(from));
    expect(hops[hops.length - 1]).toBe(label(to));
    const byLabel = (l) => entities.find((e) => e.label === l).id;
    for (let i = 0; i + 1 < hops.length; i++) {
        expect(linked(byLabel(hops[i]), byLabel(hops[i + 1])), `${hops[i]} and ${hops[i + 1]} are not related`).toBe(true);
    }
}

test('finds the shortest path, in order, two and three hops apart', async ({ page }) => {
    await openFinder(page);
    // Two shortest routes exist (via hostZ or hostB); either is right.
    expect(distance('userY', 'ipC')).toBe(2);
    expectShortestPath(await findPath(page, 'userY', 'ipC', 'finder-2-hops'), 'userY', 'ipC');

    await openFinder(page);
    expect(distance('ipA', 'userZ_admin')).toBe(3);
    expectShortestPath(await findPath(page, 'ipA', 'userZ_admin', 'finder-3-hops'), 'ipA', 'userZ_admin');
});

test('reports no path between unconnected entities', async ({ page }) => {
    expect(distance('userX', 'user-Alice')).toBe(Infinity);
    await openFinder(page);
    const result = await findPath(page, 'userX', 'user-Alice', 'finder-unconnected');
    expect(result.paths).toEqual([]);
    expect(result.summary).toContain('Found 0 path(s)');
    await expect(page.getByText('No paths found.')).toBeVisible();
});

test('respects the maximum degrees of separation', async ({ page }) => {
    await openFinder(page);
    await setMaxDegrees(page, 2);
    const result = await findPath(page, 'ipA', 'userZ_admin', 'finder-too-far');
    expect(result.paths, 'found a path longer than the maximum').toEqual([]);
    expect(result.summary).toContain('within 2 hops');
});

test('View opens the explorer on the path with its relationships highlighted', async ({ page }) => {
    await openFinder(page);
    const result = await findPath(page, 'ipA', 'userZ_admin', 'finder-before-view');
    expectShortestPath(result, 'ipA', 'userZ_admin');
    const ids = result.paths[0].hops.map((l) => entities.find((e) => e.label === l).id);
    const wantBlue = ids.slice(1).map((id, i) => {
        const r = relationships.find((x) => (x.source === ids[i] && x.target === id) || (x.target === ids[i] && x.source === id));
        return `Edge from ${r.source} to ${r.target}`;
    }).sort();

    await page.getByRole('button', { name: 'View' }).first().click();
    await page.waitForURL(/\/start\?/);
    expect(new URL(page.url()).searchParams.get('entityId')).toBe('ipA');

    const edges = page.locator('.react-flow__edges .react-flow__edge');
    await expect.poll(async () => edges.count(), { timeout: 150000, intervals: [2000] }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    const looks = await edges.evaluateAll((els) => els.map((el) => {
        const [r, g, b] = (getComputedStyle(el.querySelector('.react-flow__edge-path')).stroke.match(/\d+/g) || []).map(Number);
        return { name: el.getAttribute('aria-label'), blue: b > 200 && r < 100 };
    }));
    await page.screenshot({ path: 'e2e-results/finder-view-in-explorer.png' });
    console.log('explorer edges:', JSON.stringify(looks));
    expect(looks.filter((e) => e.blue).map((e) => e.name).sort()).toEqual(wantBlue);
});

test('Back to Entity Explorer returns to the explorer', async ({ page }) => {
    await openFinder(page);
    await page.getByRole('button', { name: 'Back to Entity Explorer' }).click();
    await page.waitForURL(/\/app\/knowledge-mapper\/start/);
    await expect(page.getByLabel('Degrees of Separation')).toBeVisible({ timeout: 60000 });
});
