/**
 * Transaction Operations
 *
 * Re-exports all transactional operations for storage and indexes.
 * These operations provide atomicity with rollback support.
 *
 * @module transaction/operations
 */

// Storage Operations
export {
  SaveNounMetadataOperation,
  SaveNounOperation,
  DeleteNounMetadataOperation,
  SaveVerbMetadataOperation,
  SaveVerbOperation,
  DeleteVerbMetadataOperation,
  UpdateNounMetadataOperation,
  UpdateVerbMetadataOperation
} from './StorageOperations.js'

// Index Operations
export {
  AddToHNSWOperation,
  AddToTypeAwareHNSWOperation,
  RemoveFromHNSWOperation,
  RemoveFromTypeAwareHNSWOperation,
  AddToMetadataIndexOperation,
  RemoveFromMetadataIndexOperation,
  AddToGraphIndexOperation,
  RemoveFromGraphIndexOperation,
  BatchAddToHNSWOperation,
  BatchAddToMetadataIndexOperation
} from './IndexOperations.js'
