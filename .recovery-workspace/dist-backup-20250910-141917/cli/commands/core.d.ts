/**
 * Core CLI Commands - TypeScript Implementation
 *
 * Essential database operations: add, search, get, relate, import, export
 */
interface CoreOptions {
    verbose?: boolean;
    json?: boolean;
    pretty?: boolean;
}
interface AddOptions extends CoreOptions {
    id?: string;
    metadata?: string;
    type?: string;
}
interface SearchOptions extends CoreOptions {
    limit?: string;
    threshold?: string;
    metadata?: string;
}
interface GetOptions extends CoreOptions {
    withConnections?: boolean;
}
interface RelateOptions extends CoreOptions {
    weight?: string;
    metadata?: string;
}
interface ImportOptions extends CoreOptions {
    format?: 'json' | 'csv' | 'jsonl';
    batchSize?: string;
}
interface ExportOptions extends CoreOptions {
    format?: 'json' | 'csv' | 'jsonl';
}
export declare const coreCommands: {
    /**
     * Add data to the neural database
     */
    add(text: string, options: AddOptions): Promise<void>;
    /**
     * Search the neural database
     */
    search(query: string, options: SearchOptions): Promise<void>;
    /**
     * Get item by ID
     */
    get(id: string, options: GetOptions): Promise<void>;
    /**
     * Create relationship between items
     */
    relate(source: string, verb: string, target: string, options: RelateOptions): Promise<void>;
    /**
     * Import data from file
     */
    import(file: string, options: ImportOptions): Promise<void>;
    /**
     * Export database
     */
    export(file: string | undefined, options: ExportOptions): Promise<void>;
};
export {};
