
export interface EntityNode {
  id: string;
  label: string;
  type: 'user' | 'host' | 'ip';
  details?: Record<string, any>;
  x?: number; // Optional: for initial positioning if library supports it
  y?: number; // Optional: for initial positioning
}

export interface EntityEdge {
  id: string;
  source: string; // ID of the source EntityNode
  target: string; // ID of the target EntityNode
  label: string;
  isAnomaly?: boolean;
  details?: Record<string, any>;
}

export interface GraphData {
  nodes: EntityNode[];
  edges: EntityEdge[];
}

export interface Path {
  nodes: EntityNode[];
  edges: EntityEdge[];
  degrees: number;
}
