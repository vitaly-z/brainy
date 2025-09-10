/**
 * Advanced Graph Pathfinding Algorithms
 * Provides shortest path, multi-hop traversal, and path ranking
 */
export interface GraphNode {
    id: string;
    [key: string]: any;
}
export interface GraphEdge {
    source: string;
    target: string;
    type: string;
    weight: number;
    metadata?: any;
}
export interface Path {
    nodes: string[];
    edges: GraphEdge[];
    totalWeight: number;
    length: number;
}
export interface PathfindingOptions {
    maxDepth?: number;
    maxPaths?: number;
    bidirectional?: boolean;
    weightField?: string;
    relationshipTypes?: string[];
    nodeFilter?: (node: GraphNode) => boolean;
    edgeFilter?: (edge: GraphEdge) => boolean;
}
export declare class GraphPathfinding {
    private adjacencyList;
    private nodes;
    /**
     * Add a node to the graph
     */
    addNode(node: GraphNode): void;
    /**
     * Add an edge to the graph
     */
    addEdge(edge: GraphEdge): void;
    /**
     * Find shortest path using Dijkstra's algorithm
     * O((V + E) log V) with binary heap
     */
    shortestPath(start: string, end: string, options?: PathfindingOptions): Path | null;
    /**
     * Find all paths between two nodes
     * Uses DFS with cycle detection
     */
    allPaths(start: string, end: string, options?: PathfindingOptions): Path[];
    /**
     * Bidirectional search for faster pathfinding
     * Searches from both start and end simultaneously
     */
    bidirectionalSearch(start: string, end: string, options?: PathfindingOptions): Path | null;
    /**
     * Multi-hop traversal (e.g., friends of friends)
     * Returns all nodes within N hops
     */
    multiHopTraversal(start: string, hops: number, options?: PathfindingOptions): Map<string, {
        distance: number;
        paths: Path[];
    }>;
    /**
     * Find connected components using DFS
     */
    connectedComponents(): Array<Set<string>>;
    /**
     * Calculate PageRank for all nodes
     * Useful for ranking importance in the graph
     */
    pageRank(iterations?: number, damping?: number): Map<string, number>;
    /**
     * Clear the graph
     */
    clear(): void;
}
