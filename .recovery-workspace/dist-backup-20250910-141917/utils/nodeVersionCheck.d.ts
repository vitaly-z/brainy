/**
 * Node.js Version Compatibility Check
 *
 * Brainy requires Node.js 22.x LTS for maximum stability with ONNX Runtime.
 * This prevents V8 HandleScope locking issues in worker threads.
 */
export interface VersionInfo {
    current: string;
    major: number;
    isSupported: boolean;
    recommendation: string;
}
/**
 * Check if the current Node.js version is supported
 */
export declare function checkNodeVersion(): VersionInfo;
/**
 * Enforce Node.js version requirement with helpful error messaging
 */
export declare function enforceNodeVersion(): void;
/**
 * Soft warning for version issues (non-blocking)
 */
export declare function warnNodeVersion(): boolean;
