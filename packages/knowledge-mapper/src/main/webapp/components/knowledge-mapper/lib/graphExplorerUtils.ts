
import { GraphData } from '@/types/entityExplorer';

// Fixed logic: Add nodes at distance N from start, including direct neighbors when degrees = 1.
export function findNodesWithinDegrees(
  data: GraphData,
  startId: string,
  degrees: number
): GraphData {
  if (!startId || degrees < 1) return { nodes: [], edges: [] };

  const visited = new Set<string>();
  let currentLayer: string[] = [startId];
  visited.add(startId);

  for (let d = 0; d < degrees; d++) {
    let nextLayer: string[] = [];
    for (const nodeId of currentLayer) {
      for (const edge of data.edges) {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          nextLayer.push(edge.target);
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          nextLayer.push(edge.source);
        }
      }
    }
    for (const node of nextLayer) {
      visited.add(node);
    }
    currentLayer = nextLayer;
    if (currentLayer.length === 0) break;
  }

  // NEW: Edges are included if both endpoints are visible
  const nodes = data.nodes.filter(n => visited.has(n.id));
  const visibleIds = new Set(nodes.map(n => n.id));
  const edges = data.edges.filter(
    e => visibleIds.has(e.source) && visibleIds.has(e.target)
  );
  return { nodes, edges };
}
