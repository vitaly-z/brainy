/**
 * 🧠 Brainy 3.0 - The Future of Neural Databases
 *
 * Beautiful, Professional, Planet-Scale, Fun to Use
 * NO STUBS, NO MOCKS, REAL IMPLEMENTATION
 */
import { ImprovedNeuralAPI } from './neural/improvedNeuralAPI.js';
import { Entity, Relation, Result, AddParams, UpdateParams, RelateParams, FindParams, SimilarParams, GetRelationsParams, AddManyParams, DeleteManyParams, BatchResult, BrainyConfig } from './types/brainy.types.js';
/**
 * The main Brainy class - Clean, Beautiful, Powerful
 * REAL IMPLEMENTATION - No stubs, no mocks
 */
export declare class Brainy<T = any> {
    private index;
    private storage;
    private embedder;
    private distance;
    private augmentationRegistry;
    private config;
    private _neural?;
    private _nlp?;
    private initialized;
    private dimensions?;
    constructor(config?: BrainyConfig);
    /**
     * Initialize Brainy - MUST be called before use
     */
    init(): Promise<void>;
    /**
     * Ensure Brainy is initialized
     */
    private ensureInitialized;
    /**
     * Add an entity to the database
     */
    add(params: AddParams<T>): Promise<string>;
    /**
     * Get an entity by ID
     */
    get(id: string): Promise<Entity<T> | null>;
    /**
     * Update an entity
     */
    update(params: UpdateParams<T>): Promise<void>;
    /**
     * Delete an entity
     */
    delete(id: string): Promise<void>;
    /**
     * Create a relationship between entities
     */
    relate(params: RelateParams<T>): Promise<string>;
    /**
     * Delete a relationship
     */
    unrelate(id: string): Promise<void>;
    /**
     * Get relationships
     */
    getRelations(params?: GetRelationsParams): Promise<Relation<T>[]>;
    /**
     * Unified find method - supports natural language and structured queries
     */
    find(query: string | FindParams<T>): Promise<Result<T>[]>;
    /**
     * Find similar entities
     */
    similar(params: SimilarParams<T>): Promise<Result<T>[]>;
    /**
     * Add multiple entities
     */
    addMany(params: AddManyParams<T>): Promise<BatchResult<string>>;
    /**
     * Delete multiple entities
     */
    deleteMany(params: DeleteManyParams): Promise<BatchResult<string>>;
    /**
     * Neural API - Advanced AI operations
     */
    neural(): ImprovedNeuralAPI;
}
export * from './types/brainy.types.js';
export { NounType, VerbType } from './types/graphTypes.js';
