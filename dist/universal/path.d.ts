/**
 * Universal Path implementation
 * Browser: Manual path operations
 * Node.js: Uses built-in path module
 */
/**
 * Universal path operations
 */
export declare function join(...paths: string[]): string;
export declare function dirname(path: string): string;
export declare function basename(path: string, ext?: string): string;
export declare function extname(path: string): string;
export declare function resolve(...paths: string[]): string;
export declare function relative(from: string, to: string): string;
export declare function isAbsolute(path: string): boolean;
export declare const sep = "/";
export declare const delimiter = ":";
export declare const posix: {
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
    extname: typeof extname;
    resolve: typeof resolve;
    relative: typeof relative;
    isAbsolute: typeof isAbsolute;
    sep: string;
    delimiter: string;
};
declare const _default: {
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
    extname: typeof extname;
    resolve: typeof resolve;
    relative: typeof relative;
    isAbsolute: typeof isAbsolute;
    sep: string;
    delimiter: string;
    posix: {
        join: typeof join;
        dirname: typeof dirname;
        basename: typeof basename;
        extname: typeof extname;
        resolve: typeof resolve;
        relative: typeof relative;
        isAbsolute: typeof isAbsolute;
        sep: string;
        delimiter: string;
    };
};
export default _default;
