/*
 * Seeding the app's lookups for a spec, on the CI Splunk.
 *
 * CI mounts the staged app into the container, so the runner can rewrite
 * entities.csv and relationships.csv in place (APP_LOOKUPS_DIR) and Splunk
 * reads the new files on the next search. The shipped files are kept once in
 * a backup and put back after each seeded spec, so the order the specs run
 * in does not matter.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect, request } = require('@playwright/test');

const MGMT_URL = process.env.SPLUNK_MGMT_URL || 'https://localhost:8089';
const USER = process.env.SPLUNK_USER || 'admin';
const PASS = process.env.SPLUNK_PASSWORD || 'Changeme1!';
const APP = 'knowledge-mapper';
const DIR = process.env.APP_LOOKUPS_DIR;
const FILES = ['entities.csv', 'relationships.csv'];
const BACKUP = path.join(os.tmpdir(), 'knowledge-mapper-lookups-shipped');

function seedingAvailable() {
    if (!DIR && process.env.CI) throw new Error('APP_LOOKUPS_DIR must be set in CI');
    return !!DIR;
}

function seed(files) {
    if (!fs.existsSync(BACKUP)) {
        fs.mkdirSync(BACKUP);
        for (const f of FILES) fs.copyFileSync(path.join(DIR, f), path.join(BACKUP, f));
    }
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(DIR, name), text);
}

function restore() {
    if (!DIR || !fs.existsSync(BACKUP)) return;
    // Write the contents back rather than copy the file: Splunk owns the
    // lookups, and a copy also tries to set their mode.
    for (const f of FILES) fs.writeFileSync(path.join(DIR, f), fs.readFileSync(path.join(BACKUP, f)));
    fs.rmSync(BACKUP, { recursive: true });
}

// RFC 4180 parsing, written here so the expected values never come from Splunk
// or from the app.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const [head, ...body] = rows;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

function toCsv(header, rows) {
    const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h] ?? '')).join(','))].join('\n') + '\n';
}

async function api() {
    return request.newContext({
        baseURL: MGMT_URL,
        ignoreHTTPSErrors: true,
        httpCredentials: { username: USER, password: PASS },
    });
}

// Run SPL in the app's context through the REST export endpoint.
async function oneshot(ctx, spl) {
    const r = await ctx.post(`/servicesNS/${USER}/${APP}/search/jobs/export`, {
        form: { search: spl, output_mode: 'json', earliest_time: '-24h', latest_time: 'now', count: '0' },
    });
    expect(r.ok(), `search failed (${r.status()}): ${spl}\n${(await r.text()).slice(0, 500)}`).toBeTruthy();
    const lines = (await r.text()).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const messages = lines.flatMap((o) => o.messages || []).filter((m) => /ERROR|FATAL/.test(m.type));
    expect(messages, `search reported errors: ${spl}`).toEqual([]);
    return lines.filter((o) => o.result && !o.preview).map((o) => o.result);
}

async function login(page) {
    await page.goto('/en-US/account/login');
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await page.press('input[name="password"]', 'Enter');
    await page.waitForURL(/\/(app|launcher|home)/, { timeout: 60000 });
}

module.exports = { APP, seedingAvailable, seed, restore, parseCsv, toCsv, api, oneshot, login };
