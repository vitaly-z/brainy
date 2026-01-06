#!/bin/bash
# Development environment setup script for Brainy
#
# This script installs all dependencies needed to build Brainy,
# including the Candle WASM embedding engine.
#
# Usage:
#   ./scripts/setup-dev.sh
#
# Requirements:
#   - sudo access (for system packages)
#   - Internet connection

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Brainy Development Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &> /dev/null; then
            echo "debian"
        elif command -v dnf &> /dev/null; then
            echo "fedora"
        elif command -v pacman &> /dev/null; then
            echo "arch"
        else
            echo "linux-unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${GREEN}Detected OS: ${OS}${NC}"

# Install system dependencies
install_system_deps() {
    echo -e "\n${YELLOW}Installing system dependencies...${NC}"

    case $OS in
        debian)
            sudo apt-get update
            sudo apt-get install -y build-essential pkg-config libssl-dev curl
            ;;
        fedora)
            sudo dnf install -y gcc gcc-c++ make openssl-devel pkgconfig curl
            ;;
        arch)
            sudo pacman -S --needed base-devel openssl pkg-config curl
            ;;
        macos)
            if ! command -v gcc &> /dev/null; then
                echo -e "${YELLOW}Installing Xcode command line tools...${NC}"
                xcode-select --install 2>/dev/null || true
            fi
            ;;
        *)
            echo -e "${RED}Unknown OS. Please install build tools manually:${NC}"
            echo "  - C compiler (gcc or clang)"
            echo "  - pkg-config"
            echo "  - OpenSSL development headers"
            exit 1
            ;;
    esac

    echo -e "${GREEN}System dependencies installed.${NC}"
}

# Install Rust
install_rust() {
    echo -e "\n${YELLOW}Checking Rust installation...${NC}"

    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        echo -e "${GREEN}Rust already installed: ${RUST_VERSION}${NC}"
    else
        echo -e "${YELLOW}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        echo -e "${GREEN}Rust installed: $(rustc --version)${NC}"
    fi

    # Ensure cargo env is loaded
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
}

# Install Rust WASM tools
install_wasm_tools() {
    echo -e "\n${YELLOW}Installing WASM build tools...${NC}"

    # Add WASM target
    if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
        echo "Adding wasm32-unknown-unknown target..."
        rustup target add wasm32-unknown-unknown
    else
        echo -e "${GREEN}WASM target already installed.${NC}"
    fi

    # Install wasm-pack
    if ! command -v wasm-pack &> /dev/null; then
        echo "Installing wasm-pack..."
        cargo install wasm-pack
    else
        echo -e "${GREEN}wasm-pack already installed: $(wasm-pack --version)${NC}"
    fi
}

# Install Node.js dependencies
install_node_deps() {
    echo -e "\n${YELLOW}Checking Node.js...${NC}"

    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js not found. Please install Node.js 20+ first.${NC}"
        echo "Visit: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    echo -e "${GREEN}Node.js: ${NODE_VERSION}${NC}"

    echo -e "\n${YELLOW}Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}npm dependencies installed.${NC}"
}

# Download model files
download_models() {
    echo -e "\n${YELLOW}Downloading model files...${NC}"

    MODEL_DIR="assets/models/all-MiniLM-L6-v2"

    if [ -f "$MODEL_DIR/model.safetensors" ] && [ -f "$MODEL_DIR/tokenizer.json" ]; then
        echo -e "${GREEN}Model files already present.${NC}"
        return
    fi

    mkdir -p "$MODEL_DIR"

    HF_URL="https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main"

    echo "Downloading model.safetensors..."
    curl -L "$HF_URL/model.safetensors" -o "$MODEL_DIR/model.safetensors"

    echo "Downloading tokenizer.json..."
    curl -L "$HF_URL/tokenizer.json" -o "$MODEL_DIR/tokenizer.json"

    echo "Downloading config.json..."
    curl -L "$HF_URL/config.json" -o "$MODEL_DIR/config.json"

    echo -e "${GREEN}Model files downloaded.${NC}"
}

# Build Candle WASM
build_candle() {
    echo -e "\n${YELLOW}Building Candle WASM...${NC}"

    if [ -f "src/embeddings/wasm/pkg/candle_embeddings_bg.wasm" ]; then
        echo -e "${GREEN}Candle WASM already built. Use 'npm run build:candle' to rebuild.${NC}"
        return
    fi

    npm run build:candle
    echo -e "${GREEN}Candle WASM built.${NC}"
}

# Build TypeScript
build_typescript() {
    echo -e "\n${YELLOW}Building TypeScript...${NC}"
    npm run build
    echo -e "${GREEN}TypeScript built.${NC}"
}

# Run tests
run_tests() {
    echo -e "\n${YELLOW}Running tests...${NC}"
    npm run test:unit
    echo -e "${GREEN}Tests passed.${NC}"
}

# Main
main() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    cd "$PROJECT_ROOT"

    install_system_deps
    install_rust
    install_wasm_tools
    install_node_deps
    download_models
    build_candle
    build_typescript

    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  Setup Complete!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo "You can now:"
    echo "  npm run build          # Build TypeScript"
    echo "  npm run build:candle   # Rebuild Candle WASM"
    echo "  npm run test:all       # Run all tests"
    echo "  npm run test:wasm      # Test WASM embeddings"
    echo "  npm run test:bun:compile  # Test Bun compile"
    echo ""
}

main "$@"
