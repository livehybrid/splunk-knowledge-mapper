/*
 * The app's macros and its anomaly highlighting, on lookups seeded for the
 * test (see seed.js).
 *
 * The fixture is awkward on purpose: commas, quotes and non-ASCII text in
 * labels, empty details, a self-link, a relationship to an entity that does
 * not exist, the same pair related both ways with the same label, two ids
 * that differ only in case, ids holding a double quote, a comma, a backslash,
 * a backtick and `$`, and isAnomaly written as true, TRUE, " True ", false,
 * yes and empty.
 *
 * Expected answers are computed here from the CSV text this file wrote, with
 * its own CSV parser. Nothing is taken from the app's code or from Splunk.
 */
const fs = require('fs');
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');
const { APP, seedingAvailable, seed, restore, parseCsv, api, oneshot, login } = require('./seed');

const ENTITIES_CSV = `id,label,type,details
alpha,"Alpha, the first",user,"{""department"":""Sales""}"
beta,"Beta ""quoted""",host,
gamma,Gämma Ünïcode,ip,{}
delta,Delta,host,"{""os"":""Linux""}"
epsilon,Epsilon (isolated),user,
HOSTA,Host A upper,host,
hosta,Host a lower,host,
"say ""hi""",Quote id,user,
"a,b",Comma id,host,
c:\\temp\\,Backslash id,host,
\`tick\` $tok$,Backtick and dollar id,ip,
`;

const RELATIONSHIPS_CSV = `id,source,target,label,isAnomaly,details
r1,alpha,beta,logged_onto,true,"{""method"":""RDP""}"
r2,alpha,gamma,logged_onto,,
r3,beta,gamma,connected_to,TRUE,
r4,gamma,delta,connected_to," True ",
r5,delta,delta,self_check,false,
r6,delta,ghost,connected_to,yes,
r7,beta,alpha,logged_onto,false,
r8,HOSTA,alpha,logged_onto,true,
r9,hosta,gamma,connected_to,,
r10,"say ""hi""","a,b",connected_to,,
r11,"a,b",c:\\temp\\,connected_to,true,
r12,\`tick\` $tok$,"say ""hi""",owns,,
`;

const entities = parseCsv(ENTITIES_CSV);
const relationships = parseCsv(RELATIONSHIPS_CSV);
const anomalous = (r) => r.isAnomaly.trim().toLowerCase() === 'true';

test.beforeAll(() => {
    test.skip(!seedingAvailable(), 'APP_LOOKUPS_DIR not set: cannot seed lookups');
    expect(entities).toHaveLength(11);
    expect(relationships).toHaveLength(12);
    expect(entities.map((e) => e.id).slice(7)).toEqual(['say "hi"', 'a,b', 'c:\\temp\\', '`tick` $tok$']);
    seed({ 'entities.csv': ENTITIES_CSV, 'relationships.csv': RELATIONSHIPS_CSV });
});

test.afterAll(() => restore());

const blank = (v) => (v === undefined || v === null ? '' : v);
const pick = (row, fields) => Object.fromEntries(fields.map((f) => [f, blank(row[f])]));
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

test('get_unique_entities lists every entity from the lookup, renamed', async () => {
    const ctx = await api();
    const got = await oneshot(ctx, '| `get_unique_entities`');
    await ctx.dispose();
    const fields = ['entityId', 'name', 'entityType', 'description'];
    const want = entities.map((e) => ({ entityId: e.id, name: e.label, entityType: e.type, description: e.details }));
    expect(got.map((r) => pick(r, fields))).toEqual(want);
});

