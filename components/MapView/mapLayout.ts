import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { MindNode, Status } from '@/types/node';
import { calcNumbers, countDescendants, type NumberedNode } from '@/hooks/useTree';

export const MAP_NODE_WIDTH = 220;
export const COLLAPSE_HANDLE_SIZE = 28;

export type MapNodeData = {
  kind: 'mapNode';
  number: string;
  name: string;
  responsible: string | null;
  status: Status | null;
  dimmed: boolean;
  parentContext: boolean;
};

export type CollapseHandleData = {
  kind: 'collapseHandle';
  parentId: string;
  descendantCount: number;
  isCollapsed: boolean;
};

export type MapFlowNodeData = MapNodeData | CollapseHandleData;

type FilterEntry = { matched: boolean; hasMatchingDescendant: boolean };

export function collapseHandleId(parentId: string): string {
  return `collapse:${parentId}`;
}

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
  flowNodes: Node<MapFlowNodeData>[],
  flowEdges: Edge[]
): void {
  const { dimmed, parentContext } = getFilterFlags(node.id, filterMap);

  flowNodes.push({
    id: node.id,
    type: 'mapNode',
    position: { x: 0, y: 0 },
    data: {
      kind: 'mapNode' as const,
      number: node.number,
      name: node.name,
      responsible: node.responsible,
      status: node.status,
      dimmed,
      parentContext,
    },
    selectable: !dimmed,
  });

  if (node.children.length === 0) return;

  const isCollapsed = collapsed.has(node.id);
  const descendantCount = countDescendants(node);
  const handleId = collapseHandleId(node.id);

  if (isCollapsed) {
    flowNodes.push({
      id: handleId,
      type: 'collapseHandle',
      position: { x: 0, y: 0 },
      data: {
        kind: 'collapseHandle',
        parentId: node.id,
        descendantCount,
        isCollapsed: true,
      },
      selectable: false,
      draggable: false,
      zIndex: 10,
    });
    flowEdges.push({
      id: `${node.id}-${handleId}`,
      source: node.id,
      target: handleId,
      type: 'smoothstep',
    });
    return;
  }

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
  nodes: Node<MapFlowNodeData>[],
  edges: Edge[],
  numbered: NumberedNode
): { nodes: Node<MapFlowNodeData>[]; heightById: Map<string, number> } {
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
    if (node.type === 'collapseHandle') {
      g.setNode(node.id, {
        width: COLLAPSE_HANDLE_SIZE,
        height: COLLAPSE_HANDLE_SIZE,
      });
      continue;
    }
    g.setNode(node.id, {
      width: MAP_NODE_WIDTH,
      height: heightById.get(node.id) ?? 80,
    });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const layoutNode = g.node(node.id);
    if (node.type === 'collapseHandle') {
      return {
        ...node,
        position: {
          x: layoutNode.x - COLLAPSE_HANDLE_SIZE / 2,
          y: layoutNode.y - COLLAPSE_HANDLE_SIZE / 2,
        },
      };
    }
    const height = heightById.get(node.id) ?? 80;
    return {
      ...node,
      position: {
        x: layoutNode.x - MAP_NODE_WIDTH / 2,
        y: layoutNode.y - height / 2,
      },
    };
  });

  return { nodes: layoutNodes, heightById };
}

function addExpandedBranchHandles(
  nodes: Node<MapFlowNodeData>[],
  numbered: NumberedNode,
  collapsed: Set<string>,
  heightById: Map<string, number>
): Node<MapFlowNodeData>[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const extraHandles: Node<MapFlowNodeData>[] = [];

  function walk(node: NumberedNode): void {
    if (node.children.length === 0) return;

    if (collapsed.has(node.id)) {
      return;
    }

    const parent = nodeById.get(node.id);
    if (!parent || parent.type !== 'mapNode') return;

    const childNodes = (node.children as NumberedNode[])
      .map((child) => nodeById.get(child.id))
      .filter((child): child is Node<MapFlowNodeData> => Boolean(child));

    if (childNodes.length === 0) return;

    const parentRight = parent.position.x + MAP_NODE_WIDTH;
    const minChildX = Math.min(...childNodes.map((child) => child.position.x));
    const childCenterYs = childNodes.map((child) => {
      const h =
        child.type === 'mapNode' ? (heightById.get(child.id) ?? 80) : COLLAPSE_HANDLE_SIZE;
      return child.position.y + h / 2;
    });
    const centerY = (Math.min(...childCenterYs) + Math.max(...childCenterYs)) / 2;

    extraHandles.push({
      id: collapseHandleId(node.id),
      type: 'collapseHandle',
      position: {
        x: parentRight + (minChildX - parentRight) / 2 - COLLAPSE_HANDLE_SIZE / 2,
        y: centerY - COLLAPSE_HANDLE_SIZE / 2,
      },
      data: {
        kind: 'collapseHandle',
        parentId: node.id,
        descendantCount: countDescendants(node),
        isCollapsed: false,
      },
      selectable: false,
      draggable: false,
      zIndex: 10,
    });

    for (const child of node.children as NumberedNode[]) {
      walk(child);
    }
  }

  walk(numbered);
  return [...nodes, ...extraHandles];
}

export function buildMapGraph(
  root: MindNode,
  collapsed: Set<string>,
  filterMap: Map<string, FilterEntry> | null
): { nodes: Node<MapFlowNodeData>[]; edges: Edge[] } {
  const numbered = calcNumbers(root);
  const flowNodes: Node<MapFlowNodeData>[] = [];
  const flowEdges: Edge[] = [];

  walkVisibleTree(numbered, collapsed, filterMap, flowNodes, flowEdges);

  if (flowNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const { nodes: layoutNodes, heightById } = applyDagreLayout(flowNodes, flowEdges, numbered);
  const nodesWithHandles = addExpandedBranchHandles(layoutNodes, numbered, collapsed, heightById);

  return {
    nodes: nodesWithHandles,
    edges: flowEdges,
  };
}
