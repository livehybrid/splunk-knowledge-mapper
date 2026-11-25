// The Relationship Finder's path search, kept apart from the page so it can
// be tested without React.

export interface Relationship {
    source: string;
    target: string;
    label: string;
    [field: string]: any;
}

export interface FoundRoute {
    ids: string[]; // entity ids from start to end, in order
    rels: Relationship[]; // rels[i] joins ids[i] and ids[i + 1], in either direction
}

// Breadth-first search out from the start entity, one fetch per hop,
// relationships taken in either direction. The first time the end entity is
// reached is a shortest path; walking back through each entity's parent gives
// it in order. Returns null when no path of at most maxDegrees hops exists.
export async function findShortestPath(
    startId: string,
    endId: string,
    maxDegrees: number,
    fetchRelationships: (ids: string[]) => Promise<Relationship[]>
): Promise<FoundRoute | null> {
    const parent = new Map<string, { from: string; rel: Relationship } | null>([[startId, null]]);
    let frontier: string[] = [startId];
    for (let hop = 0; hop < maxDegrees && frontier.length > 0 && !parent.has(endId); hop++) {
        const rels = await fetchRelationships(frontier);
        const inFrontier = new Set(frontier);
        const next: string[] = [];
        for (const rel of rels) {
            for (const [from, to] of [[rel.source, rel.target], [rel.target, rel.source]]) {
                if (inFrontier.has(from) && !parent.has(to)) {
                    parent.set(to, { from, rel });
                    next.push(to);
                }
            }
        }
        frontier = next;
    }
    if (!parent.has(endId)) {
        return null;
    }
    const ids: string[] = [endId];
    const rels: Relationship[] = [];
    for (let step = parent.get(endId); step; step = parent.get(step.from)) {
        rels.unshift(step.rel);
        ids.unshift(step.from);
    }
    return { ids, rels };
}
