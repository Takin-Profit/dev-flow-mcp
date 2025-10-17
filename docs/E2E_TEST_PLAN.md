# DevFlow MCP E2E Test Plan

**Last Updated:** 2025-10-17  
**Status:** ⚠️ Partial - Basic tests exist, comprehensive suite needed

---

## Overview

Comprehensive end-to-end testing strategy for DevFlow MCP with SQLite-only architecture. This plan covers all 20 MCP tools with happy path, edge case, validation, and scenario tests.

---

## Tools to Test (20 total)

### Core CRUD Operations (5 tools)
1. ✅ **create_entities** - Partially tested
2. ✅ **read_graph** - Partially tested  
3. ⚠️ **delete_entities** - Needs tests
4. ⚠️ **add_observations** - Needs tests
5. ⚠️ **delete_observations** - Needs tests

### Relation Management (5 tools)
6. ✅ **create_relations** - Partially tested
7. ✅ **get_relation** - Partially tested
8. ⚠️ **update_relation** - Needs tests
9. ⚠️ **delete_relations** - Needs tests
10. ⚠️ **get_relation_history** - Needs tests

### Search & Discovery (4 tools)
11. ⚠️ **search_nodes** - Needs tests
12. ✅ **semantic_search** - Partially tested
13. ⚠️ **open_nodes** - Needs tests
14. ⚠️ **get_entity_embedding** - Needs tests

### Temporal Features (3 tools)
15. ⚠️ **get_entity_history** - Needs tests
16. ⚠️ **get_graph_at_time** - Needs tests
17. ⚠️ **get_decayed_graph** - Needs tests

### Debug Tools (3 tools)
18. ⚠️ **force_generate_embedding** - Needs tests
19. ⚠️ **debug_embedding_config** - Needs tests
20. ⚠️ **diagnose_vector_search** - Needs tests

---

## Test Categories

### 1. Happy Path Tests
- ✅ Basic CRUD operations (partial)
- ✅ Relations creation and retrieval (partial)
- ✅ Search returns results (partial)
- ⚠️ All tools return properly formatted MCP responses (needs validation)

### 2. Validation Tests (⚠️ NEEDED)
- [ ] Invalid entity types rejected (feature, task, decision, component, test)
- [ ] Missing required fields rejected
- [ ] Invalid relation types rejected
- [ ] Array fields validate correctly
- [ ] Optional fields work (strength, confidence)
- [ ] Type coercion works (strings to numbers)

### 3. Edge Case Tests (⚠️ NEEDED)
- [ ] Empty arrays handled
- [ ] Special characters in entity names
- [ ] Very long observation strings (>5000 chars)
- [ ] Duplicate entity creation
- [ ] Non-existent entity references
- [ ] Circular relationships
- [ ] Null/undefined handling

### 4. Error Handling Tests (⚠️ NEEDED)
- [ ] Tool returns proper MCP error format
- [ ] Validation errors have clear messages
- [ ] Database errors handled gracefully
- [ ] Missing tool arguments
- [ ] Invalid parameter types

### 5. Real-World Scenario Tests (⚠️ NEEDED)
- [ ] Software development workflow (feature → tasks → decisions)
- [ ] Knowledge graph evolution over time
- [ ] Collaborative work (multiple features, shared components)
- [ ] Complex dependency graphs

### 6. Performance Tests (⚠️ NEEDED)
- [ ] Large batch operations (100+ entities)
- [ ] Many concurrent relations (1000+)
- [ ] Search with many results
- [ ] Graph with 1000+ entities

### 7. Integration Tests (⚠️ NEEDED)
- [ ] Vector search returns relevant results (sqlite-vec)
- [ ] Temporal queries accurate (versioning, history)
- [ ] SQLite transactions work correctly
- [ ] Internal optimizations active (WAL mode, cache)

---

## Test File Structure

