/**
 * Read-Only Storage Optimizations for Production Deployments
 * Implements compression, memory-mapping, and pre-built index segments
 */
import { HNSWNoun, Vector } from '../coreTypes.js';
declare enum CompressionType {
    NONE = "none",
    GZIP = "gzip",
    BROTLI = "brotli",
    QUANTIZATION = "quantization",
    HYBRID = "hybrid"
}
declare enum QuantizationType {
    SCALAR = "scalar",// 8-bit scalar quantization
    PRODUCT = "product",// Product quantization
    BINARY = "binary"
}
interface CompressionConfig {
    vectorCompression: CompressionType;
    metadataCompression: CompressionType;
    quantizationType?: QuantizationType;
    quantizationBits?: number;
    compressionLevel?: number;
}
interface ReadOnlyConfig {
    prebuiltIndexPath?: string;
    memoryMapped?: boolean;
    compression: CompressionConfig;
    segmentSize?: number;
    prefetchSegments?: number;
    cacheIndexInMemory?: boolean;
}
interface IndexSegment {
    id: string;
    nodeCount: number;
    vectorDimension: number;
    compression: CompressionType;
    s3Key?: string;
    localPath?: string;
    loadedInMemory: boolean;
    lastAccessed: number;
}
/**
 * Read-only storage optimizations for high-performance production deployments
 */
export declare class ReadOnlyOptimizations {
    private config;
    private segments;
    private compressionStats;
    private quantizationCodebooks;
    private memoryMappedBuffers;
    constructor(config?: Partial<ReadOnlyConfig>);
    /**
     * Compress vector data using specified compression method
     */
    compressVector(vector: Vector, segmentId: string): Promise<ArrayBuffer>;
    /**
     * Decompress vector data
     */
    decompressVector(compressedData: ArrayBuffer, segmentId: string, originalDimension: number): Promise<Vector>;
    /**
     * Scalar quantization of vectors to 8-bit integers
     */
    private quantizeVector;
    /**
     * Dequantize 8-bit vectors back to float32
     */
    private dequantizeVector;
    /**
     * GZIP compression using browser/Node.js APIs
     */
    private gzipCompress;
    /**
     * GZIP decompression
     */
    private gzipDecompress;
    /**
     * Brotli compression (placeholder - similar to GZIP)
     */
    private brotliCompress;
    /**
     * Brotli decompression (placeholder)
     */
    private brotliDecompress;
    /**
     * Create prebuilt index segments for faster loading
     */
    createPrebuiltSegments(nodes: HNSWNoun[], outputPath: string): Promise<IndexSegment[]>;
    /**
     * Compress an entire segment of nodes
     */
    private compressSegment;
    /**
     * Load a segment from storage with caching
     */
    loadSegment(segmentId: string): Promise<HNSWNoun[]>;
    /**
     * Load segment data from storage
     */
    private loadSegmentFromStorage;
    /**
     * Deserialize and decompress segment data
     */
    private deserializeSegment;
    /**
     * Serialize connections Map for storage
     */
    private serializeConnections;
    /**
     * Deserialize connections from storage format
     */
    private deserializeConnections;
    /**
     * Prefetch segments based on access patterns
     */
    prefetchSegments(currentSegmentId: string): Promise<void>;
    /**
     * Update compression statistics
     */
    private updateCompressionRatio;
    /**
     * Get compression statistics
     */
    getCompressionStats(): typeof this.compressionStats & {
        segmentCount: number;
        memoryUsage: number;
    };
    /**
     * Cleanup memory-mapped buffers
     */
    cleanup(): void;
}
export {};
