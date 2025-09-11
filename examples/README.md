# Brainy Examples

This directory contains example code and test scripts for Brainy.

## Structure

- `demo.ts` - Basic demonstration of Brainy's core features
- `tests/` - Various test scripts demonstrating different aspects of Brainy
  - Performance tests
  - Memory tests
  - Storage adapter tests
  - API functionality tests
  - CLI tests

## Running Examples

### Basic Demo
```bash
npm run build
node dist/examples/demo.js
```

### Test Scripts
The scripts in `tests/` are standalone Node.js scripts that can be run directly:

```bash
node examples/tests/test-simple.js
node examples/tests/test-core-functionality.js
```

## Note
These are examples and test scripts for reference. For production use, see the main documentation in the project root.