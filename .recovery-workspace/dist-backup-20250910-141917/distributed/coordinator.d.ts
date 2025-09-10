/**
 * Distributed Coordinator for Brainy 3.0
 * Provides leader election, consensus, and coordination for distributed instances
 */
import { EventEmitter } from 'events';
import { NetworkTransport } from './networkTransport.js';
export interface NodeInfo {
    id: string;
    address: string;
    port: number;
    lastSeen: number;
    status: 'active' | 'inactive' | 'suspected';
    state?: 'follower' | 'candidate' | 'leader';
    lastHeartbeat?: number;
}
export interface CoordinatorConfig {
    nodeId?: string;
    address?: string;
    port?: number;
    heartbeatInterval?: number;
    electionTimeout?: number;
    nodes?: string[];
}
export interface ConsensusState {
    term: number;
    votedFor: string | null;
    leader: string | null;
    state: 'follower' | 'candidate' | 'leader';
}
export interface RaftMessage {
    type: 'requestVote' | 'voteResponse' | 'appendEntries' | 'appendResponse';
    term: number;
    from: string;
    to?: string;
    data?: any;
}
/**
 * Distributed Coordinator implementing Raft-like consensus
 */
export declare class DistributedCoordinator extends EventEmitter {
    private nodeId;
    private nodes;
    private consensusState;
    private heartbeatInterval;
    private electionTimeout;
    private electionTimer?;
    private heartbeatTimer?;
    private isRunning;
    private networkTransport?;
    private votesReceived;
    private currentTerm;
    private lastLogIndex;
    private lastLogTerm;
    private logEntries;
    private transport;
    private pendingMigrations;
    private committedMigrations;
    constructor(config?: CoordinatorConfig);
    /**
     * Start the coordinator
     */
    start(networkTransport?: NetworkTransport): Promise<void>;
    /**
     * Setup network message handlers
     */
    private setupNetworkHandlers;
    /**
     * Stop the coordinator
     */
    stop(): Promise<void>;
    /**
     * Register additional nodes
     */
    registerNodes(nodes: string[]): void;
    /**
     * Become a follower
     */
    private becomeFollower;
    /**
     * Become a candidate and start election
     */
    private becomeCandidate;
    /**
     * Become the leader
     */
    private becomeLeader;
    /**
     * Request votes from all nodes
     */
    private requestVotes;
    /**
     * Handle vote request from another node
     */
    private handleVoteRequest;
    /**
     * Handle vote response
     */
    private handleVoteResponse;
    /**
     * Check if we have majority votes
     */
    private checkVoteMajority;
    /**
     * Handle append entries (heartbeat) from leader
     */
    private handleAppendEntries;
    /**
     * Handle append response from follower
     */
    private handleAppendResponse;
    /**
     * Send heartbeat to followers
     */
    private sendHeartbeat;
    /**
     * Start heartbeat timer as leader
     */
    private startHeartbeat;
    /**
     * Reset election timeout
     */
    private resetElectionTimeout;
    /**
     * Check if log is up to date
     */
    private isLogUpToDate;
    /**
     * Check log consistency
     */
    private checkLogConsistency;
    /**
     * Append log entries
     */
    private appendLogEntries;
    /**
     * Get last log index
     */
    private getLastLogIndex;
    /**
     * Get last log term
     */
    private getLastLogTerm;
    /**
     * Generate a unique node ID
     */
    private generateNodeId;
    /**
     * Get current leader
     */
    getLeader(): string | null;
    /**
     * Propose a shard migration to the cluster
     */
    proposeMigration(migration: {
        shardId: string;
        fromNode: string;
        toNode: string;
        migrationId: string;
    }): Promise<void>;
    /**
     * Get migration status
     */
    getMigrationStatus(migrationId: string): Promise<'pending' | 'committed' | 'rejected'>;
    /**
     * Check if this node is the leader
     */
    isLeader(): boolean;
    /**
     * Get all nodes in the cluster
     */
    getNodes(): NodeInfo[];
    /**
     * Get cluster health status
     */
    getHealth(): {
        healthy: boolean;
        leader: string | null;
        nodes: number;
        activeNodes: number;
    };
    /**
     * Propose a command to the cluster
     */
    proposeCommand(command: any): Promise<void>;
    /**
     * Get current state
     */
    getState(): ConsensusState;
}
/**
 * Create a coordinator instance
 */
export declare function createCoordinator(config?: CoordinatorConfig): DistributedCoordinator;
