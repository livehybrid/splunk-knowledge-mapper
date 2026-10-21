
import { EntityNode } from '@/types/entityExplorer';

export const getColorForType = (type: string) => {
  switch (type) {
    case "user": return "#4F46E5";
    case "host": return "#059669";
    case "ip": return "#D97706";
    default: return "#6B7280";
  }
};

// Lay the graph out around the explored (root) entity: the root at the
// origin, everything else on a ring round it. The viewport is centred on the
// root separately, once React Flow has measured the nodes.
export function assignPositions(nodes: EntityNode[], rootId: string | null): EntityNode[] {
  const nodeWidth = 250, nodeHeight = 70;

  if (rootId && nodes.find(n => n.id === rootId)) {
    const otherNodes = nodes.filter(n => n.id !== rootId);
    const newPositions: { [id: string]: { x: number, y: number } } = { [rootId]: { x: 0, y: 0 } };
    const radius = Math.max(220, otherNodes.length * 45);
    const angleStep = (2 * Math.PI) / Math.max(otherNodes.length, 1);
    otherNodes.forEach((node, idx) => {
      const angle = angleStep * idx - (Math.PI / 2); // start from the top
      newPositions[node.id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
    return nodes.map(n => ({ ...n, ...newPositions[n.id] }));
  }

  // No root in the data: a grid.
  const margin = 40;
  const perRow = Math.max(3, Math.floor(Math.sqrt(nodes.length)) + 1);
  return nodes.map((node, idx) => {
    const col = idx % perRow;
    const row = Math.floor(idx / perRow);
    return {
      ...node,
      x: 100 + col * (nodeWidth + margin),
      y: 50 + row * (nodeHeight + margin),
    };
  });
}
