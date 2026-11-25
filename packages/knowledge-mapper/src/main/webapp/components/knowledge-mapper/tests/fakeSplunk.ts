/*
 * A stand-in for Splunk behind @splunk/search-job, for unit tests.
 *
 * It answers the two searches the app sends, from an in-memory world, the way
 * the app's macros answer them on a real Splunk: `get_unique_entities` lists
 * every entity, `get_relationships_for_nodes` returns every relationship whose
 * source or target is in the filter. Like Splunk's results endpoint it returns
 * 100 rows unless the request asks for another `count` (0 means all).
 *
 * Every search created is recorded in `searches`, so a test can spy on the
 * search-job layer the app calls rather than on the app's own functions.
 */

export interface Entity {
    id: string;
    label: string;
    type: string;
}

export interface Rel {
    id: string;
    source: string;
    target: string;
    label: string;
    isAnomaly?: string;
}

export interface RecordedSearch {
    search: string;
    resultParams: Record<string, any> | undefined;
}

const SPLUNK_DEFAULT_COUNT = 100;

let world: { entities: Entity[]; relationships: Rel[] } = { entities: [], relationships: [] };
export const searches: RecordedSearch[] = [];

export function setWorld(entities: Entity[], relationships: Rel[]): void {
    world = { entities, relationships };
    searches.length = 0;
}

const UNIQUE_ENTITIES = /^\|\s*`get_unique_entities`\s*$/;
const RELATIONSHIPS = /^\|\s*`get_relationships_for_nodes\(node_filter="([\s\S]*)"\)`\s*$/;

function quotedList(text: string): string[] {
    return text.split(',').map((item) => {
        const m = item.trim().match(/^"(.*)"$/);
        if (!m) throw new Error(`fake Splunk: cannot read list item ${item}`);
        return m[1];
    });
}

// Reads the node filter the way the macro's `where` does, after Splunk
// unescapes the quoted macro argument: `in(source,...) OR in(target,...)`.
// Anything else is refused loudly, so a change to the filter's shape cannot
// pass by accident.
export function filterLists(search: string): { source: string[]; target: string[] } | null {
    const m = search.match(RELATIONSHIPS);
    if (!m) return null;
    if (/(^|[^\\])"/.test(m[1])) throw new Error(`fake Splunk: unescaped quote in macro argument ${m[1]}`);
    const arg = m[1].replace(/\\"/g, '"');
    const f = arg.match(/^in\(source,([^)]*)\) OR in\(target,([^)]*)\)$/);
    if (!f) throw new Error(`fake Splunk: unexpected node filter ${arg}`);
    return { source: quotedList(f[1]), target: quotedList(f[2]) };
}

function answer(search: string): Record<string, string>[] {
    if (UNIQUE_ENTITIES.test(search)) {
        return world.entities.map((e) => ({ entityId: e.id, name: e.label, entityType: e.type }));
    }
    const lists = filterLists(search);
    if (lists) {
        const sources = new Set(lists.source);
        const targets = new Set(lists.target);
        return world.relationships
            .filter((r) => sources.has(r.source) || targets.has(r.target))
            .map((r) => ({
                id: r.id,
                source: r.source,
                target: r.target,
                label: r.label,
                isAnomaly: String(r.isAnomaly || '').trim().toLowerCase() === 'true' ? 'true' : 'false',
            }));
    }
    throw new Error(`fake Splunk: unexpected search ${search}`);
}

function create(params: { search: string }) {
    const recorded: RecordedSearch = { search: params.search, resultParams: undefined };
    searches.push(recorded);
    return {
        getResults(resultParams: Record<string, any> = {}) {
            recorded.resultParams = resultParams;
            const rows = answer(params.search);
            const count = resultParams.count === undefined ? SPLUNK_DEFAULT_COUNT : Number(resultParams.count);
            const page = count === 0 ? rows : rows.slice(0, count);
            return {
                subscribe(observer: { next: (d: any) => void; complete: () => void }) {
                    // Asynchronous, as the real Observable is.
                    Promise.resolve().then(() => {
                        observer.next({ results: page });
                        observer.complete();
                    });
                    return { unsubscribe() {} };
                },
            };
        },
    };
}

export const searchJobModule = { __esModule: true, default: { create } };

// Small seeded generator, so random graphs are the same on every run.
export function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// A random graph that includes self-links, parallel and reversed
// relationships and (often) more than one component.
export function randomWorld(seed: number): { entities: Entity[]; relationships: Rel[] } {
    const rnd = prng(seed);
    const n = 2 + Math.floor(rnd() * 30);
    const entities: Entity[] = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, label: `Node ${i}`, type: 'host' }));
    const m = Math.floor(rnd() * n * 1.6);
    const labels = ['logged_onto', 'connected_to', 'owns'];
    const relationships: Rel[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < m; i++) {
        const s = Math.floor(rnd() * n);
        const t = rnd() < 0.08 ? s : Math.floor(rnd() * n);
        const label = labels[Math.floor(rnd() * labels.length)];
        const key = `${s}|${t}|${label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({ id: `r${i}`, source: `n${s}`, target: `n${t}`, label, isAnomaly: rnd() < 0.2 ? 'true' : '' });
    }
    return { entities, relationships };
}

// Distances from one entity, relationships taken in either direction. Plain
// breadth-first search over the world, written separately from the app's code.
export function distancesFrom(rels: Rel[], start: string): Map<string, number> {
    const dist = new Map<string, number>([[start, 0]]);
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift() as string;
        for (const r of rels) {
            for (const [a, b] of [[r.source, r.target], [r.target, r.source]]) {
                if (a === cur && !dist.has(b)) {
                    dist.set(b, (dist.get(cur) as number) + 1);
                    queue.push(b);
                }
            }
        }
    }
    return dist;
}
