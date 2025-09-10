/**
 * Distributed Coordinator for Brainy 3.0
 * Provides leader election, consensus, and coordination for distributed instances
 */
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
/**
 * Distributed Coordinator implementing Raft-like consensus
 */
export class DistributedCoordinator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.nodes = new Map();
        this.isRunning = false;
        this.votesReceived = new Set();
        this.currentTerm = 0;
        this.lastLogIndex = -1;
        this.lastLogTerm = 0;
        this.logEntries = [];
        this.transport = null; // For migration proposals
        this.pendingMigrations = new Map();
        this.committedMigrations = new Set();
        // Generate node ID if not provided
        this.nodeId = config.nodeId || this.generateNodeId();
        // Configuration
        this.heartbeatInterval = config.heartbeatInterval || 1000;
        this.electionTimeout = config.electionTimeout || 5000;
        // Initialize consensus state
        this.consensusState = {
            term: 0,
            votedFor: null,
            leader: null,
            state: 'follower'
        };
        // Register this node
        this.nodes.set(this.nodeId, {
            id: this.nodeId,
            address: config.address || 'localhost',
            port: config.port || 3000,
            lastSeen: Date.now(),
            status: 'active',
            state: 'follower',
            lastHeartbeat: Date.now()
        });
        // Register other nodes if provided
        if (config.nodes) {
            this.registerNodes(config.nodes);
        }
    }
    /**
     * Start the coordinator
     */
    async start(networkTransport) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.networkTransport = networkTransport;
        // Setup network message handlers if transport is provided
        if (this.networkTransport) {
            this.setupNetworkHandlers();
        }
        this.emit('started', { nodeId: this.nodeId });
        // Start as follower
        this.becomeFollower();
    }
    /**
     * Setup network message handlers
     */
    setupNetworkHandlers() {
        if (!this.networkTransport)
            return;
        // Register message handlers directly on the messageHandlers map
        const handlers = this.networkTransport.messageHandlers;
        // Handle vote requests
        handlers.set('requestVote', async (msg) => {
            const response = await this.handleVoteRequest(msg);
            // Send response back
            if (this.networkTransport) {
                await this.networkTransport.sendToNode(msg.from, 'voteResponse', response);
            }
            return response;
        });
        // Handle vote responses
        handlers.set('voteResponse', async (msg) => {
            this.handleVoteResponse(msg);
        });
        // Handle heartbeats/append entries
        handlers.set('appendEntries', async (msg) => {
            const response = await this.handleAppendEntries(msg);
            // Send response back
            if (this.networkTransport) {
                await this.networkTransport.sendToNode(msg.from, 'appendResponse', response);
            }
            return response;
        });
        // Handle append responses
        handlers.set('appendResponse', async (msg) => {
            this.handleAppendResponse(msg);
        });
    }
    /**
     * Stop the coordinator
     */
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.electionTimer) {
            clearTimeout(this.electionTimer);
            this.electionTimer = undefined;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        this.emit('stopped');
    }
    /**
     * Register additional nodes
     */
    registerNodes(nodes) {
        for (const node of nodes) {
            const [address, port] = node.split(':');
            const nodeId = this.generateNodeId(node);
            if (!this.nodes.has(nodeId)) {
                this.nodes.set(nodeId, {
                    id: nodeId,
                    address,
                    port: parseInt(port || '3000'),
                    lastSeen: Date.now(),
                    status: 'active',
                    state: 'follower'
                });
            }
        }
    }
    /**
     * Become a follower
     */
    becomeFollower() {
        this.consensusState.state = 'follower';
        const node = this.nodes.get(this.nodeId);
        if (node) {
            node.state = 'follower';
        }
        this.resetElectionTimeout();
        this.emit('stateChange', 'follower');
    }
    /**
     * Become a candidate and start election
     */
    async becomeCandidate() {
        this.consensusState.state = 'candidate';
        this.currentTerm++;
        this.consensusState.term = this.currentTerm;
        this.consensusState.votedFor = this.nodeId;
        this.votesReceived = new Set([this.nodeId]);
        const node = this.nodes.get(this.nodeId);
        if (node) {
            node.state = 'candidate';
        }
        this.emit('stateChange', 'candidate');
        // Request votes from all other nodes
        await this.requestVotes();
        // Reset election timeout
        this.resetElectionTimeout();
    }
    /**
     * Become the leader
     */
    becomeLeader() {
        this.consensusState.state = 'leader';
        this.consensusState.leader = this.nodeId;
        const node = this.nodes.get(this.nodeId);
        if (node) {
            node.state = 'leader';
        }
        // Stop election timer as leader
        if (this.electionTimer) {
            clearTimeout(this.electionTimer);
            this.electionTimer = undefined;
        }
        this.emit('stateChange', 'leader');
        this.emit('leaderElected', this.nodeId);
        // Start sending heartbeats
        this.startHeartbeat();
    }
    /**
     * Request votes from all nodes
     */
    async requestVotes() {
        if (!this.networkTransport) {
            // Simulate vote for testing
            this.checkVoteMajority();
            return;
        }
        const voteRequest = {
            type: 'requestVote',
            term: this.currentTerm,
            candidateId: this.nodeId,
            lastLogIndex: this.getLastLogIndex(),
            lastLogTerm: this.getLastLogTerm()
        };
        // Send vote requests to all other nodes
        for (const [nodeId] of this.nodes) {
            if (nodeId !== this.nodeId) {
                try {
                    await this.networkTransport.sendToNode(nodeId, 'requestVote', voteRequest);
                }
                catch (err) {
                    console.error(`Failed to request vote from ${nodeId}:`, err);
                }
            }
        }
    }
    /**
     * Handle vote request from another node
     */
    async handleVoteRequest(msg) {
        const { term, candidateId, lastLogIndex, lastLogTerm } = msg.data;
        // Update term if necessary
        if (term > this.currentTerm) {
            this.currentTerm = term;
            this.consensusState.term = term;
            this.consensusState.votedFor = null;
            this.becomeFollower();
        }
        // Grant vote if conditions are met
        let voteGranted = false;
        if (term >= this.currentTerm &&
            (!this.consensusState.votedFor || this.consensusState.votedFor === candidateId) &&
            this.isLogUpToDate(lastLogIndex, lastLogTerm)) {
            this.consensusState.votedFor = candidateId;
            voteGranted = true;
            this.resetElectionTimeout();
        }
        return {
            type: 'voteResponse',
            term: this.currentTerm,
            voteGranted
        };
    }
    /**
     * Handle vote response
     */
    handleVoteResponse(msg) {
        const { term, voteGranted } = msg.data;
        // Ignore old responses
        if (term < this.currentTerm)
            return;
        // Update term if necessary
        if (term > this.currentTerm) {
            this.currentTerm = term;
            this.consensusState.term = term;
            this.becomeFollower();
            return;
        }
        // Count vote if granted
        if (voteGranted && this.consensusState.state === 'candidate') {
            this.votesReceived.add(msg.from);
            this.checkVoteMajority();
        }
    }
    /**
     * Check if we have majority votes
     */
    checkVoteMajority() {
        const majority = Math.floor(this.nodes.size / 2) + 1;
        if (this.votesReceived.size >= majority) {
            this.becomeLeader();
        }
    }
    /**
     * Handle append entries (heartbeat) from leader
     */
    async handleAppendEntries(msg) {
        const { term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = msg.data;
        // Update term if necessary
        if (term > this.currentTerm) {
            this.currentTerm = term;
            this.consensusState.term = term;
            this.consensusState.votedFor = null;
            this.becomeFollower();
        }
        // Reset election timeout when receiving valid heartbeat
        if (term >= this.currentTerm) {
            this.consensusState.leader = leaderId;
            this.resetElectionTimeout();
            // Update leader node's last heartbeat
            const leaderNode = this.nodes.get(leaderId);
            if (leaderNode) {
                leaderNode.lastHeartbeat = Date.now();
                leaderNode.lastSeen = Date.now();
            }
        }
        // Check log consistency
        let success = false;
        if (term >= this.currentTerm) {
            if (this.checkLogConsistency(prevLogIndex, prevLogTerm)) {
                // Append new entries if any
                if (entries && entries.length > 0) {
                    this.appendLogEntries(prevLogIndex, entries);
                }
                success = true;
            }
        }
        return {
            type: 'appendResponse',
            term: this.currentTerm,
            success
        };
    }
    /**
     * Handle append response from follower
     */
    handleAppendResponse(msg) {
        const { term, success } = msg.data;
        // Update term if necessary
        if (term > this.currentTerm) {
            this.currentTerm = term;
            this.consensusState.term = term;
            this.becomeFollower();
        }
        // Process successful append
        if (success && this.consensusState.state === 'leader') {
            // Update follower's match index
            // In a real implementation, this would track replication progress
        }
    }
    /**
     * Send heartbeat to followers
     */
    async sendHeartbeat() {
        if (!this.networkTransport) {
            // Fallback for testing
            await new Promise(resolve => setTimeout(resolve, 10));
            return;
        }
        const heartbeat = {
            type: 'appendEntries',
            term: this.currentTerm,
            leaderId: this.nodeId,
            prevLogIndex: this.getLastLogIndex(),
            prevLogTerm: this.getLastLogTerm(),
            entries: [],
            leaderCommit: 0
        };
        // Send heartbeat to all followers
        for (const [nodeId] of this.nodes) {
            if (nodeId !== this.nodeId) {
                try {
                    await this.networkTransport.sendToNode(nodeId, 'appendEntries', heartbeat);
                }
                catch (err) {
                    // Node might be down, mark as suspected
                    const node = this.nodes.get(nodeId);
                    if (node) {
                        node.status = 'suspected';
                    }
                }
            }
        }
    }
    /**
     * Start heartbeat timer as leader
     */
    startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
        // Send immediate heartbeat
        this.sendHeartbeat();
    }
    /**
     * Reset election timeout
     */
    resetElectionTimeout() {
        if (this.electionTimer) {
            clearTimeout(this.electionTimer);
        }
        // Randomize timeout to prevent split votes
        const timeout = this.electionTimeout + Math.random() * this.electionTimeout;
        this.electionTimer = setTimeout(() => {
            if (this.consensusState.state === 'follower') {
                this.becomeCandidate();
            }
        }, timeout);
    }
    /**
     * Check if log is up to date
     */
    isLogUpToDate(lastLogIndex, lastLogTerm) {
        const myLastLogTerm = this.getLastLogTerm();
        const myLastLogIndex = this.getLastLogIndex();
        if (lastLogTerm > myLastLogTerm)
            return true;
        if (lastLogTerm < myLastLogTerm)
            return false;
        return lastLogIndex >= myLastLogIndex;
    }
    /**
     * Check log consistency
     */
    checkLogConsistency(prevLogIndex, prevLogTerm) {
        if (prevLogIndex === -1)
            return true;
        if (prevLogIndex >= this.logEntries.length)
            return false;
        const entry = this.logEntries[prevLogIndex];
        return entry && entry.term === prevLogTerm;
    }
    /**
     * Append log entries
     */
    appendLogEntries(prevLogIndex, entries) {
        // Remove conflicting entries
        this.logEntries = this.logEntries.slice(0, prevLogIndex + 1);
        // Append new entries
        for (const entry of entries) {
            this.logEntries.push({
                term: entry.term,
                index: this.logEntries.length,
                data: entry.data
            });
        }
        this.lastLogIndex = this.logEntries.length - 1;
        if (this.lastLogIndex >= 0) {
            this.lastLogTerm = this.logEntries[this.lastLogIndex].term;
        }
    }
    /**
     * Get last log index
     */
    getLastLogIndex() {
        return this.lastLogIndex;
    }
    /**
     * Get last log term
     */
    getLastLogTerm() {
        return this.lastLogTerm;
    }
    /**
     * Generate a unique node ID
     */
    generateNodeId(seed) {
        const source = seed || `${process.pid}-${Date.now()}-${Math.random()}`;
        return createHash('sha256').update(source).digest('hex').substring(0, 16);
    }
    /**
     * Get current leader
     */
    getLeader() {
        return this.consensusState.leader;
    }
    /**
     * Propose a shard migration to the cluster
     */
    async proposeMigration(migration) {
        if (!this.isLeader()) {
            throw new Error('Only leader can propose migrations');
        }
        // Broadcast migration proposal to all nodes
        const message = {
            type: 'migration-proposal',
            migration,
            timestamp: Date.now()
        };
        await this.transport.broadcast('migration', message);
        // Store migration as pending
        this.pendingMigrations.set(migration.migrationId, {
            ...migration,
            status: 'pending'
        });
    }
    /**
     * Get migration status
     */
    async getMigrationStatus(migrationId) {
        const migration = this.pendingMigrations.get(migrationId);
        if (!migration) {
            // Check if it was committed
            return this.committedMigrations.has(migrationId) ? 'committed' : 'rejected';
        }
        return migration.status || 'pending';
    }
    /**
     * Check if this node is the leader
     */
    isLeader() {
        return this.consensusState.state === 'leader';
    }
    /**
     * Get all nodes in the cluster
     */
    getNodes() {
        return Array.from(this.nodes.values());
    }
    /**
     * Get cluster health status
     */
    getHealth() {
        const now = Date.now();
        const activeNodes = Array.from(this.nodes.values()).filter(node => now - node.lastSeen < this.electionTimeout).length;
        return {
            healthy: this.consensusState.leader !== null && activeNodes > this.nodes.size / 2,
            leader: this.consensusState.leader,
            nodes: this.nodes.size,
            activeNodes
        };
    }
    /**
     * Propose a command to the cluster
     */
    async proposeCommand(command) {
        if (this.consensusState.state !== 'leader') {
            throw new Error(`Not the leader. Current leader: ${this.consensusState.leader}`);
        }
        // Add to log
        const entry = {
            term: this.currentTerm,
            index: this.logEntries.length,
            data: command
        };
        this.logEntries.push(entry);
        this.lastLogIndex = entry.index;
        this.lastLogTerm = entry.term;
        // Replicate to followers
        await this.sendHeartbeat();
        this.emit('commandProposed', command);
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.consensusState };
    }
}
/**
 * Create a coordinator instance
 */
export function createCoordinator(config) {
    return new DistributedCoordinator(config);
}
//# sourceMappingURL=coordinator.js.map