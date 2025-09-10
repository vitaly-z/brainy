# Augmentation Configuration System

**Version**: 2.0.0  
**Status**: Production Ready

## Overview

The Brainy Augmentation Configuration System provides a VSCode-style extension architecture with multiple configuration sources, schema validation, and tool discovery. This system maintains Brainy's zero-config philosophy while enabling sophisticated enterprise configuration management.

## Table of Contents
- [Quick Start](#quick-start)
- [Configuration Sources](#configuration-sources)
- [Creating Configurable Augmentations](#creating-configurable-augmentations)
- [Configuration Discovery](#configuration-discovery)
- [Runtime Configuration](#runtime-configuration)
- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [CLI Commands](#cli-commands)
- [Tool Integration](#tool-integration)
- [Migration Guide](#migration-guide)

## Quick Start

### Using an Augmentation with Configuration

```typescript
import { BrainyData } from '@soulcraft/brainy'
import { WALAugmentation } from '@soulcraft/brainy/augmentations'

// Zero-config (uses defaults)
const brain = new BrainyData()
brain.augmentations.register(new WALAugmentation())

// With custom configuration
brain.augmentations.register(new WALAugmentation({
  immediateWrites: true,
  checkpointInterval: 300000 // 5 minutes
}))
```

### Configuring via Environment Variables

```bash
export BRAINY_AUG_WAL_ENABLED=true
export BRAINY_AUG_WAL_MAX_SIZE=20971520
export BRAINY_AUG_CACHE_TTL=600000
```

### Configuring via Files

Create a `.brainyrc` file in your project root:

```json
{
  "augmentations": {
    "wal": {
      "enabled": true,
      "immediateWrites": true,
      "maxSize": 20971520
    },
    "cache": {
      "ttl": 600000,
      "maxSize": 2000
    }
  }
}
```

## Configuration Sources

Configuration is resolved in the following priority order (highest to lowest):

1. **Runtime Updates** - Dynamic configuration changes via API
2. **Constructor Parameters** - Code-time configuration
3. **Environment Variables** - `BRAINY_AUG_<NAME>_<KEY>`
4. **Configuration Files** - `.brainyrc`, `brainy.config.json`
5. **Schema Defaults** - Default values from manifest

### Resolution Example

```typescript
// Schema default
{ maxSize: 10485760 }

// File configuration (.brainyrc)
{ maxSize: 20971520 }

// Environment variable
BRAINY_AUG_WAL_MAX_SIZE=31457280

// Constructor parameter
new WALAugmentation({ maxSize: 41943040 })

// Final resolved value: 41943040 (constructor wins)
```

## Creating Configurable Augmentations

### Step 1: Extend ConfigurableAugmentation

```typescript
import { ConfigurableAugmentation, AugmentationManifest } from '@soulcraft/brainy'

export class MyAugmentation extends ConfigurableAugmentation {
  name = 'my-augmentation'
  timing = 'around' as const
  metadata = 'none' as const
  operations = ['search', 'add']
  priority = 50
  
  constructor(config?: MyConfig) {
    super(config) // Handles configuration resolution
  }
  
  // Required: Provide manifest for discovery
  getManifest(): AugmentationManifest {
    return {
      id: 'my-augmentation',
      name: 'My Augmentation',
      version: '1.0.0',
      description: 'Does something amazing',
      category: 'performance',
      configSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable this augmentation'
          },
          threshold: {
            type: 'number',
            default: 100,
            minimum: 1,
            maximum: 1000,
            description: 'Processing threshold'
          }
        }
      }
    }
  }
  
  // Optional: Handle runtime configuration changes
  protected async onConfigChange(newConfig: MyConfig, oldConfig: MyConfig): Promise<void> {
    if (newConfig.threshold !== oldConfig.threshold) {
      // React to threshold change
      this.updateThreshold(newConfig.threshold)
    }
  }
  
  async execute<T>(operation: string, params: any, next: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return next()
    }
    
    // Your augmentation logic here
    return next()
  }
}
```

### Step 2: Define Configuration Interface

```typescript
interface MyConfig {
  enabled?: boolean
  threshold?: number
  mode?: 'fast' | 'balanced' | 'thorough'
}
```

### Step 3: Add JSON Schema in Manifest

```typescript
configSchema: {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enable augmentation'
    },
    threshold: {
      type: 'number',
      default: 100,
      minimum: 1,
      maximum: 1000,
      description: 'Processing threshold'
    },
    mode: {
      type: 'string',
      default: 'balanced',
      enum: ['fast', 'balanced', 'thorough'],
      description: 'Processing mode'
    }
  },
  required: [],
  additionalProperties: false
}
```

## Configuration Discovery

The Discovery API allows tools to discover and configure augmentations dynamically:

```typescript
import { AugmentationDiscovery } from '@soulcraft/brainy'

const discovery = new AugmentationDiscovery(brain.augmentations)

// Discover all augmentations with manifests
const listings = await discovery.discover({
  includeConfig: true,
  includeSchema: true
})

// Get configuration schema
const schema = await discovery.getConfigSchema('wal')

// Validate configuration
const validation = await discovery.validateConfig('wal', {
  enabled: true,
  maxSize: 'invalid' // Will fail validation
})

// Update configuration at runtime
await discovery.updateConfig('wal', {
  checkpointInterval: 120000
})
```

## Runtime Configuration

### Update Configuration Dynamically

```typescript
// Get augmentation
const wal = brain.augmentations.get('wal')

// Update configuration
await wal.updateConfig({
  checkpointInterval: 300000
})

// Get current configuration
const config = wal.getConfig()
```

### React to Configuration Changes

```typescript
class MyAugmentation extends ConfigurableAugmentation {
  protected async onConfigChange(newConfig: any, oldConfig: any): Promise<void> {
    // Stop old processes
    if (oldConfig.enabled && !newConfig.enabled) {
      await this.stop()
    }
    
    // Start new processes
    if (!oldConfig.enabled && newConfig.enabled) {
      await this.start()
    }
    
    // Update settings
    if (newConfig.interval !== oldConfig.interval) {
      this.rescheduleTimer(newConfig.interval)
    }
  }
}
```

## Environment Variables

### Naming Convention

```bash
BRAINY_AUG_<AUGMENTATION_ID>_<CONFIG_KEY>=value
```

### Examples

```bash
# WAL augmentation
BRAINY_AUG_WAL_ENABLED=true
BRAINY_AUG_WAL_IMMEDIATE_WRITES=true
BRAINY_AUG_WAL_MAX_SIZE=20971520
BRAINY_AUG_WAL_CHECKPOINT_INTERVAL=300000

# Cache augmentation
BRAINY_AUG_CACHE_ENABLED=true
BRAINY_AUG_CACHE_MAX_SIZE=2000
BRAINY_AUG_CACHE_TTL=600000

# Complex values (JSON)
BRAINY_AUG_MYAUG_FILTERS='["*.js","*.ts"]'
BRAINY_AUG_MYAUG_OPTIONS='{"deep":true,"follow":false}'
```

### Docker Example

```dockerfile
ENV BRAINY_AUG_WAL_ENABLED=true
ENV BRAINY_AUG_WAL_MAX_SIZE=52428800
ENV BRAINY_AUG_CACHE_TTL=600000
```

## Configuration Files

### File Locations (Priority Order)

1. `.brainyrc` (current directory)
2. `.brainyrc.json` (current directory)
3. `brainy.config.json` (current directory)
4. `~/.brainy/config.json` (user home)
5. `~/.brainyrc` (user home)

### File Format

```json
{
  "augmentations": {
    "wal": {
      "enabled": true,
      "immediateWrites": true,
      "maxSize": 20971520,
      "checkpointInterval": 300000
    },
    "cache": {
      "enabled": true,
      "maxSize": 2000,
      "ttl": 600000
    },
    "metrics": {
      "enabled": false
    }
  }
}
```

### Per-Environment Configuration

```json
{
  "augmentations": {
    "wal": {
      "development": {
        "enabled": true,
        "immediateWrites": true,
        "maxSize": 5242880
      },
      "production": {
        "enabled": true,
        "immediateWrites": false,
        "maxSize": 104857600,
        "checkpointInterval": 60000
      }
    }
  }
}
```

## CLI Commands

### List Augmentations with Configuration

```bash
# Show all augmentations with config status
brainy augment list --detailed

# Show configuration for specific augmentation
brainy augment config wal

# Set configuration value
brainy augment config wal --set immediateWrites=true

# Show environment variable names
brainy augment config wal --env

# Export configuration schema
brainy augment schema wal > wal-schema.json

# Validate configuration file
brainy augment validate --file config.json
```

### Interactive Configuration

```bash
# Interactive configuration wizard
brainy augment configure wal

? Enable write-ahead logging? (Y/n) Y
? Operation mode? 
  ❯ Performance (immediate writes)
    Durability (synchronous writes)
    Custom
? Maximum log size? (10MB) 20MB
? Checkpoint interval? (1 minute) 5 minutes

Configuration saved to .brainyrc
```

## Tool Integration

### Brain-Cloud Explorer UI

```typescript
// Auto-generate configuration form from schema
const ConfigurationUI = ({ augmentationId }) => {
  const [manifest, setManifest] = useState(null)
  const [config, setConfig] = useState({})
  
  useEffect(() => {
    // Fetch manifest with schema
    fetch(`/api/augmentations/${augmentationId}/manifest`)
      .then(res => res.json())
      .then(setManifest)
    
    // Get current configuration
    discovery.getConfig(augmentationId)
      .then(setConfig)
  }, [augmentationId])
  
  const handleSave = async (newConfig) => {
    // Validate configuration
    const validation = await fetch(`/api/augmentations/${augmentationId}/validate`, {
      method: 'POST',
      body: JSON.stringify(newConfig)
    }).then(res => res.json())
    
    if (validation.valid) {
      // Apply configuration
      await discovery.updateConfig(augmentationId, newConfig)
    }
  }
  
  // Render form based on schema
  return <SchemaForm 
    schema={manifest?.configSchema}
    values={config}
    onSubmit={handleSave}
  />
}
```

### VS Code Extension

```json
// package.json contribution points
{
  "contributes": {
    "configuration": {
      "title": "Brainy Augmentations",
      "properties": {
        "brainy.augmentations.wal.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable write-ahead logging"
        },
        "brainy.augmentations.wal.maxSize": {
          "type": "number",
          "default": 10485760,
          "description": "Maximum WAL file size in bytes"
        }
      }
    }
  }
}
```

## Migration Guide

### Migrating from BaseAugmentation

**Before:**
```typescript
export class MyAugmentation extends BaseAugmentation {
  constructor(config: MyConfig = {}) {
    super()
    this.config = {
      enabled: config.enabled ?? true,
      threshold: config.threshold ?? 100
    }
  }
  
  // No manifest
  // No config discovery
  // No runtime updates
}
```

**After:**
```typescript
export class MyAugmentation extends ConfigurableAugmentation {
  constructor(config?: MyConfig) {
    super(config) // Config resolution handled automatically
  }
  
  getManifest(): AugmentationManifest {
    return {
      id: 'my-augmentation',
      name: 'My Augmentation',
      version: '1.0.0',
      description: 'Does something amazing',
      category: 'performance',
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          threshold: { type: 'number', default: 100 }
        }
      }
    }
  }
  
  // Optional: Handle config changes
  protected async onConfigChange(newConfig: MyConfig, oldConfig: MyConfig): Promise<void> {
    // React to changes
  }
}
```

### Backwards Compatibility

The system maintains full backwards compatibility:

1. **BaseAugmentation still works** - Existing augmentations continue to function
2. **Constructor config still works** - Existing configuration patterns preserved
3. **Zero-config still works** - Defaults are applied automatically
4. **Progressive enhancement** - Add features as needed

## Best Practices

### 1. Always Provide Defaults

```typescript
configSchema: {
  properties: {
    enabled: {
      type: 'boolean',
      default: true, // Always provide defaults
      description: 'Enable this feature'
    }
  }
}
```

### 2. Use Descriptive Configuration Keys

```typescript
// Good
checkpointInterval: 60000

// Bad
ci: 60000
```

### 3. Validate Configuration

```typescript
protected async onConfigChange(newConfig: any, oldConfig: any): Promise<void> {
  // Validate before applying
  if (newConfig.maxSize < 1048576) {
    throw new Error('maxSize must be at least 1MB')
  }
  
  // Apply changes
  this.maxSize = newConfig.maxSize
}
```

### 4. Document Environment Variables

```typescript
/**
 * Environment Variables:
 * - BRAINY_AUG_MYAUG_ENABLED: Enable augmentation (boolean)
 * - BRAINY_AUG_MYAUG_THRESHOLD: Processing threshold (number)
 * - BRAINY_AUG_MYAUG_MODE: Processing mode (fast|balanced|thorough)
 */
```

### 5. Provide Configuration Examples

```typescript
configExamples: [
  {
    name: 'Production',
    description: 'Optimized for production use',
    config: {
      enabled: true,
      mode: 'thorough',
      threshold: 500
    }
  },
  {
    name: 'Development',
    description: 'Lightweight for development',
    config: {
      enabled: true,
      mode: 'fast',
      threshold: 10
    }
  }
]
```

## Troubleshooting

### Configuration Not Loading

1. Check file locations and names
2. Verify JSON syntax in config files
3. Check environment variable names (case-sensitive)
4. Use `brainy augment config <name> --debug` to see resolution

### Validation Errors

1. Check schema requirements
2. Verify data types match schema
3. Check minimum/maximum constraints
4. Use discovery API to validate before applying

### Runtime Updates Not Working

1. Ensure augmentation extends ConfigurableAugmentation
2. Implement onConfigChange if needed
3. Check for validation errors
4. Verify augmentation is initialized

## API Reference

See the [Discovery API Documentation](./discovery-api.md) for complete API details.

## Examples

See the [examples directory](../../examples/augmentation-config/) for complete working examples.