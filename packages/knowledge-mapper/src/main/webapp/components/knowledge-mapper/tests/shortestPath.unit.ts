/*
 * The Relationship Finder's path search against a plain breadth-first oracle.
 *
 * The search runs through the app's real search service, with Splunk replaced
 * by the fake in fakeSplunk.ts. Each answer is checked on its own terms: it is
 * a real chain of relationships from start to end, with the oracle's shortest
 * length. Where several shortest paths exist, any of them is accepted.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { searches, setWorld, randomWorld, distancesFrom, prng, Rel, Entity } from './fakeSplunk';
import { findShortestPath, FoundRoute } from '../lib/shortestPath';
import { getRelationshipsForNodes } from '../services/splunkService';

jest.mock('@splunk/search-job', () => require('./fakeSplunk').searchJobModule);
jest.mock('@splunk/splunk-utils/config', () => ({ app: 'knowledge-mapper', username: 'admin' }));

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

const ent = (...ids: string[]): Entity[] => ids.map((id) => ({ id, label: id, type: 'host' }));
let nextId = 0;
const rel = (source: string, target: string, label = 'connected_to'): Rel => ({ id: `x${nextId++}`, source, target, label });

function find(start: string, end: string, max: number): Promise<FoundRoute | null> {
    return findShortestPath(start, end, max, getRelationshipsForNodes);
}

// The route is a chain of real relationships from start to end, as short as
// the oracle says is possible, or null exactly when no such chain fits in max.
function expectShortest(rels: Rel[], start: string, end: string, max: number, route: FoundRoute | null) {
    const d = distancesFrom(rels, start).get(end);
    const where = `${start} -> ${end} (max ${max}, shortest ${d})`;
    if (d === undefined || d > max) {
        expect({ where, route }).toEqual({ where, route: null });
        return;
    }
    expect(route).not.toBeNull();
    const { ids, rels: used } = route as FoundRoute;
    expect({ where, hops: used.length }).toEqual({ where, hops: d });
    expect(ids).toHaveLength(d + 1);
    expect(ids[0]).toBe(start);
    expect(ids[ids.length - 1]).toBe(end);
    expect(new Set(ids).size).toBe(ids.length); // never revisits an entity
    const byId = new Map(rels.map((r) => [r.id, r]));
    used.forEach((u, i) => {
        // Endpoints read from the world, not from what the search returned.
        const real = byId.get(u.id);
        expect(real).toBeDefined();
        const ends = [real!.source, real!.target].sort();
        expect(ends).toEqual([ids[i], ids[i + 1]].sort());
    });
}

describe('shortest path, property style on seeded random graphs', () => {
    for (let seed = 1; seed <= 150; seed++) {
        test(`seed ${seed}`, async () => {
            const w = randomWorld(seed);
            setWorld(w.entities, w.relationships);
            const rnd = prng(seed * 7919);
            for (let k = 0; k < 6; k++) {
                const start = w.entities[Math.floor(rnd() * w.entities.length)].id;
                const end = w.entities[Math.floor(rnd() * w.entities.length)].id;
                const max = 1 + Math.floor(rnd() * 6);
                expectShortest(w.relationships, start, end, max, await find(start, end, max));
            }
        });
    }
});

describe('shortest path, shapes', () => {
    test('cycles: a ring and a chord, both directions, either tie accepted', async () => {
        const rels = [rel('a', 'b'), rel('b', 'c'), rel('c', 'd'), rel('d', 'e'), rel('e', 'f'), rel('f', 'a'), rel('b', 'e')];
        setWorld(ent('a', 'b', 'c', 'd', 'e', 'f'), rels);
        for (const [s, t] of [['a', 'd'], ['d', 'a'], ['c', 'f'], ['a', 'e'], ['f', 'c']]) {
            expectShortest(rels, s, t, 5, await find(s, t, 5));
        }
    });

    test('self-links are never a step', async () => {
        const rels = [rel('a', 'a'), rel('a', 'b'), rel('b', 'b'), rel('b', 'c')];
        setWorld(ent('a', 'b', 'c', 'z'), rels);
        expectShortest(rels, 'a', 'c', 5, await find('a', 'c', 5));
        expectShortest(rels, 'a', 'z', 5, await find('a', 'z', 5)); // z has no relationships
        const self = [rel('q', 'q')];
        setWorld(ent('q', 'r'), self);
        expect(await find('q', 'r', 5)).toBeNull();
    });

    test('disconnected entities have no path, at any depth', async () => {
        const rels = [rel('a', 'b'), rel('b', 'c'), rel('x', 'y')];
        setWorld(ent('a', 'b', 'c', 'x', 'y', 'lonely'), rels);
        expect(await find('a', 'y', 5)).toBeNull();
        expect(await find('lonely', 'a', 5)).toBeNull();
        expect(await find('a', 'lonely', 5)).toBeNull();
    });

    test('equal-length ties: a diamond and a ladder, any shortest route accepted', async () => {
        const diamond = [rel('s', 'x'), rel('s', 'y'), rel('x', 't'), rel('t', 'y')];
        setWorld(ent('s', 'x', 'y', 't'), diamond);
        expectShortest(diamond, 's', 't', 3, await find('s', 't', 3));
        expectShortest(diamond, 't', 's', 3, await find('t', 's', 3));
        // A ladder: many shortest routes, plus a longer detour that must lose.
        const ladder = [rel('a1', 'a2'), rel('a2', 'a3'), rel('b1', 'b2'), rel('b2', 'b3'),
            rel('a1', 'b1'), rel('a2', 'b2'), rel('a3', 'b3'), rel('a1', 'detour'), rel('detour', 'd2'), rel('d2', 'd3'), rel('d3', 'b3')];
        setWorld(ent('a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'detour', 'd2', 'd3'), ladder);
        expectShortest(ladder, 'a1', 'b3', 5, await find('a1', 'b3', 5));
    });

    test('a relationship read in either direction', async () => {
        const rels = [rel('b', 'a'), rel('c', 'b'), rel('c', 'd')];
        setWorld(ent('a', 'b', 'c', 'd'), rels);
        expectShortest(rels, 'a', 'd', 3, await find('a', 'd', 3));
    });

    test('start == end is a path of no hops, found without a search', async () => {
        const rels = [rel('a', 'b'), rel('a', 'a')];
        setWorld(ent('a', 'b'), rels);
        const route = await find('a', 'a', 3);
        expect(route).toEqual({ ids: ['a'], rels: [] });
        expect(searches).toHaveLength(0);
    });

    test('the maximum degrees limit is a hard limit', async () => {
        const rels = [rel('a', 'b'), rel('b', 'c'), rel('c', 'd')];
        setWorld(ent('a', 'b', 'c', 'd'), rels);
        expect(await find('a', 'd', 2)).toBeNull();
        expectShortest(rels, 'a', 'd', 3, await find('a', 'd', 3));
    });
});
