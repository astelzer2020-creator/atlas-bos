export type WorkflowNodeType =
  | 'start_event'
  | 'end_event'
  | 'exclusive_gateway'
  | 'parallel_gateway'
  | 'inclusive_gateway'
  | 'human_task'
  | 'service_task'
  | 'agent_task'
  | 'timer_event'
  | 'sub_workflow'
  | 'compensation_handler';

export interface WorkflowGraphNode {
  readonly id: string;
  readonly type: WorkflowNodeType;
  readonly name?: string;
  readonly config?: Record<string, unknown>;
}

export interface WorkflowGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: string;
}

export interface WorkflowGraph {
  readonly nodes: WorkflowGraphNode[];
  readonly edges: WorkflowGraphEdge[];
}

export const DEFAULT_WORKFLOW_GRAPH: WorkflowGraph = {
  nodes: [
    { id: 'start', type: 'start_event' },
    { id: 'end', type: 'end_event' },
  ],
  edges: [{ from: 'start', to: 'end' }],
};

export function parseWorkflowGraph(value: unknown): WorkflowGraph | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
    return null;
  }

  const nodes: WorkflowGraphNode[] = [];
  for (const rawNode of record.nodes) {
    if (rawNode === null || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      return null;
    }

    const node = rawNode as Record<string, unknown>;
    if (typeof node.id !== 'string' || typeof node.type !== 'string') {
      return null;
    }

    nodes.push({
      id: node.id,
      type: node.type as WorkflowNodeType,
      ...(typeof node.name === 'string' ? { name: node.name } : {}),
      ...(node.config !== undefined &&
      node.config !== null &&
      typeof node.config === 'object' &&
      !Array.isArray(node.config)
        ? { config: node.config as Record<string, unknown> }
        : {}),
    });
  }

  const edges: WorkflowGraphEdge[] = [];
  for (const rawEdge of record.edges) {
    if (rawEdge === null || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) {
      return null;
    }

    const edge = rawEdge as Record<string, unknown>;
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      return null;
    }

    edges.push({
      from: edge.from,
      to: edge.to,
      ...(typeof edge.condition === 'string' ? { condition: edge.condition } : {}),
    });
  }

  return { nodes, edges };
}

export function findGraphNode(graph: WorkflowGraph, nodeId: string): WorkflowGraphNode | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

export function getOutgoingEdges(graph: WorkflowGraph, nodeId: string): WorkflowGraphEdge[] {
  return graph.edges.filter((edge) => edge.from === nodeId);
}

export function findStartNode(graph: WorkflowGraph): WorkflowGraphNode | undefined {
  return graph.nodes.find((node) => node.type === 'start_event');
}

export function graphHasStartAndEndEvents(graph: WorkflowGraph): boolean {
  const hasStart = graph.nodes.some((node) => node.type === 'start_event');
  const hasEnd = graph.nodes.some((node) => node.type === 'end_event');
  return hasStart && hasEnd;
}

/**
 * Evaluates simple edge conditions: empty/missing (always true),
 * `outcome == 'approved'`, or `outcome == 'rejected'`.
 */
export function evaluateEdgeCondition(condition: string | undefined, outcome?: string): boolean {
  if (condition === undefined || condition.trim() === '') {
    return true;
  }

  const match = condition.match(/^outcome\s*==\s*'([^']+)'$/);
  if (match !== null) {
    return outcome === match[1];
  }

  return false;
}