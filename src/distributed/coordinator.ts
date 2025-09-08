/**
 * Distributed Coordinator for Brainy 3.0
 * Provides leader election, consensus, and coordination for distributed instances
 */

import { EventEmitter } from 'events'
import { createHash } from 'crypto'

export interface NodeInfo {
  id: string
  address: string
  port: number
  role: 'leader' | 'follower' | 'candidate'
  lastHeartbeat: number
  metadata?: Record<string, any>
}

export interface CoordinatorConfig {
  nodeId?: string
  address?: string
  port?: number
  heartbeatInterval?: number
  electionTimeout?: number
  nodes?: string[]
}

export interface ConsensusState {
  term: number
  votedFor: string | null
  leader: string | null
  state: 'follower' | 'candidate' | 'leader'
}

/**
 * Distributed Coordinator implementing Raft-like consensus
 */
export class DistributedCoordinator extends EventEmitter {
  private nodeId: string
  private nodes: Map<string, NodeInfo> = new Map()
  private consensusState: ConsensusState
  private heartbeatInterval: number
  private electionTimeout: number
  private electionTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private isRunning: boolean = false

  constructor(config: CoordinatorConfig = {}) {
    super()
    
    // Generate node ID if not provided
    this.nodeId = config.nodeId || this.generateNodeId()
    
    // Configuration
    this.heartbeatInterval = config.heartbeatInterval || 1000
    this.electionTimeout = config.electionTimeout || 5000
    
    // Initialize consensus state
    this.consensusState = {
      term: 0,
      votedFor: null,
      leader: null,
      state: 'follower'
    }
    
    // Register this node
    this.nodes.set(this.nodeId, {
      id: this.nodeId,
      address: config.address || 'localhost',
      port: config.port || 3000,
      role: 'follower',
      lastHeartbeat: Date.now()
    })
    
    // Register other nodes if provided
    if (config.nodes) {
      this.registerNodes(config.nodes)
    }
  }

  /**
   * Start the coordinator
   */
  async start(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    this.emit('started', { nodeId: this.nodeId })
    
    // Start as follower
    this.becomeFollower()
  }

  /**
   * Stop the coordinator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.electionTimer) {
      clearTimeout(this.electionTimer)
      this.electionTimer = undefined
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    
    this.emit('stopped', { nodeId: this.nodeId })
  }

  /**
   * Register nodes in the cluster
   */
  private registerNodes(nodeAddresses: string[]): void {
    for (const address of nodeAddresses) {
      const [host, port] = address.split(':')
      const nodeId = this.generateNodeId(address)
      
      if (nodeId !== this.nodeId) {
        this.nodes.set(nodeId, {
          id: nodeId,
          address: host,
          port: parseInt(port) || 3000,
          role: 'follower',
          lastHeartbeat: 0
        })
      }
    }
  }

  /**
   * Become a follower
   */
  private becomeFollower(): void {
    this.consensusState.state = 'follower'
    this.consensusState.votedFor = null
    
    const node = this.nodes.get(this.nodeId)
    if (node) {
      node.role = 'follower'
    }
    
    // Stop sending heartbeats
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    
    // Start election timeout
    this.resetElectionTimeout()
    
    this.emit('roleChange', { role: 'follower', nodeId: this.nodeId })
  }

  /**
   * Become a candidate and start election
   */
  private becomeCandidate(): void {
    this.consensusState.state = 'candidate'
    this.consensusState.term++
    this.consensusState.votedFor = this.nodeId
    
    const node = this.nodes.get(this.nodeId)
    if (node) {
      node.role = 'candidate'
    }
    
    this.emit('roleChange', { role: 'candidate', nodeId: this.nodeId })
    
    // Start election
    this.startElection()
  }

