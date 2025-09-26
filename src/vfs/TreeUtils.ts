/**
 * VFS Tree Utilities
 * Provides safe tree operations that prevent common recursion issues
 */

import { VFSEntity, VFSDirent } from './types.js'

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  entityId?: string
  children?: TreeNode[]
  metadata?: any
}

export interface TreeOptions {
  maxDepth?: number
  includeHidden?: boolean
  filter?: (node: VFSEntity) => boolean
  sort?: 'name' | 'modified' | 'size'
  expandAll?: boolean
}

/**
 * Tree utility functions for VFS
 * These functions ensure proper tree structure without recursion issues
 */
export class VFSTreeUtils {
  /**
   * Build a safe tree structure from VFS entities
   * Guarantees no directory appears as its own child
   */
  static buildTree(
    entities: VFSEntity[],
    rootPath: string = '/',
    options: TreeOptions = {}
  ): TreeNode {
    const pathToEntity = new Map<string, VFSEntity>()
    const pathToNode = new Map<string, TreeNode>()

    // First pass: index all entities by path
    for (const entity of entities) {
      const path = entity.metadata.path

      // Critical: Skip if entity IS the root we're building from
      if (path === rootPath) {
        continue
      }

      pathToEntity.set(path, entity)
    }

    // Create root node
    const rootNode: TreeNode = {
      name: rootPath === '/' ? 'root' : rootPath.split('/').pop()!,
      path: rootPath,
      type: 'directory',
      children: []
    }
    pathToNode.set(rootPath, rootNode)

    // Second pass: build tree structure
    const sortedPaths = Array.from(pathToEntity.keys()).sort()

    for (const path of sortedPaths) {
      const entity = pathToEntity.get(path)!

      // Apply filter if provided
      if (options.filter && !options.filter(entity)) {
        continue
      }

      // Skip hidden files if requested
      if (!options.includeHidden && entity.metadata.name.startsWith('.')) {
        continue
      }

      // Create node for this entity
      const node: TreeNode = {
        name: entity.metadata.name,
        path: entity.metadata.path,
        type: entity.metadata.vfsType,
        entityId: entity.id,
        metadata: entity.metadata
      }

      if (entity.metadata.vfsType === 'directory') {
        node.children = []
      }

      pathToNode.set(path, node)

      // Find parent and attach
      const parentPath = this.getParentPath(path)
      const parentNode = pathToNode.get(parentPath)

      if (parentNode && parentNode.children) {
        parentNode.children.push(node)
      }
    }

    // Sort children if requested
    if (options.sort) {
      this.sortTreeNodes(rootNode, options.sort)
    }

    // Apply depth limit if specified
    if (options.maxDepth !== undefined) {
      this.limitDepth(rootNode, options.maxDepth)
    }

    return rootNode
  }

  /**
   * Get direct children only - guaranteed no self-inclusion
   */
  static getDirectChildren(
    entities: VFSEntity[],
    parentPath: string
  ): VFSEntity[] {
    const children: VFSEntity[] = []
    const parentDepth = parentPath === '/' ? 0 : parentPath.split('/').length - 1

    for (const entity of entities) {
      const path = entity.metadata.path

      // Critical check 1: Skip if this IS the parent
      if (path === parentPath) {
        continue
      }

      // Check if entity is a direct child
      if (path.startsWith(parentPath)) {
        const relativePath = parentPath === '/'
          ? path.substring(1)
          : path.substring(parentPath.length + 1)

        // Direct child has no additional slashes
        if (!relativePath.includes('/')) {
          children.push(entity)
        }
      }
    }

    return children
  }

  /**
   * Get all descendants (recursive children)
   */
  static getDescendants(
    entities: VFSEntity[],
    ancestorPath: string,
    includeAncestor: boolean = false
  ): VFSEntity[] {
    const descendants: VFSEntity[] = []

    for (const entity of entities) {
      const path = entity.metadata.path

      // Include ancestor only if explicitly requested
      if (path === ancestorPath) {
        if (includeAncestor) {
          descendants.push(entity)
        }
        continue
      }

      // Check if entity is under ancestor path
      const prefix = ancestorPath === '/' ? '/' : ancestorPath + '/'
      if (path.startsWith(prefix)) {
        descendants.push(entity)
      }
    }

    return descendants
  }

