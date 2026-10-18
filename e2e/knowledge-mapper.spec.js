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
let relationships; // [{ source, target, label }]
let anomalousEdgeKeys; // Set of "source|target|label" Splunk flags as anomalous

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
    relationships = await oneshot(api, '| inputlookup relationships_lookup | table source target label');
    // Anomalies are whatever Splunk's data says they are; the UI must mark those.
    const joined = await oneshot(api, '| `knowledge_graph_join` | where isAnomaly="true" | table source target label');
    anomalousEdgeKeys = new Set(joined.map((r) => `${r.source}|${r.target}|${r.label}`));
    await api.dispose();
    expect(entities.length, 'entities lookup is empty in Splunk').toBeGreaterThan(1);
    expect(relationships.length, 'relationships lookup is empty in Splunk').toBeGreaterThan(1);
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
