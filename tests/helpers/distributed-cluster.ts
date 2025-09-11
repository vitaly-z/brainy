import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Brainy } from '../../src/brainy';

export interface DistributedTestNode {
  id: string;
  brain: Brainy;
  port: number;
}

export interface DistributedClusterConfig {
  nodeCount: number;
  redisHost?: string;
  redisPort?: number;
  useTestContainers?: boolean;
}

export class DistributedTestCluster {
  private nodes: DistributedTestNode[] = [];
  private redisContainer?: StartedTestContainer;
  private config: DistributedClusterConfig;
  private redisEndpoint?: { host: string; port: number };

  constructor(config: DistributedClusterConfig) {
    this.config = {
      useTestContainers: config.useTestContainers !== false,
      ...config,
      nodeCount: config.nodeCount || 3
    };
  }

  async start(): Promise<void> {
    console.log(`Starting distributed test cluster with ${this.config.nodeCount} nodes...`);

    // Start Redis if using test containers
    if (this.config.useTestContainers && !this.config.redisHost) {
      await this.startRedis();
    } else {
      this.redisEndpoint = {
        host: this.config.redisHost || 'localhost',
        port: this.config.redisPort || 6379
      };
    }

    // Start cluster nodes
    await this.startNodes();
    
    // Wait for nodes to discover each other
    await this.waitForClusterFormation();
    
    console.log(`Distributed cluster ready with ${this.nodes.length} nodes`);
  }

  private async startRedis(): Promise<void> {
    console.log('Starting Redis test container...');
    
    this.redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withCommand(['redis-server', '--appendonly', 'yes'])
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    this.redisEndpoint = {
      host: this.redisContainer.getHost(),
      port: this.redisContainer.getMappedPort(6379)
    };

    console.log(`Redis started on ${this.redisEndpoint.host}:${this.redisEndpoint.port}`);
  }

  private async startNodes(): Promise<void> {
    const basePort = 8000;

    for (let i = 0; i < this.config.nodeCount; i++) {
      const nodeId = `node-${i + 1}`;
      const port = basePort + i;

      console.log(`Starting ${nodeId} on port ${port}...`);

      const brain = new Brainy({
        storage: {
          type: 'memory'
        }
        // distributed config is not part of BrainyConfig
        // distributed: {
        //   enabled: true,
        //   nodeId: nodeId,
        //   redis: {
        //     host: this.redisEndpoint!.host,
        //     port: this.redisEndpoint!.port
        //   },
        //   server: {
        //     port: port,
        //     host: '0.0.0.0'
        //   },
        //   discovery: {
        //     interval: 1000,
        //     timeout: 500
        //   },
        //   sharding: {
        //     enabled: true,
        //     replicas: 2
        //   },
        //   consensus: {
        //     enabled: true,
        //     quorum: Math.floor(this.config.nodeCount / 2) + 1
        //   }
        // }
      });

      await brain.init();

      this.nodes.push({
        id: nodeId,
        brain: brain,
        port: port
      });
    }
  }

  private async waitForClusterFormation(): Promise<void> {
    console.log('Waiting for cluster formation...');
    
    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const allNodesDiscovered = await this.checkClusterHealth();
      
      if (allNodesDiscovered) {
        console.log('All nodes have discovered each other');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Cluster formation timeout - nodes failed to discover each other');
  }

  private async checkClusterHealth(): Promise<boolean> {
    for (const node of this.nodes) {
      const health = await node.brain.health();
      
      if (!health.distributed || !health.distributed.connectedNodes) {
        return false;
      }

      // Each node should see all other nodes
      const expectedNodeCount = this.config.nodeCount - 1;
      if (health.distributed.connectedNodes.length < expectedNodeCount) {
        return false;
      }
    }

    return true;
  }

  async stop(): Promise<void> {
    console.log('Stopping distributed test cluster...');

    // Stop all nodes
    for (const node of this.nodes) {
      try {
        if (node.brain.close) {
          await node.brain.close();
        }
        console.log(`Stopped ${node.id}`);
      } catch (error) {
        console.warn(`Failed to stop ${node.id}:`, error);
      }
    }

    // Stop Redis container
    if (this.redisContainer) {
      await this.redisContainer.stop();
      console.log('Redis container stopped');
    }

    this.nodes = [];
    console.log('Distributed cluster stopped');
  }

  getNodes(): DistributedTestNode[] {
    return this.nodes;
  }

  getNode(index: number): DistributedTestNode {
    if (index < 0 || index >= this.nodes.length) {
      throw new Error(`Invalid node index: ${index}`);
    }
    return this.nodes[index];
  }

  getPrimaryNode(): DistributedTestNode {
    return this.nodes[0];
  }

  getSecondaryNodes(): DistributedTestNode[] {
    return this.nodes.slice(1);
  }

  async executeOnAllNodes<T>(fn: (brain: Brainy) => Promise<T>): Promise<T[]> {
    return Promise.all(this.nodes.map(node => fn(node.brain)));
  }

  async executeOnNode<T>(index: number, fn: (brain: Brainy) => Promise<T>): Promise<T> {
    const node = this.getNode(index);
    return fn(node.brain);
  }

  async simulateNodeFailure(index: number): Promise<void> {
    const node = this.getNode(index);
    console.log(`Simulating failure of ${node.id}...`);
    
    if (node.brain.close) {
      await node.brain.close();
    }
    
    // Remove from active nodes
    this.nodes.splice(index, 1);
  }

  async addNode(): Promise<DistributedTestNode> {
    const nodeId = `node-${this.nodes.length + 1}`;
    const port = 8000 + this.nodes.length;

    console.log(`Adding new node ${nodeId} on port ${port}...`);

    const brain = new Brainy({
      storage: {
        type: 'memory'
      }
      // distributed config is not part of BrainyConfig
      // distributed: {
      //   enabled: true,
      //   nodeId: nodeId,
      //   redis: {
      //     host: this.redisEndpoint!.host,
      //     port: this.redisEndpoint!.port
      //   },
      //   server: {
      //     port: port,
      //     host: '0.0.0.0'
      //   },
      //   discovery: {
      //     interval: 1000,
      //     timeout: 500
      //   },
      //   sharding: {
      //     enabled: true,
      //     replicas: 2
      //   }
      // }
    });

    await brain.init();

    const newNode = { id: nodeId, brain, port };
    this.nodes.push(newNode);

    // Wait for new node to join cluster
    await this.waitForNodeDiscovery(nodeId);

    return newNode;
  }

  private async waitForNodeDiscovery(nodeId: string): Promise<void> {
    console.log(`Waiting for ${nodeId} to join cluster...`);
    
    const maxAttempts = 10;
    const delayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const discovered = await this.isNodeDiscovered(nodeId);
      
      if (discovered) {
        console.log(`${nodeId} has joined the cluster`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`Timeout waiting for ${nodeId} to join cluster`);
  }

  private async isNodeDiscovered(nodeId: string): Promise<boolean> {
    // Check if other nodes can see the new node
    for (const node of this.nodes) {
      if (node.id === nodeId) continue;
      
      const health = await node.brain.health();
      if (health.distributed?.connectedNodes?.includes(nodeId)) {
        return true;
      }
    }

    return false;
  }
}