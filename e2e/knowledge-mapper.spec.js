/*
 * End-to-end check: the packaged app, installed on a real Splunk, draws the
 * knowledge map for an entity from the data in its lookups.
 *
 * The expected graph is worked out here, from the raw lookups read over REST
 * (`| inputlookup`), with this file's own breadth-first walk. It does not use
 * the app's macros, its search service or its graph code, so a defect in any
 * of those cannot move the expectation along with the result.
 *
 * The rendered graph is read through React Flow's DOM (the node and edge
 * elements inside the flow's node and edge layers). The app never queries
 * the DOM itself; it only hands data to React Flow.
 */
const fs = require('fs');
const { test, expect, request } = require('@playwright/test');

const MGMT_URL = process.env.SPLUNK_MGMT_URL || 'https://localhost:8089';
const USER = process.env.SPLUNK_USER || 'admin';
const PASS = process.env.SPLUNK_PASSWORD || 'Changeme1!';
const APP = 'knowledge-mapper';
const DEFAULT_DEGREES = 3; // the explorer's initial "degrees" setting
const ANOMALY_SUFFIX = ' (Anomaly!)';

let entities; // [{ id, label, type }] in lookup order
let relationships; // [{ id, source, target, label, isAnomaly }]
let anomalousEdgeKeys; // Set of "source|target|label" the shipped data marks as anomalous

// Two relationships from the shipped data with the same root and the same
// label, one anomalous and one not, so no rule keyed on the label alone can
// mark one without the other.
const KNOWN_ANOMALY = { id: 'e8', source: 'userX', target: 'hostB', label: 'logged_onto' };
const KNOWN_NORMAL = { id: 'e1', source: 'userX', target: 'hostZ', label: 'logged_onto' };

async function oneshot(api, spl) {
    const r = await api.post(`/servicesNS/${USER}/${APP}/search/jobs/export`, {
        form: { search: spl, output_mode: 'json', earliest_time: '-24h', latest_time: 'now' },
    });
    expect(r.ok(), `search failed (${r.status()}): ${spl}\n${(await r.text()).slice(0, 500)}`).toBeTruthy();
    return (await r.text())
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
        .filter((o) => o.result && !o.preview)
        .map((o) => o.result);
}

// The explorer's documented behaviour: start from one entity, and for each
// degree take every relationship touching the current frontier (either
// direction); the next frontier is every endpoint not yet explored. The graph
// is every relationship collected and every entity at either end of one.
function expectedGraph(rootId, degrees) {
    const explored = new Set();
    let frontier = new Set([rootId]);
    const edges = new Map();
    for (let d = 0; d < degrees && frontier.size; d++) {
        const touching = relationships.filter((r) => frontier.has(r.source) || frontier.has(r.target));
        frontier.forEach((n) => explored.add(n));
        const next = new Set();
        for (const r of touching) {
            edges.set(`${r.source}|${r.target}|${r.label}`, r);
            for (const n of [r.source, r.target]) if (!explored.has(n)) next.add(n);
        }
        frontier = next;
    }
    const nodeIds = new Set([...edges.values()].flatMap((e) => [e.source, e.target]));
    const byId = new Map(entities.map((e) => [e.id, e]));
    return {
        labels: [...nodeIds].filter((id) => byId.has(id)).map((id) => byId.get(id).label).sort(),
        edges: [...edges.values()],
    };
}

