# Testing Documentation

This directory contains all testing-related documentation for DevFlow MCP.

## Documentation Index

### E2E Testing

- **[E2E_TEST_PLAN.md](./E2E_TEST_PLAN.md)** - Comprehensive E2E test plan with 274 tests
- **[E2E_IMPLEMENTATION_TASKS.md](./E2E_IMPLEMENTATION_TASKS.md)** - Implementation tasks for remaining E2E tests

## Current Testing Status

### Completed
✅ **Basic E2E Tests** - `src/tests/integration/e2e/01-crud.test.js`
- 194 tests implemented (65% complete)
- Core CRUD operations covered
- Basic validation and error handling tested

### In Progress
🔄 **Additional E2E Test Suites** - 80 additional tests needed:
1. Temporal Features (25-30 tests)
2. Debug Tools (15-20 tests)
3. Performance Tests (20 tests)
4. Scenario Tests (20 tests)

### Planned
📋 **Unit Tests**
- Response builder tests
- Error handler tests
- Validation schema tests

📋 **Integration Tests**
- MCP protocol compliance tests
- Database integration tests
- Embedding service tests

## Quick Start

### Running Tests

```bash
# Run all tests
pnpm test

# Run E2E tests only
pnpm test:e2e

# Run specific test file
pnpm test src/tests/integration/e2e/01-crud.test.js
```

### Writing New Tests

Follow the patterns in existing test files:
1. Use shared client from `fixtures/shared-client.js`
2. Clean up test data in `before` and `after` hooks
3. Use unique entity names with timestamps
4. Test both success and error cases
5. Use helper methods from shared client

## Next Steps

1. Implement remaining E2E tests (see E2E_IMPLEMENTATION_TASKS.md)
2. Add unit tests for response builders and error handlers
3. Add MCP protocol compliance tests
4. Create test builders for branded types (Phase 5)

## References

- [E2E Test Plan](./E2E_TEST_PLAN.md) - Full test plan
- [Implementation Tasks](./E2E_IMPLEMENTATION_TASKS.md) - Remaining work
