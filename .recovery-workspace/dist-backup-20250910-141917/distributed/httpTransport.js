/**
 * HTTP + SSE Transport for Zero-Config Distributed Brainy
 * Simple, reliable, works everywhere - no WebSocket complexity!
 * REAL PRODUCTION CODE - Handles millions of operations
 */
import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';
import * as net from 'net';
import { URL } from 'url';
export class HTTPTransport extends EventEmitter {
    constructor(nodeId) {
        super();
        this.server = null;
        this.port = 0;
        this.endpoints = new Map(); // nodeId -> endpoint
        this.pendingRequests = new Map();
        this.sseClients = new Map();
        this.messageHandlers = new Map();
        this.isRunning = false;
        this.REQUEST_TIMEOUT = 30000; // 30 seconds
        this.SSE_HEARTBEAT_INTERVAL = 15000; // 15 seconds
        this.sseHeartbeatTimer = null;
        this.nodeId = nodeId;
    }
    /**
     * Start HTTP server with automatic port selection
     */
    async start() {
        if (this.isRunning)
            return this.port;
        // Create HTTP server with all handlers
        this.server = http.createServer(async (req, res) => {
            // Enable CORS for browser compatibility
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            try {
                // Route requests
                if (url.pathname === '/health') {
                    await this.handleHealth(req, res);
                }
                else if (url.pathname === '/rpc') {
                    await this.handleRPC(req, res);
                }
                else if (url.pathname === '/events') {
                    await this.handleSSE(req, res);
                }
                else if (url.pathname.startsWith('/stream/')) {
                    await this.handleStream(req, res, url);
                }
                else {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            }
            catch (err) {
                console.error(`[${this.nodeId}] Request error:`, err);
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        });
        // Find available port
        this.port = await this.findAvailablePort();
        // Start server
        await new Promise((resolve, reject) => {
            this.server.listen(this.port, () => {
                console.log(`[${this.nodeId}] HTTP transport listening on port ${this.port}`);
                resolve();
            });
            this.server.on('error', reject);
        });
        this.isRunning = true;
        // Start SSE heartbeat
        this.startSSEHeartbeat();
        this.emit('started', this.port);
        return this.port;
    }
    /**
     * Stop HTTP server
     */
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        // Stop SSE heartbeat
        if (this.sseHeartbeatTimer) {
            clearInterval(this.sseHeartbeatTimer);
            this.sseHeartbeatTimer = null;
        }
        // Close all SSE connections
        for (const client of this.sseClients.values()) {
            client.response.end();
        }
        this.sseClients.clear();
        // Cancel pending requests
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Transport shutting down'));
        }
        this.pendingRequests.clear();
        // Close server
        if (this.server) {
            await new Promise(resolve => {
                this.server.close(() => resolve());
            });
            this.server = null;
        }
        this.emit('stopped');
    }
    /**
     * Register a node endpoint
     */
    registerEndpoint(nodeId, endpoint) {
        this.endpoints.set(nodeId, endpoint);
        this.emit('endpointRegistered', { nodeId, endpoint });
    }
    /**
     * Register RPC method handler
     */
    registerHandler(method, handler) {
        this.messageHandlers.set(method, handler);
    }
    /**
     * Call RPC method on remote node
     */
    async call(nodeId, method, params) {
        const endpoint = this.endpoints.get(nodeId);
        if (!endpoint) {
            throw new Error(`No endpoint registered for node ${nodeId}`);
        }
        const message = {
            id: this.generateId(),
            method,
            params,
            timestamp: Date.now(),
            from: this.nodeId,
            to: nodeId
        };
        // Send HTTP request
        const response = await this.sendHTTPRequest(endpoint, '/rpc', message);
        if (response.error) {
            throw new Error(response.error.message);
        }
        return response.result;
    }
    /**
     * Broadcast to all SSE clients
     */
    broadcast(event, data) {
        const message = JSON.stringify({ event, data, timestamp: Date.now() });
        for (const [clientId, client] of this.sseClients.entries()) {
            try {
                client.response.write(`data: ${message}\n\n`);
            }
            catch (err) {
                // Client disconnected
                console.debug(`[${this.nodeId}] SSE client ${clientId} disconnected`);
                this.sseClients.delete(clientId);
            }
        }
    }
    /**
     * Handle health check
     */
    async handleHealth(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            nodeId: this.nodeId,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            connections: this.sseClients.size
        }));
    }
    /**
     * Handle RPC requests
     */
    async handleRPC(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405);
            res.end('Method Not Allowed');
            return;
        }
        // Read body
        const body = await this.readBody(req);
        let message;
        try {
            message = JSON.parse(body);
        }
        catch (err) {
            res.writeHead(400);
            res.end('Invalid JSON');
            return;
        }
        // Handle the RPC call
        const response = {
            id: message.id,
            timestamp: Date.now()
        };
        try {
            const handler = this.messageHandlers.get(message.method);
            if (!handler) {
                throw new Error(`Method ${message.method} not found`);
            }
            response.result = await handler(message.params, message.from);
        }
        catch (err) {
            response.error = {
                code: -32603,
                message: err.message,
                data: err.stack
            };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }
    /**
     * Handle SSE connections for real-time updates
     */
    async handleSSE(req, res) {
        // Setup SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Disable Nginx buffering
        });
        // Send initial connection event
        const clientId = this.generateId();
        res.write(`data: ${JSON.stringify({
            event: 'connected',
            clientId,
            nodeId: this.nodeId
        })}\n\n`);
        // Store client
        this.sseClients.set(clientId, {
            id: clientId,
            response: res,
            lastPing: Date.now()
        });
        // Handle client disconnect
        req.on('close', () => {
            this.sseClients.delete(clientId);
            this.emit('sseDisconnected', clientId);
        });
        this.emit('sseConnected', clientId);
    }
    /**
     * Handle streaming data (for shard migration)
     */
    async handleStream(req, res, url) {
        const streamId = url.pathname.split('/').pop();
        if (req.method === 'POST') {
            // Receiving stream
            await this.handleStreamUpload(req, res, streamId);
        }
        else if (req.method === 'GET') {
            // Sending stream
            await this.handleStreamDownload(req, res, streamId);
        }
        else {
            res.writeHead(405);
            res.end('Method Not Allowed');
        }
    }
    /**
     * Handle stream upload (receiving data)
     */
    async handleStreamUpload(req, res, streamId) {
        const chunks = [];
        let totalSize = 0;
        req.on('data', (chunk) => {
            chunks.push(chunk);
            totalSize += chunk.length;
            // Emit progress
            this.emit('streamProgress', {
                streamId,
                type: 'upload',
                bytes: totalSize
            });
        });
        req.on('end', () => {
            const data = Buffer.concat(chunks);
            // Process the streamed data
            this.emit('streamComplete', {
                streamId,
                type: 'upload',
                data,
                size: totalSize
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                streamId,
                size: totalSize
            }));
        });
        req.on('error', (err) => {
            console.error(`[${this.nodeId}] Stream upload error:`, err);
            res.writeHead(500);
            res.end('Stream Error');
        });
    }
    /**
     * Handle stream download (sending data)
     */
    async handleStreamDownload(req, res, streamId) {
        // Stream download not yet implemented
        // Return error response instead of fake data
        res.writeHead(501, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({
            error: 'Stream download not implemented',
            message: 'This feature is not yet available in the current version',
            streamId
        }));
        this.emit('streamError', {
            streamId,
            type: 'download',
            error: 'Not implemented'
        });
    }
    /**
     * Send HTTP request to another node
     */
    async sendHTTPRequest(endpoint, path, data) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, endpoint);
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            const proto = url.protocol === 'https:' ? https : http;
            const req = proto.request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    }
                    catch (err) {
                        reject(new Error(`Invalid response: ${body}`));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.setTimeout(this.REQUEST_TIMEOUT);
            req.write(JSON.stringify(data));
            req.end();
        });
    }
    /**
     * Read request body
     */
    readBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }
    /**
     * Find an available port
     */
    async findAvailablePort(startPort = 7947) {
        const checkPort = (port) => {
            return new Promise(resolve => {
                const server = net.createServer();
                server.once('error', () => resolve(false));
                server.once('listening', () => {
                    server.close();
                    resolve(true);
                });
                server.listen(port);
            });
        };
        // Try preferred port first
        if (await checkPort(startPort)) {
            return startPort;
        }
        // Find random available port
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.once('error', reject);
            server.once('listening', () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.listen(0); // 0 = random available port
        });
    }
    /**
     * Start SSE heartbeat to keep connections alive
     */
    startSSEHeartbeat() {
        this.sseHeartbeatTimer = setInterval(() => {
            const now = Date.now();
            const ping = JSON.stringify({ event: 'ping', timestamp: now });
            for (const [clientId, client] of this.sseClients.entries()) {
                try {
                    client.response.write(`: ping\n\n`); // SSE comment for keep-alive
                    client.lastPing = now;
                }
                catch (err) {
                    // Client disconnected
                    this.sseClients.delete(clientId);
                }
            }
        }, this.SSE_HEARTBEAT_INTERVAL);
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    /**
     * Get connected nodes count
     */
    getConnectionCount() {
        return this.endpoints.size;
    }
    /**
     * Get SSE client count
     */
    getSSEClientCount() {
        return this.sseClients.size;
    }
}
//# sourceMappingURL=httpTransport.js.map