/**
 * BrainyMCPAdapter
 *
 * This class provides an adapter for accessing Brainy data through the Model Control Protocol (MCP).
 * It wraps a BrainyData instance and exposes methods for getting vectors, searching similar items,
 * and getting relationships.
 */
import { v4 as uuidv4 } from '../universal/uuid.js';
import { MCP_VERSION } from '../types/mcpTypes.js';
export class BrainyMCPAdapter {
    /**
     * Creates a new BrainyMCPAdapter
     * @param brainyData The BrainyData instance to wrap
     */
    constructor(brainyData) {
        this.brainyData = brainyData;
    }
    /**
     * Handles an MCP data access request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleRequest(request) {
        try {
            switch (request.operation) {
                case 'get':
                    return await this.handleGetRequest(request);
                case 'search':
                    return await this.handleSearchRequest(request);
                case 'add':
                    return await this.handleAddRequest(request);
                case 'getRelationships':
                    return await this.handleGetRelationshipsRequest(request);
                default:
                    return this.createErrorResponse(request.requestId, 'UNSUPPORTED_OPERATION', `Operation ${request.operation} is not supported`);
            }
        }
        catch (error) {
            return this.createErrorResponse(request.requestId, 'INTERNAL_ERROR', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Handles a get request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleGetRequest(request) {
        const { id } = request.parameters;
        if (!id) {
            return this.createErrorResponse(request.requestId, 'MISSING_PARAMETER', 'Parameter "id" is required');
        }
        const noun = await this.brainyData.get(id);
        if (!noun) {
            return this.createErrorResponse(request.requestId, 'NOT_FOUND', `No noun found with id ${id}`);
        }
        return this.createSuccessResponse(request.requestId, noun);
    }
    /**
     * Handles a search request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleSearchRequest(request) {
        const { query, k = 10 } = request.parameters;
        if (!query) {
            return this.createErrorResponse(request.requestId, 'MISSING_PARAMETER', 'Parameter "query" is required');
        }
        const results = await this.brainyData.searchText(query, k);
        return this.createSuccessResponse(request.requestId, results);
    }
    /**
     * Handles an add request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleAddRequest(request) {
        const { text, metadata } = request.parameters;
        if (!text) {
            return this.createErrorResponse(request.requestId, 'MISSING_PARAMETER', 'Parameter "text" is required');
        }
        const id = await this.brainyData.add(text, metadata);
        return this.createSuccessResponse(request.requestId, { id });
    }
    /**
     * Handles a getRelationships request
     * @param request The MCP request
     * @returns An MCP response
     */
    async handleGetRelationshipsRequest(request) {
        const { id } = request.parameters;
        if (!id) {
            return this.createErrorResponse(request.requestId, 'MISSING_PARAMETER', 'Parameter "id" is required');
        }
        // This is a simplified implementation - in a real implementation, we would
        // need to check if these methods exist on the BrainyDataInterface
        const outgoing = await this.brainyData.getVerbsBySource?.(id) || [];
        const incoming = await this.brainyData.getVerbsByTarget?.(id) || [];
        return this.createSuccessResponse(request.requestId, { outgoing, incoming });
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
//# sourceMappingURL=brainyMCPAdapter.js.map