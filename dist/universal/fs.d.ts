/**
 * Universal File System implementation
 * Browser: Uses OPFS (Origin Private File System)
 * Node.js: Uses built-in fs/promises
 * Serverless: Uses memory-based fallback
 */
/**
 * Universal file operations interface
 */
export interface UniversalFS {
    readFile(path: string, encoding?: string): Promise<string>;
    writeFile(path: string, data: string, encoding?: string): Promise<void>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    exists(path: string): Promise<boolean>;
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: {
        withFileTypes: true;
    }): Promise<{
        name: string;
        isDirectory(): boolean;
        isFile(): boolean;
    }[]>;
    unlink(path: string): Promise<void>;
    stat(path: string): Promise<{
        isFile(): boolean;
        isDirectory(): boolean;
    }>;
    access(path: string, mode?: number): Promise<void>;
}
export declare const readFile: (path: string, encoding?: string) => Promise<string>;
export declare const writeFile: (path: string, data: string, encoding?: string) => Promise<void>;
export declare const mkdir: (path: string, options?: {
    recursive?: boolean;
}) => Promise<void>;
export declare const exists: (path: string) => Promise<boolean>;
export declare const readdir: {
    (path: string): Promise<string[]>;
    (path: string, options: {
        withFileTypes: true;
    }): Promise<{
        name: string;
        isDirectory(): boolean;
        isFile(): boolean;
    }[]>;
};
export declare const unlink: (path: string) => Promise<void>;
export declare const stat: (path: string) => Promise<{
    isFile(): boolean;
    isDirectory(): boolean;
}>;
export declare const access: (path: string, mode?: number) => Promise<void>;
declare const _default: {
    readFile: (path: string, encoding?: string) => Promise<string>;
    writeFile: (path: string, data: string, encoding?: string) => Promise<void>;
    mkdir: (path: string, options?: {
        recursive?: boolean;
    }) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    readdir: {
        (path: string): Promise<string[]>;
        (path: string, options: {
            withFileTypes: true;
        }): Promise<{
            name: string;
            isDirectory(): boolean;
            isFile(): boolean;
        }[]>;
    };
    unlink: (path: string) => Promise<void>;
    stat: (path: string) => Promise<{
        isFile(): boolean;
        isDirectory(): boolean;
    }>;
    access: (path: string, mode?: number) => Promise<void>;
};
export default _default;
export declare const promises: {
    readFile: (path: string, encoding?: string) => Promise<string>;
    writeFile: (path: string, data: string, encoding?: string) => Promise<void>;
    mkdir: (path: string, options?: {
        recursive?: boolean;
    }) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    readdir: {
        (path: string): Promise<string[]>;
        (path: string, options: {
            withFileTypes: true;
        }): Promise<{
            name: string;
            isDirectory(): boolean;
            isFile(): boolean;
        }[]>;
    };
    unlink: (path: string) => Promise<void>;
    stat: (path: string) => Promise<{
        isFile(): boolean;
        isDirectory(): boolean;
    }>;
    access: (path: string, mode?: number) => Promise<void>;
};
