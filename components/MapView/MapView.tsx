'use client';

import { useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { MindNode } from '@/types/node';
import { buildMapGraph, type MapNodeData } from './mapLayout';
import MapNode from './MapNode';
import styles from './MapView.module.css';

const nodeTypes = { mapNode: MapNode };

interface MapViewProps {
  root: MindNode;
  selectedId: string | null;
  collapsed: Set<string>;
  filterMap: Map<string, { matched: boolean; hasMatchingDescendant: boolean }> | null;
  onSelect: (id: string) => void;
}

export default function MapView({
  root,
  selectedId,
  collapsed,
  filterMap,
  onSelect,
}: MapViewProps) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildMapGraph(root, collapsed, filterMap),
    [root, collapsed, filterMap]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MapNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(
      layoutNodes.map((node) => ({
        ...node,
        selected: node.id === selectedId,
      }))
    );
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, selectedId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<MapNodeData>) => {
      if (node.data.dimmed) return;
      onSelect(node.id);
    },
    [onSelect]
  );

  return (
    <div className={styles.wrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        minZoom={0.15}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
      </ReactFlow>
    </div>
  );
}
