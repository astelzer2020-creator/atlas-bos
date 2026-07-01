export type WorkflowNodeType = 'start_event' | 'end_event' | 'exclusive_gateway' | 'parallel_gateway' | 'inclusive_gateway' | 'human_task' | 'service_task' | 'agent_task' | 'timer_event' | 'sub_workflow' | 'compensation_handler';
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
export declare const DEFAULT_WORKFLOW_GRAPH: WorkflowGraph;
export declare function parseWorkflowGraph(value: unknown): WorkflowGraph | null;
export declare function findGraphNode(graph: WorkflowGraph, nodeId: string): WorkflowGraphNode | undefined;
export declare function getOutgoingEdges(graph: WorkflowGraph, nodeId: string): WorkflowGraphEdge[];
export declare function findStartNode(graph: WorkflowGraph): WorkflowGraphNode | undefined;
export declare function graphHasStartAndEndEvents(graph: WorkflowGraph): boolean;
/**
 * Evaluates simple edge conditions: empty/missing (always true),
 * `outcome == 'approved'`, or `outcome == 'rejected'`.
 */
export declare function evaluateEdgeCondition(condition: string | undefined, outcome?: string): boolean;
//# sourceMappingURL=workflow-graph.d.ts.map