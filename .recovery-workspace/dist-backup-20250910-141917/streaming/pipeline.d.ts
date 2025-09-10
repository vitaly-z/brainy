/**
 * Streaming Pipeline System for Brainy
 *
 * Real implementation of streaming data pipelines with:
 * - Async iterators for streaming
 * - Backpressure handling
 * - Auto-scaling workers
 * - Checkpointing for recovery
 * - Error boundaries
 */
import { Brainy } from '../brainy.js';
/**
 * Pipeline stage types
 */
export type StageType = 'source' | 'transform' | 'filter' | 'batch' | 'sink' | 'branch' | 'merge' | 'window' | 'reduce';
/**
 * Pipeline execution options
 */
export interface PipelineOptions {
    workers?: number | 'auto';
    checkpoint?: boolean | string;
    monitoring?: boolean;
    maxThroughput?: number;
    backpressure?: 'drop' | 'buffer' | 'pause';
    retries?: number;
    errorHandler?: (error: Error, item: any) => void;
    bufferSize?: number;
}
/**
 * Base interface for pipeline stages
 */
export interface PipelineStage<T = any, R = any> {
    type: StageType;
    name: string;
    process(input: AsyncIterable<T>): AsyncIterable<R>;
}
/**
 * Streaming Pipeline Builder
 */
export declare class Pipeline<T = any> {
    private brainyInstance?;
    private stages;
    private running;
    private abortController?;
    private metrics;
    constructor(brainyInstance?: Brainy | Brainy<any>);
    /**
     * Add a data source
     */
    source<S>(generator: AsyncIterable<S> | (() => AsyncIterable<S>) | AsyncGeneratorFunction): Pipeline<S>;
    /**
     * Transform data
     */
    map<R>(fn: (item: T) => R | Promise<R>): Pipeline<R>;
    /**
     * Filter data
     */
    filter(predicate: (item: T) => boolean | Promise<boolean>): Pipeline<T>;
    /**
     * Batch items for efficiency
     */
    batch(size: number, timeoutMs?: number): Pipeline<T[]>;
    /**
     * Sink data to a destination
     */
    sink(handler: (item: T) => Promise<void> | void): Pipeline<void>;
    /**
     * Sink data to Brainy
     */
    toBrainy(options?: {
        type?: string;
        metadata?: any;
        batchSize?: number;
    }): Pipeline<void>;
    /**
     * Sink with rate limiting
     */
    throttledSink(handler: (item: T) => Promise<void> | void, rateLimit: number): Pipeline<void>;
    /**
     * Parallel sink with worker pool
     */
    parallelSink(handler: (item: T) => Promise<void> | void, workers?: number): Pipeline<void>;
    /**
     * Collect all results
     */
    collect(): Promise<T[]>;
    /**
     * Window operations for time-based processing
     */
    window(size: number, type?: 'tumbling' | 'sliding'): Pipeline<T[]>;
    /**
     * Flatmap operation - map and flatten results
     */
    flatMap<R>(fn: (item: T) => R[] | Promise<R[]>): Pipeline<R>;
    /**
     * Tap into the pipeline for side effects without modifying data
     */
    tap(fn: (item: T) => void | Promise<void>): Pipeline<T>;
    /**
     * Retry failed operations
     */
    retry<R>(fn: (item: T) => R | Promise<R>, maxRetries?: number, backoff?: number): Pipeline<R>;
    /**
     * Buffer with backpressure handling
     */
    buffer(size: number, strategy?: 'drop' | 'block'): Pipeline<T>;
    /**
     * Fork the pipeline into multiple branches
     */
    fork(...branches: Array<(pipeline: Pipeline<T>) => Pipeline<any>>): Pipeline<T>;
    /**
     * Reduce operation
     */
    reduce<R>(reducer: (acc: R, item: T) => R, initial: R): Pipeline<R>;
    /**
     * Run the pipeline with metrics tracking
     */
    run(options?: PipelineOptions): Promise<void>;
    /**
     * Start the pipeline (alias for run)
     */
    start(options?: PipelineOptions): Promise<void>;
    /**
     * Stop the pipeline
     */
    stop(): void;
    /**
     * Monitor pipeline metrics
     */
    monitor(dashboard?: string): Pipeline<T>;
}
/**
 * Pipeline factory function
 */
export declare function createPipeline(brain?: Brainy): Pipeline;
/**
 * Backward compatibility exports
 */
export declare const pipeline: Pipeline<any>;
export declare enum ExecutionMode {
    SEQUENTIAL = "sequential",
    PARALLEL = "parallel",
    FIRST_SUCCESS = "firstSuccess",
    FIRST_RESULT = "firstResult",
    THREADED = "threaded"
}
export type PipelineResult<T> = {
    success: boolean;
    data: T;
    error?: string;
};
export type StreamlinedPipelineOptions = PipelineOptions;
export type StreamlinedPipelineResult<T> = PipelineResult<T>;
export { ExecutionMode as StreamlinedExecutionMode };
