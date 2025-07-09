
import { EntityNode } from '@/types/entityExplorer';

export const getColorForType = (type: string) => {
  switch (type) {
    case "user": return "#4F46E5";
    case "host": return "#059669";
    case "ip": return "#D97706";
    default: return "#6B7280";
  }
};

// Helper to assign more intelligent positions to nodes
export function assignPositions(nodes: EntityNode[], selectedId: string | null): EntityNode[] {
  const nodeWidth = 250, nodeHeight = 70;

  // If a node is selected, arrange other nodes around it
  if (selectedId && nodes.find(n => n.id === selectedId)) {
    const centerNode = nodes.find(n => n.id === selectedId)!;
    const otherNodes = nodes.filter(n => n.id !== selectedId);

    const centerX = 400, centerY = 150;

    const newPositions: { [id: string]: { x: number, y: number } } = {};
    newPositions[centerNode.id] = { x: centerX, y: centerY };

    if (otherNodes.length === 2) {
      // Create a "V" shape for 2 neighbors, as in your example
      const yPos = centerY + 180;
      const xOffset = 300;
      newPositions[otherNodes[0].id] = { x: centerX - xOffset, y: yPos };
      newPositions[otherNodes[1].id] = { x: centerX + xOffset, y: yPos };
    } else if (otherNodes.length > 0) {
      // Use a circular layout for other cases
      const radius = 280;
      const angleStep = (2 * Math.PI) / otherNodes.length;
      otherNodes.forEach((node, idx) => {
        const angle = angleStep * idx - (Math.PI / 2); // Start from the top
        newPositions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    }
    return nodes.map(n => ({...n, ...newPositions[n.id]!}));
  }

  // Fallback to a smarter grid layout if no node is selected
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
