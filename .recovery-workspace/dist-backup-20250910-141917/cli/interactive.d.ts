/**
 * Professional Interactive CLI System
 *
 * Provides consistent, delightful interactive prompts for all commands
 * with smart defaults, validation, and helpful examples
 */
import { BrainyData } from '../brainyData.js';
export declare const colors: {
    primary: import("chalk").ChalkInstance;
    success: import("chalk").ChalkInstance;
    info: import("chalk").ChalkInstance;
    warning: import("chalk").ChalkInstance;
    error: import("chalk").ChalkInstance;
    brain: import("chalk").ChalkInstance;
    cream: import("chalk").ChalkInstance;
    dim: import("chalk").ChalkInstance;
    bold: import("chalk").ChalkInstance;
    cyan: import("chalk").ChalkInstance;
    green: import("chalk").ChalkInstance;
    yellow: import("chalk").ChalkInstance;
    red: import("chalk").ChalkInstance;
};
export declare const icons: {
    brain: string;
    search: string;
    add: string;
    delete: string;
    update: string;
    import: string;
    export: string;
    connect: string;
    question: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    sparkle: string;
    rocket: string;
    thinking: string;
    chat: string;
};
/**
 * Professional prompt wrapper with consistent styling
 */
export declare function prompt(config: any): Promise<any>;
/**
 * Interactive prompt for search query with smart features
 */
export declare function promptSearchQuery(previousSearches?: string[]): Promise<string>;
/**
 * Interactive prompt for item ID with fuzzy search
 */
export declare function promptItemId(action: string, brain?: BrainyData, allowMultiple?: boolean): Promise<string | string[]>;
/**
 * Confirm destructive action with preview
 */
export declare function confirmDestructiveAction(action: string, items: any[], showPreview?: boolean): Promise<boolean>;
/**
 * Interactive data input with multiline support
 */
export declare function promptDataInput(action?: string, currentValue?: string): Promise<string>;
/**
 * Interactive metadata input with JSON validation
 */
export declare function promptMetadata(currentMetadata?: any, suggestions?: string[]): Promise<any>;
/**
 * Interactive format selector
 */
export declare function promptFormat(availableFormats: string[], defaultFormat: string): Promise<string>;
/**
 * Interactive file/URL input with validation
 */
export declare function promptFileOrUrl(action?: string): Promise<string>;
/**
 * Interactive relationship builder
 */
export declare function promptRelationship(brain?: BrainyData): Promise<{
    source: string;
    verb: string;
    target: string;
    metadata?: any;
}>;
/**
 * Smart command suggestions when user types wrong command
 */
export declare function suggestCommand(input: string, availableCommands: string[]): string[];
/**
 * Beautiful error display with helpful context
 */
export declare function showError(error: Error, context?: string): void;
/**
 * Progress indicator for long operations
 */
export declare class ProgressTracker {
    private spinner;
    private startTime;
    constructor(message: string);
    update(message: string, count?: number, total?: number): void;
    succeed(message?: string): void;
    fail(message?: string): void;
    stop(): void;
}
/**
 * Welcome message for interactive mode
 */
export declare function showWelcome(): void;
/**
 * Interactive command selector for beginners
 */
export declare function promptCommand(): Promise<string>;
/**
 * Export all interactive components
 */
declare const _default: {
    colors: {
        primary: import("chalk").ChalkInstance;
        success: import("chalk").ChalkInstance;
        info: import("chalk").ChalkInstance;
        warning: import("chalk").ChalkInstance;
        error: import("chalk").ChalkInstance;
        brain: import("chalk").ChalkInstance;
        cream: import("chalk").ChalkInstance;
        dim: import("chalk").ChalkInstance;
        bold: import("chalk").ChalkInstance;
        cyan: import("chalk").ChalkInstance;
        green: import("chalk").ChalkInstance;
        yellow: import("chalk").ChalkInstance;
        red: import("chalk").ChalkInstance;
    };
    icons: {
        brain: string;
        search: string;
        add: string;
        delete: string;
        update: string;
        import: string;
        export: string;
        connect: string;
        question: string;
        success: string;
        error: string;
        warning: string;
        info: string;
        sparkle: string;
        rocket: string;
        thinking: string;
        chat: string;
    };
    prompt: typeof prompt;
    promptSearchQuery: typeof promptSearchQuery;
    promptItemId: typeof promptItemId;
    confirmDestructiveAction: typeof confirmDestructiveAction;
    promptDataInput: typeof promptDataInput;
    promptMetadata: typeof promptMetadata;
    promptFormat: typeof promptFormat;
    promptFileOrUrl: typeof promptFileOrUrl;
    promptRelationship: typeof promptRelationship;
    suggestCommand: typeof suggestCommand;
    showError: typeof showError;
    ProgressTracker: typeof ProgressTracker;
    showWelcome: typeof showWelcome;
    promptCommand: typeof promptCommand;
};
export default _default;
