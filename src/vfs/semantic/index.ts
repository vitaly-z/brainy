/**
 * Semantic VFS - Index
 *
 * Central export point for all semantic VFS components
 */

// Core components
export { SemanticPathParser } from './SemanticPathParser.js'
export type {
  SemanticDimension,
  ParsedSemanticPath,
  RelationshipValue,
  SimilarityValue
} from './SemanticPathParser.js'

export { ProjectionRegistry } from './ProjectionRegistry.js'
export type { ProjectionStrategy } from './ProjectionStrategy.js'
export { BaseProjectionStrategy } from './ProjectionStrategy.js'

export { SemanticPathResolver } from './SemanticPathResolver.js'

// Built-in projections
export { ConceptProjection } from './projections/ConceptProjection.js'
export { AuthorProjection } from './projections/AuthorProjection.js'
export { TemporalProjection } from './projections/TemporalProjection.js'
export { RelationshipProjection } from './projections/RelationshipProjection.js'
export { SimilarityProjection } from './projections/SimilarityProjection.js'
export { TagProjection } from './projections/TagProjection.js'