  /**
   * Flatten a tree structure back to a list
   */
  static flattenTree(node: TreeNode): TreeNode[] {
    const result: TreeNode[] = [node]

    if (node.children) {
      for (const child of node.children) {
        result.push(...this.flattenTree(child))
      }
    }

    return result
  }

  /**
   * Find a node in the tree by path
   */
  static findNode(root: TreeNode, targetPath: string): TreeNode | null {
    if (root.path === targetPath) {
      return root
    }

    if (root.children) {
      for (const child of root.children) {
        const found = this.findNode(child, targetPath)
        if (found) return found
      }
    }

    return null
  }

  /**
   * Calculate tree statistics
   */
  static getTreeStats(node: TreeNode): {
    totalNodes: number
    files: number
    directories: number
    maxDepth: number
    totalSize?: number
  } {
    let stats = {
      totalNodes: 0,
      files: 0,
      directories: 0,
      maxDepth: 0,
      totalSize: 0
    }

    function traverse(n: TreeNode, depth: number) {
      stats.totalNodes++
      stats.maxDepth = Math.max(stats.maxDepth, depth)

      if (n.type === 'file') {
        stats.files++
        if (n.metadata?.size) {
          stats.totalSize += n.metadata.size
        }
      } else {
        stats.directories++
      }

      if (n.children) {
        for (const child of n.children) {
          traverse(child, depth + 1)
        }
      }
    }

    traverse(node, 0)
    return stats
  }

  // Helper methods

  private static getParentPath(path: string): string {
    if (path === '/') return '/'
    const parts = path.split('/')
    parts.pop()
    return parts.length === 1 ? '/' : parts.join('/')
  }

  private static sortTreeNodes(node: TreeNode, sortBy: 'name' | 'modified' | 'size'): void {
    if (!node.children) return

    node.children.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'modified':
          const aTime = a.metadata?.modified || 0
          const bTime = b.metadata?.modified || 0
          return bTime - aTime
        case 'size':
          const aSize = a.metadata?.size || 0
          const bSize = b.metadata?.size || 0
          return bSize - aSize
        default:
          return 0
      }
    })

    // Recursively sort children
    for (const child of node.children) {
      this.sortTreeNodes(child, sortBy)
    }
  }

  private static limitDepth(node: TreeNode, maxDepth: number, currentDepth: number = 0): void {
    if (currentDepth >= maxDepth) {
      delete node.children
      return
    }

    if (node.children) {
      for (const child of node.children) {
        this.limitDepth(child, maxDepth, currentDepth + 1)
      }
    }
  }

  /**
   * Validate tree structure - ensures no recursion
   */
  static validateTree(node: TreeNode, visited: Set<string> = new Set()): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check for cycles
    if (visited.has(node.path)) {
      errors.push(`Cycle detected at path: ${node.path}`)
      return { valid: false, errors }
    }

    visited.add(node.path)

    // Check children
    if (node.children) {
      const childPaths = new Set<string>()

      for (const child of node.children) {
        // Check for duplicate children
        if (childPaths.has(child.path)) {
          errors.push(`Duplicate child path: ${child.path}`)
        }
        childPaths.add(child.path)

        // Check child is not parent
        if (child.path === node.path) {
          errors.push(`Directory contains itself: ${node.path}`)
        }

        // Check child is actually under parent
        if (node.path !== '/' && !child.path.startsWith(node.path + '/')) {
          errors.push(`Child ${child.path} not under parent ${node.path}`)
        }

        // Recursively validate children
        const childValidation = this.validateTree(child, new Set(visited))
        errors.push(...childValidation.errors)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}