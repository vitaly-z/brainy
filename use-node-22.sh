#!/bin/bash

# Brainy Node.js Environment Setup
# Ensures Node.js 22.x LTS is used for all operations

echo "🚀 Setting up Brainy environment with Node.js 22.x..."

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if nvm is available
if ! command -v nvm &> /dev/null; then
    echo "❌ NVM is not installed. Please install NVM first."
    echo "Visit: https://github.com/nvm-sh/nvm#installing-and-updating"
    exit 1
fi

# Use Node 22 (reads from .nvmrc)
echo "📦 Switching to Node.js 22..."
nvm use 22

# Verify versions
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "✅ Environment ready!"
echo "   Node.js: $NODE_VERSION"
echo "   npm: $NPM_VERSION"

# Check if versions are correct
if [[ ! "$NODE_VERSION" =~ ^v22\. ]]; then
    echo "⚠️  Warning: Not using Node.js 22.x"
    echo "   Installing Node.js 22 LTS..."
    nvm install 22
    nvm use 22
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo "✅ Installed Node.js $NODE_VERSION with npm $NPM_VERSION"
fi

# Export for child processes
export NODE_VERSION
export NPM_VERSION

# Run any command passed to this script
if [ $# -gt 0 ]; then
    echo "🎯 Running: $@"
    "$@"
else
    echo ""
    echo "💡 Usage:"
    echo "   source use-node-22.sh        # Set up environment"
    echo "   ./use-node-22.sh npm test    # Run command with Node 22"
    echo "   ./use-node-22.sh npm start   # Start server with Node 22"
fi