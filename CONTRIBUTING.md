# Contributing to Brainy

Thank you for your interest in contributing to Brainy! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Issues

Before creating an issue, please check existing issues to avoid duplicates.

When creating an issue, include:
- Clear, descriptive title
- Detailed description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node version, Brainy version)
- Code examples if applicable

### Suggesting Features

Feature requests are welcome! Please provide:
- Clear use case
- Proposed API/interface
- Examples of how it would work
- Any potential challenges or considerations

### Pull Requests

#### Before Starting

1. Check existing issues and PRs
2. Open an issue to discuss significant changes
3. Fork the repository
4. Create a feature branch from `main`

#### Development Setup

**Quick Setup (Recommended):**
```bash
# Clone your fork
git clone https://github.com/your-username/brainy.git
cd brainy

# Run setup script (installs all dependencies including Rust)
./scripts/setup-dev.sh
```

**Manual Setup:**
```bash
# Clone your fork
git clone https://github.com/your-username/brainy.git
cd brainy

# Install system dependencies (Ubuntu/Debian)
sudo apt-get install -y build-essential pkg-config libssl-dev

# Install Rust (for WASM embedding engine)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Install Node.js dependencies
npm install

# Build Candle WASM embedding engine
npm run build:candle

# Build TypeScript
npm run build

# Run tests
npm test
```

#### Making Changes

1. **Follow the code style**
   - TypeScript for all source code
   - Clear variable and function names
   - Comments for complex logic
   - JSDoc for public APIs

2. **Write tests**
   - Add tests for new features
   - Update tests for changes
   - Ensure all tests pass

3. **Update documentation**
   - Update README if needed
   - Add/update API documentation
   - Include examples

#### Commit Guidelines

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `chore`: Build/tooling changes

Examples:
```bash
feat(triple): add graph traversal depth limit
fix(storage): handle concurrent write conflicts
docs(api): update search method documentation
```

#### Submitting PR

1. Push to your fork
2. Create PR against `main` branch
3. Fill out PR template
4. Ensure CI checks pass
5. Wait for review

### Testing

#### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/core.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

#### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { Brainy } from '../src'

describe('Feature Name', () => {
  it('should do something specific', async () => {
    const brain = new Brainy()
    await brain.init()
    
    // Test implementation
    const result = await brain.search("test")
    
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })
})
```

## Architecture Guidelines

### Adding New Features

1. **Check existing functionality**
   - Review `ARCHITECTURE.md`
   - Check if similar features exist
   - Consider if it should be an augmentation

2. **Design considerations**
   - Maintain backward compatibility
   - Consider performance impact
   - Think about all storage adapters
   - Plan for extensibility

3. **Implementation checklist**
   - [ ] Core functionality
   - [ ] Tests (unit and integration)
   - [ ] Documentation
   - [ ] TypeScript types
   - [ ] Examples
   - [ ] Performance benchmarks (if applicable)

### Creating Augmentations

Augmentations extend Brainy's functionality:

```typescript
import { BrainyAugmentation } from '../types'

export class MyAugmentation extends BrainyAugmentation {
  name = 'MyAugmentation'
  
  async onInit(brain: Brainy): Promise<void> {
    // Initialize augmentation
  }
  
  async onAdd(item: any, brain: Brainy): Promise<any> {
    // Process before adding
    return item
  }
  
  async onSearch(query: any, results: any[], brain: Brainy): Promise<any[]> {
    // Process search results
    return results
  }
}
```

### Performance Considerations

- Use batch operations where possible
- Implement caching strategically
- Consider memory usage
- Profile performance impacts
- Add benchmarks for critical paths

## Documentation

### API Documentation

Use JSDoc for all public APIs:

```typescript
/**
 * Searches for similar items using vector similarity
 * @param query - Search query (text or vector)
 * @param options - Search options
 * @returns Array of search results with scores
 * @example
 * ```typescript
 * const results = await brain.search("machine learning", { limit: 10 })
 * ```
 */
async search(query: string | Vector, options?: SearchOptions): Promise<SearchResult[]> {
  // Implementation
}
```

### Examples

Add examples for new features:

```typescript
// examples/feature-name.ts
import { Brainy } from 'brainy'

async function exampleUsage() {
  const brain = new Brainy()
  await brain.init()
  
  // Show feature usage
  // Include comments explaining what's happening
  // Handle errors appropriately
}

exampleUsage().catch(console.error)
```

## Release Process

1. **Version bump**: Follow semantic versioning
2. **Update CHANGELOG**: Document all changes
3. **Run tests**: Ensure all tests pass
4. **Build**: Generate distribution files
5. **Tag**: Create git tag for version
6. **Publish**: Release to npm

## Getting Help

- **Discord**: Join our community
- **Issues**: Ask questions on GitHub
- **Discussions**: Share ideas and get feedback

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- README.md contributors section
- GitHub contributors page

Thank you for contributing to Brainy! 🧠