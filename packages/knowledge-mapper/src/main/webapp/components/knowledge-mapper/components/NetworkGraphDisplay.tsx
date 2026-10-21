import React, { useCallback, useEffect, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { GraphData, EntityNode, EntityEdge } from '../types/entityExplorer';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node as RFNode,
  Edge as RFEdge,
  NodeChange,
  useReactFlow,
  useNodesInitialized,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { assignPositions, getColorForType } from '../lib/graphVisualizationUtils';

interface NetworkGraphDisplayProps {
  data: GraphData | null;
  isLoading: boolean;
  error: Error | null;
  selectedId: string | null;
  rootId?: string | null;
  onNodeClick?: (node: EntityNode) => void;
  onEdgeClick?: (edge: EntityEdge) => void;
  highlightedPath?: { nodes?: string[], edges?: string[] };
  showAnomalies?: boolean;
}

export interface NetworkGraphDisplayHandles {
    resetView: () => void;
}

const NetworkGraphDisplay = forwardRef<NetworkGraphDisplayHandles, NetworkGraphDisplayProps>(({
  data,
  isLoading,
  error,
  selectedId,
  rootId,
  onNodeClick,
  onEdgeClick,
  highlightedPath,
  showAnomalies,
}, ref) => {
  return (
    <div className="flex-grow m-4 rounded bg-white border relative">
      <div style={{ height: 600, width: "100%" }}>
        <ReactFlowProvider>
          <NetworkGraphDisplayComponent
            ref={ref}
            data={data}
            isLoading={isLoading}
            error={error}
            selectedId={selectedId}
            rootId={rootId}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            highlightedPath={highlightedPath}
            showAnomalies={showAnomalies}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
});

const NetworkGraphDisplayComponent = forwardRef<NetworkGraphDisplayHandles, NetworkGraphDisplayProps>(({
  data,
  isLoading,
  error,
  selectedId,
  rootId,
  onNodeClick,
  onEdgeClick,
  highlightedPath,
  showAnomalies,
}, ref) => {
  const { fitView, fitBounds, getNodes } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const graphRef = useRef(null);

  // Lay out around the explored root. Selecting a node only highlights it;
  // it must not move the graph.
  const preparedNodes = useMemo(() => {
    if (!data) return [];
    return assignPositions(data.nodes, rootId ?? null);
  }, [data, rootId]);

  // Convert EntityNode/EntityEdge to ReactFlow nodes/edges
  const initialRFNodes: RFNode[] = useMemo(
    () => preparedNodes.map(node => ({
      id: node.id,
      type: "default",
      position: { x: node.x!, y: node.y! },
      data: {
        label: node.label,
        type: node.type,
        selected: selectedId === node.id,
      },
      style: {
        border: highlightedPath?.nodes?.includes(node.id) ? '2px solid #1e90ff' : (node.id === selectedId ? '2px solid #ff4500' : '1px solid #b3b3b3'),
        boxShadow: highlightedPath?.nodes?.includes(node.id) ? '0 0 10px #1e90ff' : (node.id === selectedId ? '0 0 0 2px #A78BFA' : 'none'),
        backgroundColor: selectedId === node.id ? "#EAF0FB" : "#fff",
        color: "#22223B",
        fontWeight: 600,
        minWidth: 110,
        minHeight: 30,
      },
      className: node.type === "ip" ? "shadow ring-2 ring-amber-400" : ""
    })),
    [preparedNodes, selectedId, highlightedPath]
  );

  // Map current data.edges (they already match filtered visible edge set)
  const initialRFEdges: RFEdge[] = useMemo(
    () => (data ? data.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: `${edge.label}${edge.isAnomaly ? " (Anomaly!)" : ""}`,
      animated: (showAnomalies && edge.isAnomaly) || (!showAnomalies && highlightedPath?.edges?.includes(edge.id)),
      style: {
        stroke: showAnomalies && edge.isAnomaly ? '#ef4444' : (highlightedPath?.edges?.includes(edge.id) ? '#1e90ff' : '#b3b3b3'),
        strokeWidth: showAnomalies && edge.isAnomaly ? 3 : (highlightedPath?.edges?.includes(edge.id) ? 3 : 1.5),
      },
      labelStyle: { fill: showAnomalies && edge.isAnomaly ? "#ef4444" : "#374151", fontWeight: showAnomalies && edge.isAnomaly ? 600 : 400 },
      type: "default",
      zIndex: showAnomalies && edge.isAnomaly ? 200 : 100, // This will make edges appear on top of nodes
    })) : []),
    [data, highlightedPath, showAnomalies]
  );

  // Use internal state for node movement (draggable)
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(initialRFNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(initialRFEdges);

  // Fit the graph with the root at the centre of the view: fit a box centred
  // on the root that is just big enough to hold every node.
  const centreOnRoot = useCallback(() => {
    const nodes = getNodes();
    const root = nodes.find(n => n.id === rootId);
    if (!root) {
      fitView();
      return;
    }
    const size = (n: RFNode) => ({
      w: n.measured?.width ?? n.width ?? 150,
      h: n.measured?.height ?? n.height ?? 40,
    });
    const r = size(root);
    const cx = root.position.x + r.w / 2;
    const cy = root.position.y + r.h / 2;
    let halfW = r.w / 2;
    let halfH = r.h / 2;
    nodes.forEach(n => {
      const { w, h } = size(n);
      halfW = Math.max(halfW, Math.abs(n.position.x - cx), Math.abs(n.position.x + w - cx));
      halfH = Math.max(halfH, Math.abs(n.position.y - cy), Math.abs(n.position.y + h - cy));
    });
    fitBounds({ x: cx - halfW, y: cy - halfH, width: halfW * 2, height: halfH * 2 }, { padding: 0.1, duration: 0 });
  }, [getNodes, fitBounds, fitView, rootId]);

  useImperativeHandle(ref, () => ({
    resetView() {
      centreOnRoot();
    }
  }));

  // When data changes, reset rfNodes and rfEdges to reflect the new filtered graph
  useEffect(() => {
    setRfNodes(initialRFNodes);
    setRfEdges(initialRFEdges);
  }, [initialRFNodes, initialRFEdges]);

  // Centre once React Flow has measured the nodes, and again when the graph
  // or its root changes.
  useEffect(() => {
    if (nodesInitialized) centreOnRoot();
  }, [nodesInitialized, centreOnRoot, preparedNodes]);

  // Callback to handle node drag, update position in rfNodes state
  const handleNodesChange = (changes: NodeChange[]) => {
    onNodesChange(changes);
  };

  if (isLoading) {
    return <div className="flex-grow flex items-center justify-center p-4"><p>Loading graph data...</p></div>;
  }
  if (error) {
    return <div className="flex-grow flex items-center justify-center p-4 text-red-500"><p>Error loading graph: {error.message}</p></div>;
  }
  if (!data || data.nodes.length === 0) {
    return <div className="flex-grow flex items-center justify-center p-4"><p>No data to display. Try a different search.</p></div>;
  }

  return (
    <ReactFlow
      ref={graphRef}
      nodes={rfNodes}
      edges={rfEdges}
      panOnScroll
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => {
        const n = data.nodes.find(n => n.id === node.id);
        n && onNodeClick?.(n);
      }}
      onEdgeClick={(_, edge) => {
        const e = data.edges.find(e => e.id === edge.id);
        e && onEdgeClick?.(e);
      }}
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
});

export default NetworkGraphDisplay;
