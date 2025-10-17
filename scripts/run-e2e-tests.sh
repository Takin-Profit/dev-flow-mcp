#!/usr/bin/env bash

# E2E Test Runner for DevFlow MCP
# SQLite-only - no external services needed!

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "    DevFlow MCP E2E Test Runner"
    echo "=========================================="
    echo ""

    print_info "Building project..."
    if pnpm run build > /dev/null 2>&1; then
        print_success "Project built successfully"
    else
        print_error "Build failed"
        exit 1
    fi

    print_info "Running e2e tests..."
    echo ""

    export DFM_ENV=testing
    export TEST_INTEGRATION=true
    export DFM_SQLITE_LOCATION=":memory:"

    # Run all e2e tests using Node.js test runner
    if node --test src/tests/integration/e2e/*.test.js; then
        echo ""
        print_success "All e2e tests passed!"
        echo ""
        echo "=========================================="
        print_success "E2E tests completed successfully!"
        echo "=========================================="
        echo ""
        exit 0
    else
        echo ""
        print_error "Some e2e tests failed"
        echo ""
        echo "=========================================="
        print_error "E2E tests failed"
        echo "=========================================="
        echo ""
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --help    Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DFM_SQLITE_LOCATION    SQLite database location (default: :memory:)"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main
