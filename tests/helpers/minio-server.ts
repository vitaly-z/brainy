import * as Minio from 'minio';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface MinioTestConfig {
  bucketName: string;
  accessKey?: string;
  secretKey?: string;
  region?: string;
}

export class MinioTestServer {
  private container?: StartedTestContainer;
  private client?: Minio.Client;
  private config: Required<MinioTestConfig>;

  constructor(config: MinioTestConfig) {
    this.config = {
      bucketName: config.bucketName,
      accessKey: config.accessKey || 'minioadmin',
      secretKey: config.secretKey || 'minioadmin',
      region: config.region || 'us-east-1'
    };
  }

  async start(): Promise<void> {
    console.log('Starting MinIO test container...');
    
    this.container = await new GenericContainer('minio/minio:latest')
      .withExposedPorts(9000)
      .withEnvironment({
        MINIO_ROOT_USER: this.config.accessKey,
        MINIO_ROOT_PASSWORD: this.config.secretKey
      })
      .withCommand(['server', '/data'])
      .withWaitStrategy(Wait.forHttp('/minio/health/live', 9000))
      .start();

    const port = this.container.getMappedPort(9000);
    const host = this.container.getHost();

    this.client = new Minio.Client({
      endPoint: host,
      port: port,
      useSSL: false,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey
    });

    // Create test bucket
    const bucketExists = await this.client.bucketExists(this.config.bucketName);
    if (!bucketExists) {
      await this.client.makeBucket(this.config.bucketName, this.config.region);
      console.log(`Created test bucket: ${this.config.bucketName}`);
    }

    console.log(`MinIO server started on ${host}:${port}`);
  }

  async stop(): Promise<void> {
    if (this.client && this.config.bucketName) {
      try {
        // Clean up bucket
        const objects = await this.listAllObjects();
        if (objects.length > 0) {
          await this.client.removeObjects(this.config.bucketName, objects.map(obj => obj.name!));
        }
        await this.client.removeBucket(this.config.bucketName);
        console.log(`Cleaned up test bucket: ${this.config.bucketName}`);
      } catch (error) {
        console.warn('Failed to clean up MinIO bucket:', error);
      }
    }

    if (this.container) {
      await this.container.stop();
      console.log('MinIO test container stopped');
    }
  }

  private async listAllObjects(): Promise<Array<{name: string}>> {
    return new Promise((resolve, reject) => {
      const objects: Array<{name: string}> = [];
      const stream = this.client!.listObjects(this.config.bucketName, '', true);
      
      stream.on('data', (obj: Minio.BucketItem) => {
        if (obj.name) {
          objects.push({name: obj.name});
        }
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(objects));
    });
  }

  getConnectionConfig() {
    if (!this.container) {
      throw new Error('MinIO container not started');
    }

    return {
      endpoint: `http://${this.container.getHost()}:${this.container.getMappedPort(9000)}`,
      accessKeyId: this.config.accessKey,
      secretAccessKey: this.config.secretKey,
      bucket: this.config.bucketName,
      region: this.config.region,
      forcePathStyle: true
    };
  }

  getClient(): Minio.Client {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }
    return this.client;
  }

  async uploadTestData(key: string, data: Buffer | string): Promise<void> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    await this.client.putObject(this.config.bucketName, key, buffer);
  }

  async getTestData(key: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('MinIO client not initialized');
    }

    const stream = await this.client.getObject(this.config.bucketName, key);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}