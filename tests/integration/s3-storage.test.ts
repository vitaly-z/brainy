import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Brainy } from '../../src/brainy';
import { MinioTestServer } from '../helpers/minio-server';
import { NounType } from '../../src/types/graphTypes';

describe('S3 Storage Integration', () => {
  let minioServer: MinioTestServer;
  let s3Config: any;

  beforeAll(async () => {
    // Start MinIO test server
    minioServer = new MinioTestServer({
      bucketName: 'test-brainy-bucket'
    });
    await minioServer.start();
    s3Config = minioServer.getConnectionConfig();
  });

  afterAll(async () => {
    if (minioServer) {
      await minioServer.stop();
    }
  });

  describe('Basic S3 Operations', () => {
    let brain: Brainy;

    beforeAll(async () => {
      brain = new Brainy({
        storage: {
          type: 's3',
          options: {
            bucket: s3Config.bucket,
            region: s3Config.region,
            endpoint: s3Config.endpoint,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            forcePathStyle: true
          }
        }
      });
      await brain.init();
    });

    afterAll(async () => {
      if (brain) {
        await brain.close();
      }
    });

    it('should store and retrieve items from S3', async () => {
      const id = await brain.add({
        data: 'Test item for S3 storage',
        type: NounType.Document,
        metadata: { source: 's3-test' }
      });
      expect(id).toBeDefined();

      const retrieved = await brain.get(id);
      expect(retrieved).toBeDefined();
      // Content is stored in metadata, not data property
      expect(retrieved?.metadata?.content).toBe('Test item for S3 storage');
      expect(retrieved?.metadata?.source).toBe('s3-test');
    });

    it('should handle batch operations', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        data: `S3 batch item ${i}`,
        type: NounType.Document,
        metadata: { index: i }
      }));

      const result = await brain.addMany({ items });
      expect(result.successful).toHaveLength(10);
      expect(result.failed).toHaveLength(0);

      // Get items individually since getBatch doesn't exist
      for (const id of result.successful) {
        const item = await brain.get(id);
        expect(item).toBeDefined();
      }
    });

    it('should delete items from S3', async () => {
      const id = await brain.add({
        data: 'Item to delete',
        type: NounType.Document,
        metadata: {}
      });

      const deleted = await brain.delete(id);
      expect(deleted).toBe(true);

      const retrieved = await brain.get(id);
      expect(retrieved).toBeNull();
    });

    it('should update items in S3', async () => {
      const id = await brain.add({
        data: 'Original text',
        type: NounType.Document,
        metadata: { version: 1 }
      });

      await brain.update({
        id,
        data: 'Updated text',
        metadata: { version: 2 }
      });

      const retrieved = await brain.get(id);
      // Content is stored in metadata, not data property
      expect(retrieved?.metadata?.content).toBe('Updated text');
      expect(retrieved?.metadata?.version).toBe(2);
    });

    it('should handle search operations with S3 backend', async () => {
      // Add test data
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await brain.add({
          data: `Search test item ${i}`,
          type: NounType.Document,
          metadata: { category: i % 2 === 0 ? 'even' : 'odd' }
        });
        ids.push(id);
      }

      // Search by query
      const results = await brain.find({
        query: 'Search test item',
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.metadata?.content).toContain('Search test item');

      // Search with metadata filter
      const evenResults = await brain.find({
        query: 'Search test item',
        where: { category: 'even' },
        limit: 10
      });

      expect(evenResults.length).toBeGreaterThan(0);
      evenResults.forEach(result => {
        expect(result.entity.metadata?.category).toBe('even');
      });

      // Similar search
      const similarResults = await brain.similar({
        to: ids[0],
        limit: 5
      });

      expect(similarResults.length).toBeGreaterThan(0);
      expect(similarResults[0].id).toBe(ids[0]); // Most similar should be itself
    });
  });

  describe('S3 with Custom Prefix', () => {
    let prefixedBrain: Brainy;

    beforeAll(async () => {
      prefixedBrain = new Brainy({
        storage: {
          type: 's3',
          options: {
            bucket: s3Config.bucket,
            prefix: 'test-prefix/',
            region: s3Config.region,
            endpoint: s3Config.endpoint,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            forcePathStyle: true
          }
        }
      });
      await prefixedBrain.init();
    });

    afterAll(async () => {
      if (prefixedBrain) {
        await prefixedBrain.close();
      }
    });

    it('should store items with prefix in S3', async () => {
      const id = await prefixedBrain.add({
        data: 'Prefixed item',
        type: NounType.Document,
        metadata: {}
      });

      const retrieved = await prefixedBrain.get(id);
      // Content is stored in metadata, not data property
      expect(retrieved?.metadata?.content).toBe('Prefixed item');
    });
  });

  describe('S3 Error Handling', () => {
    it('should handle invalid S3 credentials gracefully', async () => {
      const invalidBrain = new Brainy({
        storage: {
          type: 's3',
          options: {
            bucket: 'invalid-bucket',
            region: 'us-east-1',
            accessKeyId: 'invalid',
            secretAccessKey: 'invalid'
          }
        }
      });

      try {
        await invalidBrain.init();
        await invalidBrain.add({
          data: 'Test',
          type: NounType.Document
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await invalidBrain.close();
      }
    });

    it('should handle network errors gracefully', async () => {
      // Simulate network error by stopping MinIO temporarily
      await minioServer.stop();

      const brain = new Brainy({
        storage: {
          type: 's3',
          options: s3Config
        }
      });

      try {
        await brain.init();
        await brain.add({
          data: 'Test',
          type: NounType.Document
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await brain.close();
        // Restart MinIO for other tests
        await minioServer.start();
      }
    });
  });

  describe('S3 Performance', () => {
    let perfBrain: Brainy;

    beforeAll(async () => {
      perfBrain = new Brainy({
        storage: {
          type: 's3',
          options: {
            bucket: s3Config.bucket,
            region: s3Config.region,
            endpoint: s3Config.endpoint,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            forcePathStyle: true
          }
        }
      });
      await perfBrain.init();
    });

    afterAll(async () => {
      if (perfBrain) {
        await perfBrain.close();
      }
    });

    it('should handle large batches efficiently', async () => {
      const startTime = Date.now();
      const items = Array.from({ length: 100 }, (_, i) => ({
        data: `Large batch item ${i}`,
        type: NounType.Document,
        metadata: { index: i }
      }));

      const result = await perfBrain.addMany({ 
        items,
        chunkSize: 25 
      });
      
      const duration = Date.now() - startTime;

      expect(result.successful.length).toBe(100);
      expect(result.failed.length).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should support concurrent operations', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => 
        perfBrain.add({
          data: `Concurrent item ${i}`,
          type: NounType.Document,
          metadata: { index: i }
        })
      );

      const ids = await Promise.all(operations);
      expect(ids).toHaveLength(20);
      expect(new Set(ids).size).toBe(20); // All IDs should be unique
    });
  });
});