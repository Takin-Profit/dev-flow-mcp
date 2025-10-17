#!/usr/bin/env bash

# E2E Test Runner for DevFlow MCP
# Automatically sets up Neo4j, starts the server, runs tests, and cleans up

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="dfm-neo4j-test"
NEO4J_IMAGE="neo4j:2025.03.0-enterprise"
NEO4J_PORT_BOLT=7687
NEO4J_PORT_HTTP=7474
NEO4J_PASSWORD="dfm_password"
MAX_WAIT_TIME=60  # Maximum seconds to wait for Neo4j to be ready

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
}

# Function to check if container exists
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container is running
container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if Neo4j is ready
neo4j_ready() {
    docker logs "$CONTAINER_NAME" 2>&1 | grep -q "Started"
}

# Function to clean up existing container
cleanup_container() {
    if container_exists; then
        if container_running; then
            print_info "Stopping running container..."
            docker stop "$CONTAINER_NAME" 2>/dev/null || true
        fi
        print_info "Removing existing container..."
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        print_success "Container cleaned up"
    fi
}

# Function to start Neo4j
start_neo4j() {
    print_info "Starting Neo4j container..."
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$NEO4J_PORT_HTTP:7474" \
        -p "$NEO4J_PORT_BOLT:7687" \
        -e NEO4J_AUTH="neo4j/${NEO4J_PASSWORD}" \
        -e NEO4J_ACCEPT_LICENSE_AGREEMENT=yes \
        -e NEO4J_dbms_memory_pagecache_size=256M \
        -e NEO4J_dbms_memory_heap_max__size=512M \
        "$NEO4J_IMAGE" > /dev/null
    
    print_success "Neo4j container started"
}

# Function to wait for Neo4j to be ready
wait_for_neo4j() {
    print_info "Waiting for Neo4j to be ready (max ${MAX_WAIT_TIME}s)..."
    
    local elapsed=0
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if neo4j_ready; then
            print_success "Neo4j is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    echo ""
    print_error "Neo4j failed to start within ${MAX_WAIT_TIME} seconds"
    print_info "Container logs:"
    docker logs "$CONTAINER_NAME" 2>&1 | tail -20
    return 1
}

# Function to initialize Neo4j schema
init_schema() {
    print_info "Initializing Neo4j schema..."
    
    # Check if neo4j:init script exists
    if pnpm run --silent neo4j:init 2>&1 | grep -q "Cannot find module"; then
        print_warning "Schema initialization script not found, skipping..."
    else
        pnpm run neo4j:init > /dev/null 2>&1 || print_warning "Schema initialization failed (may not be critical)"
    fi
}

# Function to build the project
build_project() {
    print_info "Building project..."
    if pnpm run build > /dev/null 2>&1; then
        print_success "Project built successfully"
    else
        print_error "Build failed"
        return 1
    fi
}

# Function to run e2e tests
run_tests() {
    print_info "Running e2e tests..."
    echo ""

    export DFM_ENV=testing
    export TEST_INTEGRATION=true
    export NEO4J_URI="bolt://localhost:${NEO4J_PORT_BOLT}"
    export NEO4J_USERNAME="neo4j"
    export NEO4J_PASSWORD="${NEO4J_PASSWORD}"

    # Run all e2e tests using Node.js test runner
    # Tests spawn their own MCP server processes using the built CLI
    if node --test src/tests/integration/e2e/*.test.js; then
        echo ""
        print_success "All e2e tests passed!"
        return 0
    else
        echo ""
        print_error "Some e2e tests failed"
        return 1
    fi
}

# Function to cleanup on exit (called via trap)
# shellcheck disable=SC2329  # Function is called indirectly via trap
cleanup_on_exit() {
    local exit_code=$?
    
    echo ""
    print_info "Cleaning up..."
    
    if [ "$KEEP_CONTAINER" != "true" ]; then
        if container_running; then
            docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
        fi
        docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
        print_success "Neo4j container stopped and removed"
    else
        print_info "Container kept running (KEEP_CONTAINER=true)"
        print_info "To stop manually: docker stop ${CONTAINER_NAME} && docker rm ${CONTAINER_NAME}"
    fi
    
    exit "$exit_code"
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "    DevFlow MCP E2E Test Runner"
    echo "=========================================="
    echo ""

    # Check prerequisites
    check_docker
    
    # Set up cleanup trap
    trap cleanup_on_exit EXIT INT TERM
    
    # Clean up any existing container
    cleanup_container
    
    # Start Neo4j
    start_neo4j
    
    # Wait for Neo4j to be ready
    if ! wait_for_neo4j; then
        exit 1
    fi
    
    # Small additional delay for stability
    sleep 3
    
    # Initialize schema (optional)
    init_schema

    # Build project
    if ! build_project; then
        exit 1
    fi

    # Run tests
    if run_tests; then
        echo ""
        echo "=========================================="
        print_success "E2E tests completed successfully!"
        echo "=========================================="
        echo ""

        exit 0
    else
        echo ""
        echo "=========================================="
        print_error "E2E tests failed"
        echo "=========================================="
        echo ""

        exit 1
    fi
}

# Parse command line arguments
KEEP_CONTAINER=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep) 
            KEEP_CONTAINER=true
            shift
            ;; 
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --keep    Keep Neo4j container running after tests"
            echo "  --help    Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                # Run tests and cleanup"
            echo "  $0 --keep         # Run tests and keep container"
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