test.beforeAll(async () => {
    const api = await request.newContext({
        baseURL: MGMT_URL,
        ignoreHTTPSErrors: true,
        httpCredentials: { username: USER, password: PASS },
    });
    entities = await oneshot(api, '| inputlookup entities_lookup | table id label type');
    relationships = await oneshot(api, '| inputlookup relationships_lookup | table id source target label isAnomaly');
    await api.dispose();
    // Anomalies are what the data says: the relationships lookup's own
    // isAnomaly column, read raw, not through the app's macros.
    anomalousEdgeKeys = new Set(relationships
        .filter((r) => String(r.isAnomaly || '').toLowerCase() === 'true')
        .map((r) => `${r.source}|${r.target}|${r.label}`));
    expect(entities.length, 'entities lookup is empty in Splunk').toBeGreaterThan(1);
    expect(relationships.length, 'relationships lookup is empty in Splunk').toBeGreaterThan(1);
    expect(anomalousEdgeKeys.size, 'the shipped data marks no relationship as anomalous').toBeGreaterThan(0);
    const byId = (id) => relationships.find((r) => r.id === id);
    expect(byId(KNOWN_ANOMALY.id), 'known-anomalous relationship changed').toMatchObject({ ...KNOWN_ANOMALY, isAnomaly: 'true' });
    expect(byId(KNOWN_NORMAL.id), 'known-normal relationship changed').toMatchObject(KNOWN_NORMAL);
    expect(String(byId(KNOWN_NORMAL.id).isAnomaly || '').toLowerCase()).not.toBe('true');
});

