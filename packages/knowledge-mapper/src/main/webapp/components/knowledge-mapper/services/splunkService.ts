import { GraphData, EntityNode, EntityEdge } from '../types/entityExplorer';
import SearchJob from '@splunk/search-job';
import { app, username } from '@splunk/splunk-utils/config';
import { md5Hex } from '../lib/md5';

// Helper to create and dispatch a search job, returning the results.
const runSearch = (search: string): Promise<any[]> => {
    const searchJob = SearchJob.create({
        search: search,
        earliest_time: '-24h',
        latest_time: 'now',
    }, {
        app: app,
        owner: username,
    });

    return new Promise((resolve, reject) => {
        const results: any[] = [];
        // count 0: every row. Splunk's results endpoint otherwise returns the
        // first 100, which silently dropped entities and relationships.
        const subscription = searchJob.getResults({ count: 0 }).subscribe({
            next: (data: any) => {
                if (data && data.results && Array.isArray(data.results)) {
                    // This handles the final API response format with a 'results' array.
                    results.push(...data.results);
                } else if (data.fields && data.rows) {
                    // This handles intermediate chunked data with 'fields' and 'rows'.
                    const fieldNames = data.fields.map((f: { name: string }) => f.name);
                    const formattedRows = data.rows.map((row: any[]) => {
                        const newRow: Record<string, any> = {};
                        fieldNames.forEach((field: string, i: number) => {
                            newRow[field] = row[i];
                        });
                        return newRow;
                    });
                    results.push(...formattedRows);
                }
            },
            error: (err: Error) => {
                console.error('Error fetching search results:', err);
                reject(err);
                subscription.unsubscribe();
            },
            complete: () => {
                resolve(results);
                subscription.unsubscribe();
            },
        });
    });
};

/**
 * Fetches the list of all unique entities from Splunk.
 */
export const getUniqueEntities = async (): Promise<EntityNode[]> => {
    const search = '| `get_unique_entities`';
    const results = await runSearch(search);
    console.log("Results:", results);
    return results.map((row: any) => ({
        id: row.entityId,
        label: row.name,
        type: row.entityType,
        details: { description: row.description },
    }));
};

/**
 * Fetches all relationships for a given list of nodes.
 * @param nodes The list of node IDs to find relationships for.
 */
export const getRelationshipsForNodes = async (nodes: string[]): Promise<any[]> => {
    if (nodes.length === 0) {
        return [];
    }
    // An eval expression for the macro's `where`. Ids are named by the MD5 of
    // their text, compared with md5(source) and md5(target), so an id never
    // appears in the SPL: quotes, commas, backslashes, backticks and `$` in an
    // id cannot break the quoted macro argument or the eval string, and the
    // comparison stays exact (case-sensitive), as the lookups are.
    const list = Array.from(new Set(nodes)).map(n => `"${md5Hex(n)}"`).join(',');
    const nodeFilter = `in(md5(source),${list}) OR in(md5(target),${list})`;
    const search = `| \`get_relationships_for_nodes(node_filter="${nodeFilter.replace(/"/g, '\\"')}")\``;
    return runSearch(search);
};

/**
 * The id the explorer gives a relationship. The Relationship Finder uses the
 * same id in the path it hands the explorer, so the path can be highlighted.
 */
export const edgeId = (rel: { source: string; target: string; label: string }): string =>
    `${rel.source}-${rel.target}-${rel.label}`;

/**
 * Fetches graph data iteratively starting from a root entity.
 * @param startEntityId The ID of the entity to start the graph from.
 * @param degrees The number of degrees of separation to fetch.
 * @returns A promise that resolves to the full graph data.
 */
export const getGraphDataIteratively = async (startEntityId: string, degrees: number): Promise<GraphData> => {
    let nodesToExplore: Set<string> = new Set([startEntityId]);
    let exploredNodes: Set<string> = new Set();
    let allEdges: Map<string, any> = new Map();

    for (let i = 0; i < degrees; i++) {
        if (nodesToExplore.size === 0) {
            break; // No new nodes to explore
        }
        
        const relationships = await getRelationshipsForNodes(Array.from(nodesToExplore));

        // Add the current batch of nodes to the explored set
        nodesToExplore.forEach(node => exploredNodes.add(node));
        nodesToExplore.clear();

        relationships.forEach((rel: any) => {
            // Add edge if not already present
            const id = edgeId(rel);
            if (!allEdges.has(id)) {
                allEdges.set(id, {
                    id,
                    source: rel.source,
                    target: rel.target,
                    label: rel.label,
                    isAnomaly: rel.isAnomaly === 'true',
                    details: { description: rel.description },
                });
            }

            // Add new nodes to the next exploration frontier
            if (!exploredNodes.has(rel.source)) {
                nodesToExplore.add(rel.source);
            }
            if (!exploredNodes.has(rel.target)) {
                nodesToExplore.add(rel.target);
            }
        });
    }

    // Now, fetch the details for all unique nodes we've gathered. The start
    // entity is drawn even when it has no relationships at all.
    const allNodeIds = Array.from(new Set([startEntityId, ...[...allEdges.values()].flatMap((e: any) => [e.source, e.target])]));
    const allEntities = await getUniqueEntities();
    const finalNodes = allEntities.filter(node => allNodeIds.includes(node.id));

    return {
        nodes: finalNodes,
        edges: Array.from(allEdges.values()),
    };
};
