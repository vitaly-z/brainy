/**
 * Model Control Protocol (MCP) Types
 *
 * This file defines the types and interfaces for the Model Control Protocol (MCP)
 * implementation in Brainy. MCP allows external models to access Brainy data and
 * use the augmentation pipeline as tools.
 */
/**
 * MCP version information
 */
export const MCP_VERSION = '1.0.0';
/**
 * MCP request types
 */
export var MCPRequestType;
(function (MCPRequestType) {
    MCPRequestType["DATA_ACCESS"] = "data_access";
    MCPRequestType["TOOL_EXECUTION"] = "tool_execution";
    MCPRequestType["SYSTEM_INFO"] = "system_info";
    MCPRequestType["AUTHENTICATION"] = "authentication";
})(MCPRequestType || (MCPRequestType = {}));
//# sourceMappingURL=mcpTypes.js.map