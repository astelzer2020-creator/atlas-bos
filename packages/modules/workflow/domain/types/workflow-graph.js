export const DEFAULT_WORKFLOW_GRAPH = {
    nodes: [
        { id: 'start', type: 'start_event' },
        { id: 'end', type: 'end_event' },
    ],
    edges: [{ from: 'start', to: 'end' }],
};
export function parseWorkflowGraph(value) {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value;
    if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
        return null;
    }
    const nodes = [];
    for (const rawNode of record.nodes) {
        if (rawNode === null || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
            return null;
        }
        const node = rawNode;
        if (typeof node.id !== 'string' || typeof node.type !== 'string') {
            return null;
        }
        nodes.push({
            id: node.id,
            type: node.type,
            ...(typeof node.name === 'string' ? { name: node.name } : {}),
            ...(node.config !== undefined &&
                node.config !== null &&
                typeof node.config === 'object' &&
                !Array.isArray(node.config)
                ? { config: node.config }
                : {}),
        });
    }
    const edges = [];
    for (const rawEdge of record.edges) {
        if (rawEdge === null || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) {
            return null;
        }
        const edge = rawEdge;
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
export function findGraphNode(graph, nodeId) {
    return graph.nodes.find((node) => node.id === nodeId);
}
export function getOutgoingEdges(graph, nodeId) {
    return graph.edges.filter((edge) => edge.from === nodeId);
}
export function findStartNode(graph) {
    return graph.nodes.find((node) => node.type === 'start_event');
}
export function graphHasStartAndEndEvents(graph) {
    const hasStart = graph.nodes.some((node) => node.type === 'start_event');
    const hasEnd = graph.nodes.some((node) => node.type === 'end_event');
    return hasStart && hasEnd;
}
/**
 * Evaluates simple edge conditions: empty/missing (always true),
 * `outcome == 'approved'`, or `outcome == 'rejected'`.
 */
export function evaluateEdgeCondition(condition, outcome) {
    if (condition === undefined || condition.trim() === '') {
        return true;
    }
    const match = condition.match(/^outcome\s*==\s*'([^']+)'$/);
    if (match !== null) {
        return outcome === match[1];
    }
    return false;
}
//# sourceMappingURL=workflow-graph.js.map