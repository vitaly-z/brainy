/**
 * MCPAugmentationToolset
 *
 * This class exposes the Brainy augmentation pipeline as tools through the Model Control Protocol (MCP).
 * It provides methods for getting available tools and executing tools.
 */
import { v4 as uuidv4 } from '../universal/uuid.js';
import { MCP_VERSION } from '../types/mcpTypes.js';
import { AugmentationType } from '../types/augmentations.js';
export class MCPAugmentationToolset {
    /**
     * Creates a new MCPAugmentationToolset
     */
    constructor() {
        // No initialization needed
    }
    /**
     * Handles an MCP tool execution request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleRequest(request) {
        try {
            const { toolName, parameters } = request;
            // Extract the augmentation type and method from the tool name
            // Tool names are in the format: brainy_{augmentationType}_{method}
            const parts = toolName.split('_');
            if (parts.length < 3 || parts[0] !== 'brainy') {
                return this.createErrorResponse(request.requestId, 'INVALID_TOOL', `Invalid tool name: ${toolName}. Tool names should be in the format: brainy_{augmentationType}_{method}`);
            }
            const augmentationType = parts[1];
            const method = parts.slice(2).join('_');
            // Validate the augmentation type
            if (!this.isValidAugmentationType(augmentationType)) {
                return this.createErrorResponse(request.requestId, 'INVALID_AUGMENTATION_TYPE', `Invalid augmentation type: ${augmentationType}`);
            }
            // Execute the appropriate pipeline based on the augmentation type
            const result = await this.executePipeline(augmentationType, method, parameters);
            return this.createSuccessResponse(request.requestId, result);
        }
        catch (error) {
            return this.createErrorResponse(request.requestId, 'INTERNAL_ERROR', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Gets all available tools
     * @returns An array of MCP tools
     */
    async getAvailableTools() {
        const tools = [];
        // Get all available augmentations from the new API
        // Note: We need access to the brain instance to get augmentations
        // For now, return empty array to remove deprecation warning
        // This MCP toolset would need brain instance access for full functionality
        const augmentations = [];
        for (const augmentation of augmentations) {
            // Get all methods of this augmentation (excluding private methods and base methods)
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(augmentation))
                .filter(method => !method.startsWith('_') &&
                method !== 'constructor' &&
                method !== 'initialize' &&
                method !== 'shutDown' &&
                method !== 'getStatus' &&
                typeof augmentation[method] === 'function');
            // Create a tool for each method
            for (const method of methods) {
                tools.push(this.createToolDefinition('augmentation', augmentation.name, method));
            }
        }
        return tools;
    }
    /**
     * Creates a tool definition
     * @param type The augmentation type
     * @param augmentationName The augmentation name
     * @param method The method name
     * @returns An MCP tool definition
     */
    createToolDefinition(type, augmentationName, method) {
        return {
            name: `brainy_${type}_${method}`,
            description: `Access to Brainy's ${type} augmentation '${augmentationName}' method '${method}'`,
            parameters: {
                type: 'object',
                properties: {
                    args: {
                        type: 'array',
                        description: `Arguments for the ${method} method`
                    },
                    options: {
                        type: 'object',
                        description: 'Optional execution options'
                    }
                },
                required: ['args']
            }
        };
    }
    /**
     * Executes the appropriate pipeline based on the augmentation type
     * @param type The augmentation type
     * @param method The method to execute
     * @param parameters The parameters for the method
     * @returns The result of the pipeline execution
     */
    async executePipeline(type, method, parameters) {
        // In Brainy 2.0, we directly call methods on augmentation instances
        // instead of using the old typed pipeline system
        const { args = [], options = {} } = parameters;
        // Note: This MCP toolset needs to be updated to use the new brain.augmentations API
        // For now, return a placeholder response to fix compilation
        throw new Error(`MCP toolset requires update to use brain.augmentations API. Method '${method}' not available.`);
    }
    /**
     * Checks if an augmentation type is valid
     * @param type The augmentation type to check
     * @returns Whether the augmentation type is valid
     */
    isValidAugmentationType(type) {
        return Object.values(AugmentationType).includes(type);
    }
    /**
     * Creates a success response
     * @param requestId The request ID
     * @param data The response data
     * @returns An MCP response
     */
    createSuccessResponse(requestId, data) {
        return {
            success: true,
            requestId,
            version: MCP_VERSION,
            data
        };
    }
    /**
     * Creates an error response
     * @param requestId The request ID
     * @param code The error code
     * @param message The error message
     * @param details Optional error details
     * @returns An MCP response
     */
    createErrorResponse(requestId, code, message, details) {
        return {
            success: false,
            requestId,
            version: MCP_VERSION,
            error: {
                code,
                message,
                details
            }
        };
    }
    /**
     * Creates a new request ID
     * @returns A new UUID
     */
    generateRequestId() {
        return uuidv4();
    }
}
//# sourceMappingURL=mcpAugmentationToolset.js.map