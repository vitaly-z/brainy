/**
 * Utility functions for processing JSON documents for vectorization and search
 */
/**
 * Extracts text from a JSON object for vectorization
 * This function recursively processes the JSON object and extracts text from all fields
 * It can also prioritize specific fields if provided
 *
 * @param jsonObject The JSON object to extract text from
 * @param options Configuration options for text extraction
 * @returns A string containing the extracted text
 */
export declare function extractTextFromJson(jsonObject: any, options?: {
    priorityFields?: string[];
    excludeFields?: string[];
    includeFieldNames?: boolean;
    maxDepth?: number;
    currentDepth?: number;
    fieldPath?: string[];
}): string;
/**
 * Prepares a JSON document for vectorization
 * This function extracts text from the JSON document and formats it for optimal vectorization
 *
 * @param jsonDocument The JSON document to prepare
 * @param options Configuration options for preparation
 * @returns A string ready for vectorization
 */
export declare function prepareJsonForVectorization(jsonDocument: any, options?: {
    priorityFields?: string[];
    excludeFields?: string[];
    includeFieldNames?: boolean;
    maxDepth?: number;
}): string;
/**
 * Extracts text from a specific field in a JSON document
 * This is useful for searching within specific fields
 *
 * @param jsonDocument The JSON document to extract from
 * @param fieldPath The path to the field (e.g., "user.name" or "addresses[0].city")
 * @returns The extracted text or empty string if field not found
 */
export declare function extractFieldFromJson(jsonDocument: any, fieldPath: string): string;
