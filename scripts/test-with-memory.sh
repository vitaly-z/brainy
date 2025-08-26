#!/bin/bash

# Run tests with adequate memory for transformer models
echo "🧠 Running Brainy tests with 8GB heap allocation"
echo "This is required for the transformer model (ONNX runtime)"
echo "================================================"

# Set memory allocation
export NODE_OPTIONS='--max-old-space-size=8192'

# Run tests based on argument
if [ "$1" = "single" ]; then
  echo "Running tests sequentially (memory-safe)..."
  npx vitest run --pool=forks --poolOptions.forks.maxForks=1 --reporter=dot
elif [ "$1" = "quick" ]; then
  echo "Running quick test..."
  node test-quick.js
elif [ "$1" = "core" ]; then
  echo "Running core tests only..."
  npx vitest run tests/core.test.ts --reporter=verbose
else
  echo "Running full test suite..."
  echo "Note: This requires 8GB+ RAM available"
  npm test
fi

echo ""
echo "Test complete. Memory was allocated at 8GB for ONNX runtime."