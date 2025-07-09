
import { GraphData, EntityNode, EntityEdge, Path } from '@/types/entityExplorer';

// A simple BFS implementation to find all paths up to a max depth.
export const findPaths = (
  graph: GraphData,
  startNodeId: string,
  endNodeId: string,
  maxDepth: number
): Path[] => {
  const paths: Path[] = [];
  const queue: { path: { nodes: EntityNode[], edges: EntityEdge[] }, visited: Set<string> }[] = [];

  const startNode = graph.nodes.find(n => n.id.toLowerCase() === startNodeId.toLowerCase());
  const endNode = graph.nodes.find(n => n.id.toLowerCase() === endNodeId.toLowerCase());

  if (!startNode || !endNode) {
    return []; // Start or end node not in graph
  }

  // A queue of paths to explore. Each item is a path so far.
  queue.push({ path: { nodes: [startNode], edges: [] }, visited: new Set([startNode.id]) });

  while (queue.length > 0) {
    const { path, visited } = queue.shift()!;
    const lastNode = path.nodes[path.nodes.length - 1];

    if (lastNode.id === endNode.id) {
      paths.push({ ...path, degrees: path.edges.length });
      continue; // Found a path
    }

    if (path.edges.length >= maxDepth) {
      continue; // Path is too long
    }

    // Find all edges connected to the last node
    const connectedEdges = graph.edges.filter(
      edge => edge.source === lastNode.id || edge.target === lastNode.id
    );

    for (const edge of connectedEdges) {
      const neighborId = edge.source === lastNode.id ? edge.target : edge.source;

      // Avoid cycles in the path
      if (!visited.has(neighborId)) {
        const neighborNode = graph.nodes.find(n => n.id === neighborId);
        if (neighborNode) {
          const newPath = {
            nodes: [...path.nodes, neighborNode],
            edges: [...path.edges, edge],
          };
          const newVisited = new Set(visited);
          newVisited.add(neighborId);
          queue.push({ path: newPath, visited: newVisited });
        }
      }
    }
  }

  return paths;
};