  /**
   * Become the leader
   */
  private becomeLeader(): void {
    this.consensusState.state = 'leader'
    this.consensusState.leader = this.nodeId
    
    const node = this.nodes.get(this.nodeId)
    if (node) {
      node.role = 'leader'
    }
    
    // Stop election timer
    if (this.electionTimer) {
      clearTimeout(this.electionTimer)
      this.electionTimer = undefined
    }
    
    // Start sending heartbeats
    this.startHeartbeat()
    
    this.emit('roleChange', { role: 'leader', nodeId: this.nodeId })
    this.emit('leaderElected', { leader: this.nodeId, term: this.consensusState.term })
  }

  /**
   * Start election process
   */
  private async startElection(): Promise<void> {
    const votes = new Set<string>([this.nodeId]) // Vote for self
    const majority = Math.floor(this.nodes.size / 2) + 1
    
    // Request votes from other nodes (simplified for now)
    // In a real implementation, this would send RPC requests
    for (const [nodeId] of this.nodes) {
      if (nodeId !== this.nodeId) {
        // Simulate vote request
        const voteGranted = await this.requestVote(nodeId, this.consensusState.term)
        if (voteGranted) {
          votes.add(nodeId)
        }
        
        // Check if we have majority
        if (votes.size >= majority) {
          this.becomeLeader()
          return
        }
      }
    }
    
    // If we don't get majority, reset election timeout
    this.resetElectionTimeout()
  }

  /**
   * Request vote from a node (simplified)
   */
  private async requestVote(_nodeId: string, _term: number): Promise<boolean> {
    // In a real implementation, this would send an RPC request
    // For now, simulate with random success
    return Math.random() > 0.3
  }

  /**
   * Start heartbeat as leader
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.heartbeatInterval)
    
    // Send immediate heartbeat
    this.sendHeartbeat()
  }

  /**
   * Send heartbeat to all followers
   */
  private sendHeartbeat(): void {
    for (const [nodeId] of this.nodes) {
      if (nodeId !== this.nodeId) {
        // In a real implementation, this would send an RPC request
        this.emit('heartbeat', { 
          from: this.nodeId, 
          to: nodeId, 
          term: this.consensusState.term 
        })
      }
    }
  }

  /**
   * Reset election timeout
   */
  private resetElectionTimeout(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer)
    }
    
    // Randomize timeout to prevent split votes
    const timeout = this.electionTimeout + Math.random() * this.electionTimeout
    
    this.electionTimer = setTimeout(() => {
      if (this.consensusState.state === 'follower') {
        this.becomeCandidate()
      }
    }, timeout)
  }

  /**
   * Handle received heartbeat
   */
  handleHeartbeat(from: string, term: number): void {
    if (term >= this.consensusState.term) {
      this.consensusState.term = term
      this.consensusState.leader = from
      
      if (this.consensusState.state !== 'follower') {
        this.becomeFollower()
      } else {
        this.resetElectionTimeout()
      }
      
      // Update node's last heartbeat
      const node = this.nodes.get(from)
      if (node) {
        node.lastHeartbeat = Date.now()
      }
    }
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(seed?: string): string {
    const source = seed || `${process.pid}-${Date.now()}-${Math.random()}`
    return createHash('sha256').update(source).digest('hex').substring(0, 16)
  }

  /**
   * Get current leader
   */
  getLeader(): string | null {
    return this.consensusState.leader
  }

  /**
   * Check if this node is the leader
   */
  isLeader(): boolean {
    return this.consensusState.state === 'leader'
  }

  /**
   * Get all nodes in the cluster
   */
  getNodes(): NodeInfo[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get cluster health status
   */
  getHealth(): { healthy: boolean; leader: string | null; nodes: number; activeNodes: number } {
    const now = Date.now()
    const activeNodes = Array.from(this.nodes.values()).filter(
      node => now - node.lastHeartbeat < this.electionTimeout
    ).length

    return {
      healthy: this.consensusState.leader !== null && activeNodes > this.nodes.size / 2,
      leader: this.consensusState.leader,
      nodes: this.nodes.size,
      activeNodes
    }
  }
}

/**
 * Create a coordinator instance
 */
export function createCoordinator(config?: CoordinatorConfig): DistributedCoordinator {
  return new DistributedCoordinator(config)
}