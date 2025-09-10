/**
 * 🧠 Brainy 3.0 Type Definitions
 *
 * Beautiful, consistent, type-safe interfaces for the future of neural databases
 */
import { Vector } from '../coreTypes.js';
import { NounType, VerbType } from './graphTypes.js';
/**
 * Entity representation (replaces GraphNoun)
 */
export interface Entity<T = any> {
    id: string;
    vector: Vector;
    type: NounType;
    metadata?: T;
    service?: string;
    createdAt: number;
    updatedAt?: number;
    createdBy?: string;
}
/**
 * Relation representation (replaces GraphVerb)
 */
export interface Relation<T = any> {
    id: string;
    from: string;
    to: string;
    type: VerbType;
    weight?: number;
    metadata?: T;
    service?: string;
    createdAt: number;
    updatedAt?: number;
}
/**
 * Search result with similarity score
 */
export interface Result<T = any> {
    id: string;
    score: number;
    entity: Entity<T>;
    explanation?: ScoreExplanation;
}
/**
 * Score explanation for transparency
 */
export interface ScoreExplanation {
    vectorScore?: number;
    metadataScore?: number;
    graphScore?: number;
    boosts?: Record<string, number>;
    penalties?: Record<string, number>;
}
/**
 * Parameters for adding entities
 */
export interface AddParams<T = any> {
    data: any | Vector;
    type: NounType;
    metadata?: T;
    id?: string;
    vector?: Vector;
    service?: string;
}
/**
 * Parameters for updating entities
 */
export interface UpdateParams<T = any> {
    id: string;
    data?: any;
    type?: NounType;
    metadata?: Partial<T>;
    merge?: boolean;
    vector?: Vector;
}
/**
 * Parameters for creating relationships
 */
export interface RelateParams<T = any> {
    from: string;
    to: string;
    type: VerbType;
    weight?: number;
    metadata?: T;
    bidirectional?: boolean;
    service?: string;
}
/**
 * Parameters for updating relationships
 */
export interface UpdateRelationParams<T = any> {
    id: string;
    weight?: number;
    metadata?: Partial<T>;
    merge?: boolean;
}
/**
 * Unified find parameters - Triple Intelligence
 */
export interface FindParams<T = any> {
    query?: string;
    vector?: Vector;
    type?: NounType | NounType[];
    where?: Partial<T>;
    connected?: GraphConstraints;
    near?: {
        id: string;
        threshold?: number;
    };
    limit?: number;
    offset?: number;
    cursor?: string;
    mode?: SearchMode;
    explain?: boolean;
    includeRelations?: boolean;
    service?: string;
    fusion?: {
        strategy?: 'adaptive' | 'weighted' | 'progressive';
        weights?: {
            vector?: number;
            graph?: number;
            field?: number;
        };
    };
    writeOnly?: boolean;
}
/**
 * Graph constraints for search
 */
export interface GraphConstraints {
    to?: string;
    from?: string;
    via?: VerbType | VerbType[];
    depth?: number;
    bidirectional?: boolean;
}
/**
 * Search modes
 */
export type SearchMode = 'auto' | 'vector' | 'metadata' | 'graph' | 'hybrid';
/**
 * Parameters for similarity search
 */
export interface SimilarParams<T = any> {
    to: string | Entity<T> | Vector;
    limit?: number;
    threshold?: number;
    type?: NounType | NounType[];
    where?: Partial<T>;
    service?: string;
}
/**
 * Parameters for getting relationships
 */
export interface GetRelationsParams {
    from?: string;
    to?: string;
    type?: VerbType | VerbType[];
    limit?: number;
    offset?: number;
    cursor?: string;
    service?: string;
}
/**
 * Batch add parameters
 */
export interface AddManyParams<T = any> {
    items: AddParams<T>[];
    parallel?: boolean;
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    continueOnError?: boolean;
}
/**
 * Batch update parameters
 */
export interface UpdateManyParams<T = any> {
    items: UpdateParams<T>[];
    parallel?: boolean;
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    continueOnError?: boolean;
}
/**
 * Batch delete parameters
 */
export interface DeleteManyParams {
    ids?: string[];
    type?: NounType;
    where?: any;
    limit?: number;
    onProgress?: (done: number, total: number) => void;
}
/**
 * Batch relate parameters
 */
export interface RelateManyParams<T = any> {
    items: RelateParams<T>[];
    parallel?: boolean;
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    continueOnError?: boolean;
}
/**
 * Batch result
 */
export interface BatchResult<T = any> {
    successful: T[];
    failed: Array<{
        item: any;
        error: string;
    }>;
    total: number;
    duration: number;
}
/**
 * Graph traversal parameters
 */
export interface TraverseParams {
    from: string | string[];
    direction?: 'out' | 'in' | 'both';
    types?: VerbType[];
    depth?: number;
    strategy?: 'bfs' | 'dfs';
    filter?: (entity: Entity, depth: number, path: string[]) => boolean;
    limit?: number;
}
/**
 * Aggregation parameters
 */
export interface AggregateParams<T = any> {
    query?: FindParams<T>;
    groupBy: string | string[];
    metrics: AggregateMetric[];
    having?: any;
    orderBy?: string;
    limit?: number;
}
/**
 * Aggregate metrics
 */
export type AggregateMetric = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'stddev' | {
    custom: string;
    field: string;
};
/**
 * Brainy configuration
 */
export interface BrainyConfig {
    storage?: {
        type: 'memory' | 'filesystem' | 's3' | 'r2' | 'opfs';
        options?: any;
    };
    model?: {
        type: 'fast' | 'accurate' | 'balanced' | 'custom';
        name?: string;
        precision?: 'fp32' | 'fp16' | 'q8' | 'q4';
    };
    index?: {
        m?: number;
        efConstruction?: number;
        efSearch?: number;
    };
    cache?: boolean | {
        maxSize?: number;
        ttl?: number;
    };
    augmentations?: Record<string, any>;
    warmup?: boolean;
    realtime?: boolean;
    multiTenancy?: boolean;
    telemetry?: boolean;
}
/**
 * Neural similarity parameters
 */
export interface NeuralSimilarityParams {
    between?: [any, any];
    items?: any[];
    explain?: boolean;
}
/**
 * Neural clustering parameters
 */
export interface NeuralClusterParams {
    items?: string[] | Entity[];
    algorithm?: 'hierarchical' | 'kmeans' | 'dbscan' | 'spectral';
    params?: {
        k?: number;
        threshold?: number;
        epsilon?: number;
        minPoints?: number;
    };
    visualize?: boolean;
}
/**
 * Neural anomaly detection parameters
 */
export interface NeuralAnomalyParams {
    threshold?: number;
    type?: NounType;
    method?: 'isolation' | 'lof' | 'statistical' | 'autoencoder';
    returnScores?: boolean;
}
export * from './graphTypes.js';
