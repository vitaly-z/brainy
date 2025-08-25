# Brainy 2.0 Augmentation System Refactoring TODO

## Current State
For the 2.0 release, we've marked the old augmentation type system as deprecated but kept it for now to maintain compilation. This document outlines what needs to be refactored for a truly clean 2.0 architecture.

## Files Requiring Major Refactoring

### 1. augmentationFactory.ts
- **Status**: Heavily dependent on old type system
- **Usage**: Only exports used in index.ts, not actually used in codebase
- **Action**: Can be completely removed after migrating any useful patterns to new system

### 2. augmentationPipeline.ts  
- **Status**: Uses old ISenseAugmentation, IConduitAugmentation, etc. types
- **Usage**: Used by brainyData.ts for executing augmentation pipelines
- **Action**: Needs complete rewrite to use unified BrainyAugmentation interface

### 3. augmentationManager.ts
- **Status**: References AugmentationType enum
- **Usage**: Used for managing augmentations
- **Action**: Update to use string-based type identification

### 4. augmentationRegistry.ts
- **Status**: Uses old IAugmentation and AugmentationType
- **Usage**: Central registry for augmentations
- **Action**: Update to use BrainyAugmentation interface

### 5. cortex.ts
- **Status**: Imports old augmentation types
- **Usage**: Advanced augmentation orchestration
- **Action**: Update imports and type references

## Deprecated Types to Remove

All in `src/types/augmentations.ts`:
- `IAugmentation` - Replace with `BrainyAugmentation`
- `AugmentationType` enum - Replace with string literals
- `BrainyAugmentations` namespace - Remove entirely
- Individual type exports (ISenseAugmentation, etc.) - Remove
- `IWebSocketSupport` - Integrate into BrainyAugmentation if needed

## Clean Architecture Goals

1. **Single Interface**: All augmentations implement `BrainyAugmentation`
2. **No Type Enums**: Use string names for augmentation identification
3. **Simplified Factory**: Direct class instantiation instead of factory functions
4. **Unified Pipeline**: Single pipeline system for all augmentations

## Migration Strategy

1. **Phase 1**: (Current) Mark old types as deprecated, maintain compilation
2. **Phase 2**: Rewrite augmentationPipeline.ts to use unified interface
3. **Phase 3**: Update brainyData.ts to use new pipeline
4. **Phase 4**: Remove augmentationFactory.ts entirely
5. **Phase 5**: Remove all deprecated type definitions

## Benefits of Clean Architecture

- Simpler API surface
- Easier to understand and extend
- Better TypeScript type safety
- Reduced bundle size
- Cleaner documentation

## Timeline

This refactoring should be completed before the final 2.0 release to ensure a truly clean architecture.