// The filter the explorer and finder send, built here to the same contract:
// an eval expression naming ids by their MD5 (Node's, not the app's), its
// quotes escaped inside the quoted macro argument. That Splunk's md5() agrees
// with Node's for these ids is part of what the tests check.
const md5 = (id) => crypto.createHash('md5').update(id, 'utf8').digest('hex');
const nodeFilter = (ids) => {
    const list = ids.map((id) => `"${md5(id)}"`).join(',');
    return `in(md5(source),${list}) OR in(md5(target),${list})`.replace(/"/g, '\\"');
};

function expectedRelationships(ids) {
    const want = new Set(ids);
    const ent = new Map(entities.map((e) => [e.id, e]));
    return relationships
        .filter((r) => want.has(r.source) || want.has(r.target))
        .map((r) => {
            const s = ent.get(r.source) || {};
            const t = ent.get(r.target) || {};
            return {
                id: r.id,
                source: r.source,
                target: r.target,
                label: r.label,
                isAnomaly: anomalous(r) ? 'true' : 'false',
                details: r.details,
                source_name: blank(s.label),
                source_type: blank(s.type),
                source_description: blank(s.details),
                target_name: blank(t.label),
                target_type: blank(t.type),
                target_description: blank(t.details),
            };
        })
        .sort(byId);
}

const RELATIONSHIP_FIELDS = Object.keys(expectedRelationships(['alpha'])[0]);

const AWKWARD = ['say "hi"', 'a,b', 'c:\\temp\\', '`tick` $tok$'];
for (const ids of [['alpha'], ['delta'], ['hosta'], ['HOSTA'], ['gamma', 'epsilon'], ['nobody'],
    ...AWKWARD.map((id) => [id]), entities.map((e) => e.id)]) {
    test(`get_relationships_for_nodes for ${ids.join(',')} matches the lookups`, async () => {
        const ctx = await api();
        const got = await oneshot(ctx, `| \`get_relationships_for_nodes(node_filter="${nodeFilter(ids)}")\``);
        await ctx.dispose();
        expect(got.map((r) => pick(r, RELATIONSHIP_FIELDS)).sort(byId)).toEqual(expectedRelationships(ids));
    });
}

// How each drawn edge is painted, reached through React Flow's accessible
// name for it ("Edge from <source> to <target>") and the path element inside
// it. The app sets neither the name nor reads the DOM; it hands React Flow a
// style keyed by its own edge id.
async function edgeLooks(page) {
    return page.locator('.react-flow__edges .react-flow__edge').evaluateAll((els) => els.map((el) => {
        const line = getComputedStyle(el.querySelector('.react-flow__edge-path'));
        const [r, g, b] = (line.stroke.match(/\d+/g) || []).map(Number);
        return { name: el.getAttribute('aria-label'), red: r > 200 && g < 120 && b < 120 };
    }));
}

test('Highlight Anomalies paints exactly the relationships the lookup flags', async ({ page }) => {
    fs.mkdirSync('e2e-results', { recursive: true });
    // Two degrees from alpha: everything touching alpha, beta, gamma or HOSTA.
    const near = new Set(['alpha', 'beta', 'gamma', 'HOSTA']);
    const shown = relationships.filter((r) => near.has(r.source) || near.has(r.target));
    const name = (r) => `Edge from ${r.source} to ${r.target}`;
    const wantRed = shown.filter(anomalous).map(name).sort();
    expect(new Set(shown.map(name)).size, 'two drawn edges share a name').toBe(shown.length);
    expect(wantRed).toEqual(['Edge from HOSTA to alpha', 'Edge from alpha to beta', 'Edge from beta to gamma', 'Edge from gamma to delta']);

    await login(page);
    await page.goto(`/en-US/app/${APP}/start?entityId=alpha&degrees=2`);
    const edges = page.locator('.react-flow__edges .react-flow__edge');
    await expect.poll(async () => edges.count(), { timeout: 150000, intervals: [2000] }).toBe(shown.length);
    await page.waitForTimeout(1500);

    const before = await edgeLooks(page);
    expect(before.map((e) => e.name).sort()).toEqual(shown.map(name).sort());
    expect(before.filter((e) => e.red).map((e) => e.name)).toEqual([]);

    await page.getByText('Highlight Anomalies', { exact: true }).click();
    await expect.poll(async () => (await edgeLooks(page)).filter((e) => e.red).length, { timeout: 10000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const after = await edgeLooks(page);
    await page.screenshot({ path: 'e2e-results/seeded-anomalies.png' });
    console.log('edges after highlight:', JSON.stringify(after));
    expect(after.filter((e) => e.red).map((e) => e.name).sort()).toEqual(wantRed);
});

const edgeName = (r) => `Edge from ${r.source} to ${r.target}`;

for (const id of AWKWARD) {
    test(`exploring ${id} draws its relationships`, async ({ page }) => {
        const want = relationships.filter((r) => r.source === id || r.target === id).map(edgeName).sort();
        expect(want.length).toBeGreaterThan(0);
        await login(page);
        await page.goto(`/en-US/app/${APP}/start?entityId=${encodeURIComponent(id)}&degrees=1`);
        const edges = page.locator('.react-flow__edges .react-flow__edge');
        await expect.poll(async () => edges.count(), { timeout: 150000, intervals: [2000] }).toBe(want.length);
        const names = await edges.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
        expect(names.sort()).toEqual(want);
    });
}

test('exploring an entity with no relationships draws that entity on its own', async ({ page }) => {
    const lone = entities.find((e) => e.id === 'epsilon');
    expect(relationships.filter((r) => r.source === 'epsilon' || r.target === 'epsilon')).toEqual([]);
    await login(page);
    await page.goto(`/en-US/app/${APP}/start?entityId=epsilon&degrees=2`);
    const nodes = page.locator('.react-flow__nodes .react-flow__node');
    await expect.poll(async () => nodes.count(), { timeout: 150000, intervals: [2000] }).toBe(1);
    await expect(nodes.first()).toContainText(lone.label);
    await expect(page.locator('.react-flow__edges .react-flow__edge')).toHaveCount(0);
    await expect(page.getByText('No data to display', { exact: false })).toHaveCount(0);
});
