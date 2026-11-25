/*
 * The explorer with 5,000 entities seeded (see seed.js): the page loads in a
 * reasonable time, the entity search finds an entity near the end of the
 * lookup, and a hub with more relationships than one page of Splunk results
 * is drawn whole.
 *
 * Data: a chain ent-00000 -> ent-00001 -> ... -> ent-04999, plus a hub
 * (ent-02500) related to every 30th entity. Expected graphs come from this
 * file's own breadth-first walk over the rows it generated.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { APP, seedingAvailable, seed, restore, toCsv, login } = require('./seed');

const N = 5000;
const LOAD_BOUND_MS = 60000;
const id = (i) => `ent-${String(i).padStart(5, '0')}`;
const TYPES = ['user', 'host', 'ip'];
const entities = Array.from({ length: N }, (_, i) => ({ id: id(i), label: `Entity ${String(i).padStart(4, '0')}`, type: TYPES[i % 3], details: '' }));
const HUB = 2500;
const relationships = [];
for (let i = 0; i + 1 < N; i++) relationships.push({ id: `c${i}`, source: id(i), target: id(i + 1), label: 'connected_to', isAnomaly: '', details: '' });
for (let k = 30; k <= 4500; k += 30) relationships.push({ id: `h${k}`, source: id(HUB), target: id(k), label: 'owns', isAnomaly: '', details: '' });

const labelOf = new Map(entities.map((e) => [e.id, e.label]));

// Entities and relationships the explorer should draw for a root at a depth:
// every relationship touching an entity within depth-1, and their ends.
function expectedGraph(root, degrees) {
    const dist = new Map([[root, 0]]);
    let frontier = [root];
    for (let d = 1; d < degrees; d++) {
        const next = [];
        for (const r of relationships) {
            for (const [a, b] of [[r.source, r.target], [r.target, r.source]]) {
                if (frontier.includes(a) && !dist.has(b)) { dist.set(b, d); next.push(b); }
            }
        }
        frontier = next;
    }
    const edges = relationships.filter((r) => dist.has(r.source) || dist.has(r.target));
    const nodes = new Set(edges.flatMap((r) => [r.source, r.target]));
    return { labels: [...nodes].map((n) => labelOf.get(n)).sort(), edges: edges.length };
}

test.beforeAll(() => {
    test.skip(!seedingAvailable(), 'APP_LOOKUPS_DIR not set: cannot seed lookups');
    seed({
        'entities.csv': toCsv(['id', 'label', 'type', 'details'], entities),
        'relationships.csv': toCsv(['id', 'source', 'target', 'label', 'isAnomaly', 'details'], relationships),
    });
});

test.afterAll(() => restore());

test.beforeEach(async ({ page }) => {
    fs.mkdirSync('e2e-results', { recursive: true });
    await login(page);
});

const nodeLabels = async (page) =>
    (await page.locator('.react-flow__nodes > .react-flow__node').allInnerTexts()).map((t) => t.trim()).sort();

async function waitForLabels(page, want, timeout = 150000) {
    await expect
        .poll(async () => (await nodeLabels(page)).join('|'), { timeout, intervals: [1000] })
        .toBe(want.join('|'));
}

test('the explorer loads with 5,000 entities, and the search finds a late one', async ({ page }) => {
    const first = expectedGraph(id(0), 3);
    const started = Date.now();
    await page.goto(`/en-US/app/${APP}/start`);
    await waitForLabels(page, first.labels, LOAD_BOUND_MS);
    const loadMs = Date.now() - started;
    console.log(`first graph drawn after ${loadMs} ms (${first.labels.length} entities)`);
    await page.screenshot({ path: 'e2e-results/scale-loaded.png' });

    // Type part of a late entity's name, as a person would, and pick it.
    const late = entities[4990];
    const input = page.getByPlaceholder('Search for an entity to begin...');
    await input.click();
    await input.pressSequentially(late.label, { delay: 60 });
    const option = page.getByRole('option', { name: `${late.label} (${late.id})` });
    await expect(option).toBeVisible({ timeout: 30000 });
    await option.click();

    const want = expectedGraph(late.id, 3);
    await waitForLabels(page, want.labels);
    await expect(page.locator('header').getByText(late.label, { exact: true }).first()).toBeVisible();
    await expect(page.locator('.react-flow__edges .react-flow__edge')).toHaveCount(want.edges);
    await page.screenshot({ path: 'e2e-results/scale-late-entity.png' });
});

test('a hub with more than 100 relationships is drawn whole', async ({ page }) => {
    const want = expectedGraph(id(HUB), 1);
    expect(want.labels.length).toBeGreaterThan(101);
    await page.goto(`/en-US/app/${APP}/start?entityId=${id(HUB)}&degrees=1`);
    await waitForLabels(page, want.labels);
    await expect(page.locator('.react-flow__edges .react-flow__edge')).toHaveCount(want.edges);
});
