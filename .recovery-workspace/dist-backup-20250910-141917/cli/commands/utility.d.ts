/**
 * Utility CLI Commands - TypeScript Implementation
 *
 * Database maintenance, statistics, and benchmarking
 */
interface UtilityOptions {
    verbose?: boolean;
    json?: boolean;
    pretty?: boolean;
}
interface StatsOptions extends UtilityOptions {
    byService?: boolean;
    detailed?: boolean;
}
interface CleanOptions extends UtilityOptions {
    removeOrphans?: boolean;
    rebuildIndex?: boolean;
}
interface BenchmarkOptions extends UtilityOptions {
    operations?: string;
    iterations?: string;
}
export declare const utilityCommands: {
    /**
     * Show database statistics
     */
    stats(options: StatsOptions): Promise<void>;
    /**
     * Clean and optimize database
     */
    clean(options: CleanOptions): Promise<void>;
    /**
     * Run performance benchmarks
     */
    benchmark(options: BenchmarkOptions): Promise<void>;
};
export {};
