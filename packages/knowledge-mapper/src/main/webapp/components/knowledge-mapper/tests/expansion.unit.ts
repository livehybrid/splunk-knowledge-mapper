/*
 * The Entity Explorer's degree expansion (getGraphDataIteratively), watched at
 * the search-job layer it calls (@splunk/search-job, replaced by the fake in
 * fakeSplunk.ts). Expanding N degrees must search each entity within N-1
 * degrees exactly once, no other entity, and draw exactly the entities within
 * N degrees. The expectation comes from a plain breadth-first walk here.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { searches, setWorld, randomWorld, distancesFrom, filterLists, Rel, Entity } from './fakeSplunk';
import { getGraphDataIteratively, getRelationshipsForNodes, getUniqueEntities } from '../services/splunkService';

jest.mock('@splunk/search-job', () => require('./fakeSplunk').searchJobModule);
jest.mock('@splunk/splunk-utils/config', () => ({ app: 'knowledge-mapper', username: 'admin' }));

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

// Entity ids named in each relationships search, from the search text sent.
function searchedNodeLists(): string[][] {
    return searches
        .map((s) => filterLists(s.search))
        .filter((l): l is { source: string[]; target: string[] } => l !== null)
        .map((l) => {
            // The filter names each entity once as a source and once as a target.
            expect([...l.target].sort()).toEqual([...l.source].sort());
            return l.source;
        });
}

function duplicates(lists: string[][]): string[] {
    const seen = new Set<string>();
    const dup = new Set<string>();
    lists.flat().forEach((id) => (seen.has(id) ? dup.add(id) : seen.add(id)));
    return [...dup].sort();
}

const entitySearches = () => searches.filter((s) => /get_unique_entities/.test(s.search)).length;
const sorted = (xs: Iterable<string>) => [...xs].sort();
const key = (r: { source: string; target: string; label: string }) => `${r.source}|${r.target}|${r.label}`;

async function checkExpansion(entities: Entity[], rels: Rel[], root: string, degrees: number) {
    setWorld(entities, rels);
    const graph = await getGraphDataIteratively(root, degrees);
    const dist = distancesFrom(rels, root);
    const within = (k: number) => [...dist.entries()].filter(([, d]) => d <= k).map(([id]) => id);
    const where = `root ${root}, ${degrees} degree(s)`;

    // Searched: every entity within N-1 degrees, each once, nothing else.
    const lists = searchedNodeLists();
    expect({ where, duplicates: duplicates(lists) }).toEqual({ where, duplicates: [] });
    expect({ where, searched: sorted(lists.flat()) }).toEqual({ where, searched: sorted(within(degrees - 1)) });
    expect(lists.length).toBeLessThanOrEqual(degrees);
    expect(entitySearches()).toBe(1);

    // Drawn: the entities within N degrees (an entity with no relationships
    // at all draws an empty graph) and every relationship touching an entity
    // within N-1 degrees.
    const near = new Set(within(degrees - 1));
    const wantEdges = new Set(rels.filter((r) => near.has(r.source) || near.has(r.target)).map(key));
    const wantNodes = wantEdges.size ? within(degrees) : [];
    expect({ where, nodes: sorted(graph.nodes.map((n) => n.id)) }).toEqual({ where, nodes: sorted(wantNodes) });
    expect({ where, edges: sorted(graph.edges.map(key)) }).toEqual({ where, edges: sorted(wantEdges) });
}

const ents = (...ids: string[]): Entity[] => ids.map((id) => ({ id, label: id, type: 'host' }));
let relCount = 0;
const r = (source: string, target: string, label = 'connected_to'): Rel => ({ id: `y${relCount++}`, source, target, label });

describe('the spy sees the searches (positive control)', () => {
    test('a search sent is recorded, and a repeated entity is caught', async () => {
        setWorld([{ id: 'a', label: 'A', type: 'host' }], []);
        await getRelationshipsForNodes(['a', 'b']);
        await getRelationshipsForNodes(['a']);
        await getUniqueEntities();
        expect(searches).toHaveLength(3);
        expect(searchedNodeLists()).toEqual([['a', 'b'], ['a']]);
        expect(duplicates(searchedNodeLists())).toEqual(['a']);
        expect(entitySearches()).toBe(1);
    });
});

describe('degree expansion on seeded random graphs', () => {
    for (let seed = 1; seed <= 120; seed++) {
        test(`seed ${seed}`, async () => {
            const w = randomWorld(seed);
            const root = w.entities[seed % w.entities.length].id;
            for (const degrees of [1, 2, 3, 5]) {
                await checkExpansion(w.entities, w.relationships, root, degrees);
            }
        });
    }
});

describe('degree expansion, shapes', () => {
    test('a triangle and a cycle are not searched twice', async () => {
        const rels = [r('a', 'b'), r('b', 'c'), r('c', 'a'), r('c', 'd'), r('d', 'e'), r('e', 'a')];
        for (const d of [1, 2, 3, 4]) await checkExpansion(ents('a', 'b', 'c', 'd', 'e'), rels, 'a', d);
    });

    test('siblings related to each other, parallel and reversed relationships', async () => {
        const rels = [r('root', 'x'), r('root', 'y'), r('x', 'y'), r('y', 'x', 'owns'), r('x', 'root', 'owns'), r('y', 'z')];
        for (const d of [1, 2, 3]) await checkExpansion(ents('root', 'x', 'y', 'z'), rels, 'root', d);
    });

    test('stops searching once the component is exhausted', async () => {
        const rels = [r('a', 'b'), r('x', 'y')];
        await checkExpansion(ents('a', 'b', 'x', 'y'), rels, 'a', 5);
        expect(searchedNodeLists()).toEqual([['a'], ['b']]);
    });

    test('a self-link does not bring the root back', async () => {
        const rels = [r('a', 'a'), r('a', 'b'), r('b', 'b')];
        for (const d of [1, 2, 3]) await checkExpansion(ents('a', 'b'), rels, 'a', d);
    });
});

describe('more than one page of Splunk results', () => {
    // Splunk's results endpoint returns 100 rows unless asked for more.
    test('every entity is listed, not just the first 100', async () => {
        const many = Array.from({ length: 5000 }, (_, i) => ({ id: `e${i}`, label: `Entity ${i}`, type: 'user' }));
        setWorld(many, []);
        const got = await getUniqueEntities();
        expect(got).toHaveLength(5000);
        expect(got[4990]).toMatchObject({ id: 'e4990', label: 'Entity 4990' });
    });

    test('a hub with 250 relationships is drawn whole', async () => {
        const leaves = Array.from({ length: 250 }, (_, i) => `leaf${i}`);
        const rels = leaves.map((l) => r('hub', l));
        await checkExpansion(ents('hub', ...leaves), rels, 'hub', 1);
    });
});
