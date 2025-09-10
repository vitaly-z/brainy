/**
 * Advanced Graph Pathfinding Algorithms
 * Provides shortest path, multi-hop traversal, and path ranking
 */
export class GraphPathfinding {
    constructor() {
        this.adjacencyList = new Map();
        this.nodes = new Map();
    }
    /**
     * Add a node to the graph
     */
    addNode(node) {
        this.nodes.set(node.id, node);
        if (!this.adjacencyList.has(node.id)) {
            this.adjacencyList.set(node.id, new Map());
        }
    }
    /**
     * Add an edge to the graph
     */
    addEdge(edge) {
        // Ensure nodes exist
        if (!this.adjacencyList.has(edge.source)) {
            this.adjacencyList.set(edge.source, new Map());
        }
        if (!this.adjacencyList.has(edge.target)) {
            this.adjacencyList.set(edge.target, new Map());
        }
        // Add edge to adjacency list
        const sourceEdges = this.adjacencyList.get(edge.source);
        if (!sourceEdges.has(edge.target)) {
            sourceEdges.set(edge.target, []);
        }
        sourceEdges.get(edge.target).push(edge);
    }
    /**
     * Find shortest path using Dijkstra's algorithm
     * O((V + E) log V) with binary heap
     */
    shortestPath(start, end, options = {}) {
        const { maxDepth = Infinity, relationshipTypes, edgeFilter } = options;
        // Priority queue: [nodeId, distance, path]
        const pq = [[start, 0, [start], []]];
        const visited = new Set();
        const distances = new Map([[start, 0]]);
        while (pq.length > 0) {
            // Sort by distance (simple array, could optimize with heap)
            pq.sort((a, b) => a[1] - b[1]);
            const [current, distance, path, edges] = pq.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            // Found target
            if (current === end) {
                return {
                    nodes: path,
                    edges,
                    totalWeight: distance,
                    length: path.length - 1
                };
            }
            // Max depth reached
            if (path.length > maxDepth)
                continue;
            // Explore neighbors
            const neighbors = this.adjacencyList.get(current);
            if (!neighbors)
                continue;
            for (const [neighbor, edgeList] of neighbors) {
                if (visited.has(neighbor))
                    continue;
                // Find best edge to neighbor
                let bestEdge = null;
                let bestWeight = Infinity;
                for (const edge of edgeList) {
                    // Apply filters
                    if (relationshipTypes && !relationshipTypes.includes(edge.type))
                        continue;
                    if (edgeFilter && !edgeFilter(edge))
                        continue;
                    if (edge.weight < bestWeight) {
                        bestWeight = edge.weight;
                        bestEdge = edge;
                    }
                }
                if (!bestEdge)
                    continue;
                const newDistance = distance + bestWeight;
                const currentBest = distances.get(neighbor) ?? Infinity;
                if (newDistance < currentBest) {
                    distances.set(neighbor, newDistance);
                    pq.push([
                        neighbor,
                        newDistance,
                        [...path, neighbor],
                        [...edges, bestEdge]
                    ]);
                }
            }
        }
        return null; // No path found
    }
    /**
     * Find all paths between two nodes
     * Uses DFS with cycle detection
     */
    allPaths(start, end, options = {}) {
        const { maxDepth = 10, maxPaths = 100, relationshipTypes, edgeFilter } = options;
        const paths = [];
        const visited = new Set();
        const dfs = (current, path, edges, weight) => {
            if (paths.length >= maxPaths)
                return;
            if (path.length > maxDepth)
                return;
            if (current === end && path.length > 1) {
                paths.push({
                    nodes: [...path],
                    edges: [...edges],
                    totalWeight: weight,
                    length: path.length - 1
                });
                return;
            }
            visited.add(current);
            const neighbors = this.adjacencyList.get(current);
            if (neighbors) {
                for (const [neighbor, edgeList] of neighbors) {
                    if (visited.has(neighbor))
                        continue;
                    for (const edge of edgeList) {
                        // Apply filters
                        if (relationshipTypes && !relationshipTypes.includes(edge.type))
                            continue;
                        if (edgeFilter && !edgeFilter(edge))
                            continue;
                        dfs(neighbor, [...path, neighbor], [...edges, edge], weight + edge.weight);
                    }
                }
            }
            visited.delete(current);
        };
        dfs(start, [start], [], 0);
        // Sort paths by weight
        paths.sort((a, b) => a.totalWeight - b.totalWeight);
        return paths;
    }
    /**
     * Bidirectional search for faster pathfinding
     * Searches from both start and end simultaneously
     */
    bidirectionalSearch(start, end, options = {}) {
        const { maxDepth = 10 } = options;
        // Two search frontiers
        const forwardVisited = new Map();
        const backwardVisited = new Map();
        forwardVisited.set(start, { path: [start], edges: [], weight: 0 });
        backwardVisited.set(end, { path: [end], edges: [], weight: 0 });
        const forwardQueue = [start];
        const backwardQueue = [end];
        let depth = 0;
        while ((forwardQueue.length > 0 || backwardQueue.length > 0) &&
            depth < maxDepth) {
            // Expand forward frontier
            const forwardNext = [];
            for (const current of forwardQueue) {
                const currentData = forwardVisited.get(current);
                const neighbors = this.adjacencyList.get(current);
                if (neighbors) {
                    for (const [neighbor, edges] of neighbors) {
                        if (forwardVisited.has(neighbor))
                            continue;
                        // Select edge with lowest weight for optimal path
                        const bestEdge = edges.reduce((best, edge) => edge.weight < best.weight ? edge : best, edges[0]);
                        forwardVisited.set(neighbor, {
                            path: [...currentData.path, neighbor],
                            edges: [...currentData.edges, bestEdge],
                            weight: currentData.weight + bestEdge.weight
                        });
                        // Check if we met the backward search
                        if (backwardVisited.has(neighbor)) {
                            const forward = forwardVisited.get(neighbor);
                            const backward = backwardVisited.get(neighbor);
                            // Combine paths
                            const fullPath = [
                                ...forward.path,
                                ...backward.path.slice(1).reverse()
                            ];
                            // Reverse backward edges and combine
                            const backwardEdgesReversed = backward.edges
                                .map(e => ({
                                ...e,
                                source: e.target,
                                target: e.source
                            }))
                                .reverse();
                            return {
                                nodes: fullPath,
                                edges: [...forward.edges, ...backwardEdgesReversed],
                                totalWeight: forward.weight + backward.weight,
                                length: fullPath.length - 1
                            };
                        }
                        forwardNext.push(neighbor);
                    }
                }
            }
            // Expand backward frontier
            const backwardNext = [];
            for (const current of backwardQueue) {
                const currentData = backwardVisited.get(current);
                // For backward search, we need to look at incoming edges
                for (const [nodeId, neighbors] of this.adjacencyList) {
                    const edges = neighbors.get(current);
                    if (!edges)
                        continue;
                    if (backwardVisited.has(nodeId))
                        continue;
                    // Select edge with lowest weight for optimal path
                    const bestEdge = edges.reduce((best, edge) => edge.weight < best.weight ? edge : best, edges[0]);
                    backwardVisited.set(nodeId, {
                        path: [...currentData.path, nodeId],
                        edges: [...currentData.edges, bestEdge],
                        weight: currentData.weight + bestEdge.weight
                    });
                    // Check if we met the forward search
                    if (forwardVisited.has(nodeId)) {
                        const forward = forwardVisited.get(nodeId);
                        const backward = backwardVisited.get(nodeId);
                        // Combine paths
                        const fullPath = [
                            ...forward.path,
                            ...backward.path.slice(1).reverse()
                        ];
                        // Reverse backward edges and combine
                        const backwardEdgesReversed = backward.edges
                            .map(e => ({
                            ...e,
                            source: e.target,
                            target: e.source
                        }))
                            .reverse();
                        return {
                            nodes: fullPath,
                            edges: [...forward.edges, ...backwardEdgesReversed],
                            totalWeight: forward.weight + backward.weight,
                            length: fullPath.length - 1
                        };
                    }
                    backwardNext.push(nodeId);
                }
            }
            forwardQueue.splice(0, forwardQueue.length, ...forwardNext);
            backwardQueue.splice(0, backwardQueue.length, ...backwardNext);
            depth++;
        }
        return null;
    }
    /**
     * Multi-hop traversal (e.g., friends of friends)
     * Returns all nodes within N hops
     */
    multiHopTraversal(start, hops, options = {}) {
        const { relationshipTypes, nodeFilter, edgeFilter } = options;
        const results = new Map();
        const visited = new Set();
        const queue = [
            { node: start, distance: 0, path: [start], edges: [] }
        ];
        while (queue.length > 0) {
            const { node, distance, path, edges } = queue.shift();
            if (distance > hops)
                continue;
            // Record this node
            if (!results.has(node)) {
                results.set(node, { distance, paths: [] });
            }
            results.get(node).paths.push({
                nodes: path,
                edges,
                totalWeight: edges.reduce((sum, e) => sum + e.weight, 0),
                length: path.length - 1
            });
            if (distance === hops)
                continue;
            // Explore neighbors
            const neighbors = this.adjacencyList.get(node);
            if (neighbors) {
                for (const [neighbor, edgeList] of neighbors) {
                    // Apply node filter
                    if (nodeFilter) {
                        const neighborNode = this.nodes.get(neighbor);
                        if (neighborNode && !nodeFilter(neighborNode))
                            continue;
                    }
                    for (const edge of edgeList) {
                        // Apply filters
                        if (relationshipTypes && !relationshipTypes.includes(edge.type))
                            continue;
                        if (edgeFilter && !edgeFilter(edge))
                            continue;
                        queue.push({
                            node: neighbor,
                            distance: distance + 1,
                            path: [...path, neighbor],
                            edges: [...edges, edge]
                        });
                    }
                }
            }
        }
        return results;
    }
    /**
     * Find connected components using DFS
     */
    connectedComponents() {
        const visited = new Set();
        const components = [];
        const dfs = (node, component) => {
            visited.add(node);
            component.add(node);
            const neighbors = this.adjacencyList.get(node);
            if (neighbors) {
                for (const neighbor of neighbors.keys()) {
                    if (!visited.has(neighbor)) {
                        dfs(neighbor, component);
                    }
                }
            }
        };
        for (const node of this.adjacencyList.keys()) {
            if (!visited.has(node)) {
                const component = new Set();
                dfs(node, component);
                components.push(component);
            }
        }
        return components;
    }
    /**
     * Calculate PageRank for all nodes
     * Useful for ranking importance in the graph
     */
    pageRank(iterations = 100, damping = 0.85) {
        const nodes = Array.from(this.adjacencyList.keys());
        const n = nodes.length;
        if (n === 0)
            return new Map();
        // Initialize ranks
        const ranks = new Map();
        for (const node of nodes) {
            ranks.set(node, 1 / n);
        }
        // Calculate outgoing edge counts
        const outDegree = new Map();
        for (const [node, neighbors] of this.adjacencyList) {
            let count = 0;
            for (const edges of neighbors.values()) {
                count += edges.length;
            }
            outDegree.set(node, count);
        }
        // Iterate PageRank algorithm
        for (let i = 0; i < iterations; i++) {
            const newRanks = new Map();
            for (const node of nodes) {
                let rank = (1 - damping) / n;
                // Sum contributions from incoming edges
                for (const [source, neighbors] of this.adjacencyList) {
                    if (neighbors.has(node)) {
                        const sourceRank = ranks.get(source) ?? 0;
                        const sourceOutDegree = outDegree.get(source) ?? 1;
                        rank += damping * (sourceRank / sourceOutDegree);
                    }
                }
                newRanks.set(node, rank);
            }
            // Update ranks
            for (const [node, rank] of newRanks) {
                ranks.set(node, rank);
            }
        }
        return ranks;
    }
    /**
     * Clear the graph
     */
    clear() {
        this.adjacencyList.clear();
        this.nodes.clear();
    }
}
//# sourceMappingURL=pathfinding.js.map