async function login(page) {
    await page.goto('/en-US/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL(/\/(app|launcher|home)/, { timeout: 60000 });
}

// Read the drawn graph from React Flow's layers.
async function readGraph(page) {
    const nodes = page.locator('.react-flow__nodes > .react-flow__node');
    const edgeTexts = page.locator('.react-flow__edges .react-flow__edge .react-flow__edge-text');
    return {
        nodeLabels: (await nodes.allInnerTexts()).map((t) => t.trim()).sort(),
        nodeBoxes: await nodes.evaluateAll((els) =>
            els.map((el) => {
                const b = el.getBoundingClientRect();
                return { w: b.width, h: b.height };
            })
        ),
        edgeCount: await page.locator('.react-flow__edges .react-flow__edge').count(),
        edgeLabels: (await edgeTexts.allTextContents()).map((t) => t.trim()),
    };
}

async function waitForGraph(page, expectedNodes) {
    const nodes = page.locator('.react-flow__nodes > .react-flow__node');
    // The explorer fetches iteratively, one search per degree; wait until the
    // node count stops at the expected size or the time runs out.
    await expect
        .poll(async () => nodes.count(), { timeout: 150000, intervals: [2000] })
        .toBe(expectedNodes);
    await page.waitForTimeout(1500); // let edges and labels settle after layout
}

// Where the root entity is drawn relative to the graph's own box on screen.
// The root is found by its label text, the graph box is React Flow's outer
// element; the app reads neither, and no layout value from the app is used.
async function rootOffset(page, rootLabel) {
    return page.evaluate((label) => {
        const flow = document.querySelector('.react-flow');
        const nodes = [...document.querySelectorAll('.react-flow__nodes > .react-flow__node')];
        const node = nodes.find((n) => n.innerText.trim() === label);
        if (!flow || !node) return null;
        const f = flow.getBoundingClientRect();
        const b = node.getBoundingClientRect();
        const inside = nodes.every((n) => {
            const r = n.getBoundingClientRect();
            return r.left >= f.left - 1 && r.right <= f.right + 1 && r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
        });
        return {
            dx: b.left + b.width / 2 - (f.left + f.width / 2),
            dy: b.top + b.height / 2 - (f.top + f.height / 2),
            allInside: inside,
        };
    }, rootLabel);
}

const CENTRE_TOLERANCE_PX = 6;

async function expectRootCentred(page, rootLabel) {
    let last;
    // Wait for the viewport to settle on the root (fit after layout).
    await expect
        .poll(async () => {
            last = await rootOffset(page, rootLabel);
            return !!last && Math.abs(last.dx) <= CENTRE_TOLERANCE_PX && Math.abs(last.dy) <= CENTRE_TOLERANCE_PX;
        }, { timeout: 10000, message: `root "${rootLabel}" is not centred in the graph` })
        .toBe(true)
        .catch((e) => { console.log('root offset from graph centre:', JSON.stringify(last)); throw e; });
    expect(last.allInside, 'a node is drawn outside the graph area').toBe(true);
}

async function checkExplorer(page, rootId, url, shot, degrees = DEFAULT_DEGREES) {
    const want = expectedGraph(rootId, degrees);
    const root = entities.find((e) => e.id === rootId);
    console.log(`root ${rootId}, ${degrees} degree(s): expecting ${want.labels.length} nodes, ${want.edges.length} edges`);

    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    await page.goto(url);
    if (degrees !== DEFAULT_DEGREES) {
        await page.getByLabel('Degrees of Separation').fill(String(degrees));
    }
    try {
        await waitForGraph(page, want.labels.length);
    } finally {
        const got = await readGraph(page);
        console.log('drawn nodes:', JSON.stringify(got.nodeLabels));
        console.log('drawn edges:', JSON.stringify(got.edgeLabels));
        await page.screenshot({ path: `e2e-results/${shot}.png` });
    }
    const got = await readGraph(page);

    // Exactly the right entities, drawn with a real size.
    expect(got.nodeLabels).toEqual(want.labels);
    for (const b of got.nodeBoxes) expect(b.w * b.h, 'a node was drawn with no area').toBeGreaterThan(0);

    // Exactly the right relationships, each with its label.
    expect(got.edgeCount).toBe(want.edges.length);
    const plain = got.edgeLabels.map((t) => t.replace(ANOMALY_SUFFIX, '')).sort();
    expect(plain).toEqual(want.edges.map((e) => e.label).sort());

    // Every edge Splunk flags as anomalous is marked, and no other.
    const wantMarked = want.edges.filter((e) => anomalousEdgeKeys.has(`${e.source}|${e.target}|${e.label}`));
    const marked = got.edgeLabels.filter((t) => t.endsWith(ANOMALY_SUFFIX)).map((t) => t.replace(ANOMALY_SUFFIX, ''));
    expect(marked.sort()).toEqual(wantMarked.map((e) => e.label).sort());

    // The root entity is in the middle of the graph, and everything fits.
    await expectRootCentred(page, root.label);

    // The header names the root entity.
    await expect(page.getByText('Showing relationships')).toBeVisible();
    await expect(page.locator('header').getByText(root.label, { exact: true }).first()).toBeVisible();

    expect(consoleErrors, 'uncaught page errors').toEqual([]);
}

test.beforeEach(async ({ page }) => {
    fs.mkdirSync('e2e-results', { recursive: true });
    await login(page);
});

test('explorer opens on the first entity and draws its graph', async ({ page }) => {
    await checkExplorer(page, entities[0].id, `/en-US/app/${APP}/start`, 'explorer-default');
});

test('explorer draws one degree around an entity named in the URL', async ({ page }) => {
    // A different root, reached through the entityId parameter, at one degree
    // via the degrees control, so a graph that only happens to match the
    // default view cannot pass both tests.
    const defaultLabels = expectedGraph(entities[0].id, DEFAULT_DEGREES).labels.join();
    const other = entities.find((e) => e.id !== entities[0].id
        && relationships.some((r) => r.source === e.id || r.target === e.id)
        && expectedGraph(e.id, 1).labels.join() !== defaultLabels);
    expect(other, 'no second entity with a different one-degree graph in the lookups').toBeTruthy();
    await checkExplorer(page, other.id, `/en-US/app/${APP}/start?entityId=${encodeURIComponent(other.id)}`,
        'explorer-entity-1-degree', 1);
});

// How each drawn edge looks: React Flow's accessible name ("Edge from <source>
// to <target>"), its label text and the colour and width its line is painted.
async function readEdgeLooks(page) {
    return page.locator('.react-flow__edges .react-flow__edge').evaluateAll((els) => els.map((el) => {
        const line = getComputedStyle(el.querySelector('.react-flow__edge-path'));
        const [r, g, b] = (line.stroke.match(/\d+/g) || []).map(Number);
        return {
            name: el.getAttribute('aria-label'),
            text: (el.querySelector('.react-flow__edge-text') || {}).textContent || '',
            red: r > 200 && g < 120 && b < 120,
            width: parseFloat(line.strokeWidth),
        };
    }));
}

test('Highlight Anomalies marks the anomalous relationships and no others', async ({ page }) => {
    const rootId = KNOWN_ANOMALY.source;
    const want = expectedGraph(rootId, DEFAULT_DEGREES);
    const wantRed = want.edges
        .filter((e) => anomalousEdgeKeys.has(`${e.source}|${e.target}|${e.label}`))
        .map((e) => `Edge from ${e.source} to ${e.target}`).sort();
    expect(wantRed.length, 'no anomalous relationship near the root').toBeGreaterThan(0);
    expect(wantRed.length, 'every relationship near the root is anomalous').toBeLessThan(want.edges.length);

    await page.goto(`/en-US/app/${APP}/start?entityId=${encodeURIComponent(rootId)}`);
    await waitForGraph(page, want.labels.length);
    const name = (e) => `Edge from ${e.source} to ${e.target}`;

    // Off: nothing is painted red, so the highlight is the switch's doing.
    const before = await readEdgeLooks(page);
    expect(before.length).toBe(want.edges.length);
    expect(before.filter((e) => e.red).map((e) => e.name)).toEqual([]);

    await page.getByText('Highlight Anomalies', { exact: true }).click();
    await expect
        .poll(async () => (await readEdgeLooks(page)).filter((e) => e.red).length, { timeout: 10000 })
        .toBeGreaterThan(0);
    const after = await readEdgeLooks(page);
    await page.screenshot({ path: 'e2e-results/explorer-anomalies.png' });
    console.log('edges after highlight:', JSON.stringify(after));

    // Exactly the anomalous relationships are red, thicker and labelled.
    expect(after.filter((e) => e.red).map((e) => e.name).sort()).toEqual(wantRed);
    const anomaly = after.find((e) => e.name === name(KNOWN_ANOMALY));
    const normal = after.find((e) => e.name === name(KNOWN_NORMAL));
    expect(anomaly, 'known-anomalous relationship not drawn').toBeTruthy();
    expect(normal, 'known-normal relationship not drawn').toBeTruthy();
    expect(anomaly.red).toBe(true);
    expect(anomaly.text).toContain(ANOMALY_SUFFIX.trim());
    expect(anomaly.width).toBeGreaterThan(normal.width);
    expect(normal.red).toBe(false);
    expect(normal.text).not.toContain(ANOMALY_SUFFIX.trim());
});

test('clicking another entity keeps the explored root centred, exploring from it re-centres', async ({ page }) => {
    const root = entities[0];
    const want = expectedGraph(root.id, DEFAULT_DEGREES);
    await page.goto(`/en-US/app/${APP}/start`);
    await waitForGraph(page, want.labels.length);
    await expectRootCentred(page, root.label);

    // Pick a drawn entity that is not the root and click it: that only selects it.
    const other = entities.find((e) => e.id !== root.id && want.labels.includes(e.label));
    await page.locator('.react-flow__nodes > .react-flow__node').filter({ hasText: other.label }).first().click();
    await expect(page.getByText(`Entity: ${other.label}`)).toBeVisible();
    await page.waitForTimeout(1000);
    await expectRootCentred(page, root.label);

    // Exploring from it makes it the root, at one degree, in the middle.
    await page.getByRole('button', { name: 'Explore from this Node' }).click();
    await waitForGraph(page, expectedGraph(other.id, 1).labels.length);
    await expect(page.locator('header').getByText(other.label, { exact: true }).first()).toBeVisible();
    await expectRootCentred(page, other.label);
    await page.screenshot({ path: 'e2e-results/explorer-explore-from-node.png' });
});
