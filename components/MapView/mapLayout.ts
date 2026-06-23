import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { MindNode, Status } from '@/types/node';
import { calcNumbers, type NumberedNode } from '@/hooks/useTree';

export const MAP_NODE_WIDTH = 220;

export type MapNodeData = {
  number: string;
  name: string;
  responsible: string | null;
  status: Status | null;
  dimmed: boolean;
  parentContext: boolean;
};

type FilterEntry = { matched: boolean; hasMatchingDescendant: boolean };

function estimateNodeHeight(node: NumberedNode): number {
  const nameLines = Math.max(1, Math.ceil(node.name.length / 28));
  let height = 40 + nameLines * 18;
  if (node.responsible) height += 22;
  if (node.status) height += 22;
  return Math.max(height, 80);
}

function getFilterFlags(
  nodeId: string,
  filterMap: Map<string, FilterEntry> | null
): { dimmed: boolean; parentContext: boolean } {
  if (!filterMap) return { dimmed: false, parentContext: false };
  const info = filterMap.get(nodeId);
  if (!info) return { dimmed: false, parentContext: false };
  const dimmed = !info.matched && !info.hasMatchingDescendant;
  const parentContext = !info.matched && info.hasMatchingDescendant;
  return { dimmed, parentContext };
}

function walkVisibleTree(
  node: NumberedNode,
  collapsed: Set<string>,
  filterMap: Map<string, FilterEntry> | null,
  flowNodes: Node<MapNodeData>[],
  flowEdges: Edge[]
): void {
  const { dimmed, parentContext } = getFilterFlags(node.id, filterMap);

  flowNodes.push({
    id: node.id,
    type: 'mapNode',
    position: { x: 0, y: 0 },
    data: {
      number: node.number,
      name: node.name,
      responsible: node.responsible,
      status: node.status,
      dimmed,
      parentContext,
    },
    selectable: !dimmed,
  });

  if (collapsed.has(node.id)) return;

  for (const child of node.children as NumberedNode[]) {
    flowEdges.push({
      id: `${node.id}-${child.id}`,
      source: node.id,
      target: child.id,
      type: 'smoothstep',
    });
    walkVisibleTree(child, collapsed, filterMap, flowNodes, flowEdges);
  }
}

function applyDagreLayout(
  nodes: Node<MapNodeData>[],
  edges: Edge[],
  numbered: NumberedNode
): Node<MapNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 72, marginx: 24, marginy: 24 });

  const heightById = new Map<string, number>();

  function registerHeights(node: NumberedNode): void {
    heightById.set(node.id, estimateNodeHeight(node));
    for (const child of node.children as NumberedNode[]) {
      registerHeights(child);
    }
  }
  registerHeights(numbered);

  for (const node of nodes) {
    g.setNode(node.id, {
      width: MAP_NODE_WIDTH,
      height: heightById.get(node.id) ?? 80,
    });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const layoutNode = g.node(node.id);
    const height = heightById.get(node.id) ?? 80;
    return {
      ...node,
      position: {
        x: layoutNode.x - MAP_NODE_WIDTH / 2,
        y: layoutNode.y - height / 2,
      },
    };
  });
}

export function buildMapGraph(
  root: MindNode,
  collapsed: Set<string>,
  filterMap: Map<string, FilterEntry> | null
): { nodes: Node<MapNodeData>[]; edges: Edge[] } {
  const numbered = calcNumbers(root);
  const flowNodes: Node<MapNodeData>[] = [];
  const flowEdges: Edge[] = [];

  walkVisibleTree(numbered, collapsed, filterMap, flowNodes, flowEdges);

  if (flowNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  return {
    nodes: applyDagreLayout(flowNodes, flowEdges, numbered),
    edges: flowEdges,
  };
}