```
src/tests/integration/e2e/
├── 00-mcp-client.test.js          ✅ Done (~10 tests)
├── 01-crud.test.js                ⚠️ Needed (~40 tests)
├── 02-relations.test.js           ⚠️ Needed (~50 tests)
├── 03-search.test.js              ⚠️ Needed (~30 tests)
├── 04-temporal.test.js            ⚠️ Needed (~25 tests)
├── 05-validation.test.js          ⚠️ Needed (~40 tests)
├── 06-scenarios.test.js           ⚠️ Needed (~20 tests)
└── fixtures/
    ├── entities.js                ✅ Exists
    ├── relations.js               ✅ Exists
    └── helpers.js                 ✅ Exists
```

---

## Estimated Test Count

| Category | Tests | Status |
|----------|-------|--------|
| Basic Client | 10 | ✅ Done |
| CRUD Operations | 40 | ⚠️ Needed |
| Relations | 50 | ⚠️ Needed |
| Search & Discovery | 30 | ⚠️ Needed |
| Temporal Features | 25 | ⚠️ Needed |
| Validation & Errors | 40 | ⚠️ Needed |
| Real-World Scenarios | 20 | ⚠️ Needed |
| **TOTAL** | **~215** | **~5% Complete** |

---

## Implementation Priority

### Phase 1: Core Functionality (HIGH) - ~130 tests
1. CRUD operations (40 tests)
2. Relation management (50 tests)
3. Validation & errors (40 tests)

**Estimated Effort:** 1 day

### Phase 2: Advanced Features (MEDIUM) - ~55 tests
1. Search & discovery (30 tests)
2. Temporal features (25 tests)

**Estimated Effort:** 4-6 hours

### Phase 3: Real-World (MEDIUM) - ~20 tests
1. Scenario tests (20 tests)

**Estimated Effort:** 3-4 hours

### Phase 4: Debug Tools (LOW) - ~15 tests
1. Debug tool tests (15 tests)

**Estimated Effort:** 2-3 hours

---

## Success Criteria

- [ ] All 20 tools tested with valid inputs
- [ ] All 20 tools tested with invalid inputs
- [ ] All error cases return proper MCP error format
- [ ] All validation rules enforced
- [ ] Real-world scenarios pass
- [ ] Performance acceptable (<100ms for typical queries)
- [ ] Zero flaky tests
- [ ] SQLite-only architecture validated
- [ ] Direct `SqliteDb` usage confirmed
- [ ] Internal optimizations verified

---

## Running Tests

```bash
# All tests
pnpm test

# Just E2E tests
pnpm run test:e2e

# Specific test file
node --test src/tests/integration/e2e/01-crud.test.js

# Watch mode
pnpm run test:watch
```

---

## Test Data Validation Rules

### Entity Types (Required)
```typescript
"feature" | "task" | "decision" | "component" | "test"
```

### Relation Types (Required)
```typescript
"depends_on" | "implements" | "part_of" | "relates_to"
```

### Optional Fields with Defaults
```typescript
strength: 0.0 - 1.0
confidence: 0.0 - 1.0
limit: number (default: 10)
min_similarity: 0.0 - 1.0 (default: 0.6)
```

### MCP Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON.stringify(data)"
    }
  ]
}
```

### MCP Error Format
```json
{
  "code": -32603,
  "message": "Error message",
  "data": undefined
}
```

---

## Next Steps

1. ✅ Basic client tests (done)
2. ⚠️ Implement Phase 1 tests (CRUD, relations, validation)
3. ⚠️ Implement Phase 2 tests (search, temporal)
4. ⚠️ Implement Phase 3 tests (scenarios)
5. ⚠️ Add performance benchmarking
6. ⚠️ CI/CD integration

---

## For Contributors

**To Implement a Test Suite:**

1. Choose a category from Phase 1-4 above
2. Create test file in `src/tests/integration/e2e/`
3. Use existing fixtures from `fixtures/` directory
4. Follow MCP client pattern from `00-mcp-client.test.js`
5. Test happy path, edge cases, and errors
6. Run `pnpm test` to verify
7. Update this document to mark as done

**Example Test Structure:**
```javascript
import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { createMcpClient } from './fixtures/helpers.js'

test('create_entities - valid input', async (t) => {
  const client = await createMcpClient()
  const result = await client.callTool('create_entities', {
    entities: [/* test data */]
  })
  // Assertions
})
```

---

**Maintained By:** DevFlow Team  
**Last Updated:** 2025-10-17
