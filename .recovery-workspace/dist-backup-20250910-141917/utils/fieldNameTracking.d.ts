/**
 * Utility functions for tracking and managing field names in JSON documents
 */
/**
 * Extracts field names from a JSON document
 * @param jsonObject The JSON object to extract field names from
 * @param options Configuration options
 * @returns An array of field paths (e.g., "user.name", "addresses[0].city")
 */
export declare function extractFieldNamesFromJson(jsonObject: any, options?: {
    maxDepth?: number;
    currentDepth?: number;
    currentPath?: string;
    fieldNames?: Set<string>;
}): string[];
/**
 * Maps field names to standard field names based on common patterns
 * @param fieldName The field name to map
 * @returns The standard field name if a match is found, or null if no match
 */
export declare function mapToStandardField(fieldName: string): string | null;
