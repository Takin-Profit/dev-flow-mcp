# DevFlow MCP E2E Test Plan

**Last Updated:** 2025-10-16
**Status:** ✅ 65% Complete - Core functionality well tested, temporal and debug tools needed

---

## Overview

Comprehensive end-to-end testing strategy for DevFlow MCP with **SQLite-only** architecture. This plan covers all **20 MCP tools** (17 standard + 3 debug tools when DEBUG=true) with happy path, edge case, validation, and error handling tests.

**Current Coverage:** 194 tests implemented covering 13 of 20 tools (65%)

---

## Tools Coverage Status (20 total)

### Core CRUD Operations (5 tools) - ✅ COMPLETE
1. ✅ **create_entities** - Comprehensive (13 tests)
2. ✅ **read_graph** - Comprehensive (5 tests)
3. ✅ **delete_entities** - Comprehensive (7 tests)
4. ✅ **add_observations** - Comprehensive (7 tests)
5. ✅ **delete_observations** - Comprehensive (5 tests)

### Relation Management (5 tools) - ✅ COMPLETE
6. ✅ **create_relations** - Very comprehensive (30 tests)
7. ✅ **get_relation** - Comprehensive (8 tests)
8. ✅ **update_relation** - Comprehensive (5 tests)
9. ✅ **delete_relations** - Comprehensive (5 tests)
10. ⚠️ **get_relation_history** - NOT TESTED (temporal feature)

### Search & Discovery (4 tools) - ✅ COMPLETE
11. ✅ **search_nodes** - Comprehensive (9 tests)
12. ✅ **semantic_search** - Very comprehensive (14 tests)
13. ✅ **open_nodes** - Comprehensive (9 tests)
14. ✅ **get_entity_embedding** - Comprehensive (6 tests)

### Temporal Features (3 tools) - ⚠️ NEEDS IMPLEMENTATION
15. ⚠️ **get_entity_history** - NOT TESTED (implemented but untested)
16. ⚠️ **get_graph_at_time** - NOT TESTED (implemented but untested)
17. ⚠️ **get_decayed_graph** - NOT TESTED (implemented but untested)

### Debug Tools (3 tools) - ⚠️ NEEDS IMPLEMENTATION
18. ⚠️ **force_generate_embedding** - NOT TESTED (only available when DEBUG=true)
19. ⚠️ **debug_embedding_config** - NOT TESTED (only available when DEBUG=true)
20. ⚠️ **diagnose_vector_search** - NOT TESTED (only available when DEBUG=true)

---

## Test Categories - Current Status

### 1. Happy Path Tests - ✅ COMPREHENSIVE
- ✅ Basic CRUD operations (all tools tested)
- ✅ Relations creation and retrieval (all CRUD operations)
- ✅ Search returns results (keyword and semantic)
- ✅ All tools return properly formatted MCP responses
- ✅ Vector embeddings work correctly

### 2. Validation Tests - ✅ VERY COMPREHENSIVE (67 tests in 04-validation.test.js)
- ✅ Invalid entity types rejected (feature, task, decision, component validated)
- ✅ Missing required fields rejected (comprehensive coverage)
- ✅ Invalid relation types rejected (all 4 types validated)
- ✅ Array fields validate correctly (empty, null, non-array)
- ✅ Optional fields work (strength, confidence tested with boundary values)
- ✅ Type coercion tested (string rejection for numeric fields)
- ✅ Error messages are clear and specific

### 3. Edge Case Tests - ✅ COMPREHENSIVE
- ✅ Empty arrays handled (multiple scenarios)
- ✅ Special characters in entity names
- ✅ Unicode characters (日本語 🚀) in entity names
- ✅ Very long observation strings (tested up to 10,000 chars)
- ✅ Very long entity names (tested up to 400+ chars)
- ✅ Duplicate entity creation
- ✅ Non-existent entity references
- ✅ Circular relationships
- ✅ Self-referencing relations
- ✅ Null/undefined handling
- ✅ Large metadata objects (5000 char descriptions, 100 tags, deeply nested)
- ✅ Many observations (100+ per entity)

### 4. Error Handling Tests - ✅ COMPREHENSIVE
- ✅ Tools return proper error messages
- ✅ Validation errors have clear messages with field names
- ✅ Database errors handled gracefully
- ✅ Missing tool arguments caught
- ✅ Invalid parameter types rejected
- ✅ Boundary violations detected (strength/confidence >1.0 or <0.0)
- ✅ Non-existent entities/relations handled gracefully

### 5. Real-World Scenario Tests - ⚠️ LIMITED
- ⚠️ Software development workflow - Partial (basic entity/relation chains tested)
- ⚠️ Knowledge graph evolution over time - NOT TESTED
- ⚠️ Collaborative work - NOT TESTED
- ⚠️ Complex dependency graphs - Limited (tested in relations)

### 6. Performance Tests - ⚠️ NOT IMPLEMENTED
- ⚠️ Large batch operations (100+ entities) - NOT TESTED
- ⚠️ Many concurrent relations (1000+) - NOT TESTED
- ⚠️ Search with many results - NOT TESTED
- ⚠️ Graph with 1000+ entities - Partial (tested up to 50)

### 7. SQLite Integration Tests - ⚠️ LIMITED
- ✅ Vector search returns relevant results (sqlite-vec tested)
- ⚠️ Temporal queries accurate - NOT TESTED
- ⚠️ SQLite transactions work correctly - NOT EXPLICITLY TESTED
- ⚠️ Internal optimizations active (WAL mode, cache) - NOT TESTED
- ⚠️ Concurrent operations - NOT TESTED

---

## Test File Structure - CURRENT STATE

```
src/tests/integration/e2e/
├── 00-mcp-client.test.js       ✅ DONE (4 tests)
│   └── Basic MCP protocol smoke tests
├── 01-crud.test.js             ✅ DONE (37 tests)
│   └── create_entities, read_graph, delete_entities,
│       add_observations, delete_observations
├── 02-relations.test.js        ✅ DONE (48 tests)
│   └── create_relations, get_relation, update_relation,
│       delete_relations (comprehensive edge cases)
├── 03-search.test.js           ✅ DONE (38 tests)
│   └── search_nodes, semantic_search, open_nodes,
│       get_entity_embedding (with parameters)
├── 04-validation.test.js       ✅ DONE (67 tests)
│   └── Comprehensive validation across all tools
├── 05-temporal.test.js         ⚠️ NEEDED (~25-30 tests)
│   └── get_entity_history, get_relation_history,
│       get_graph_at_time, get_decayed_graph
├── 06-debug-tools.test.js      ⚠️ NEEDED (~15-20 tests)
│   └── force_generate_embedding, debug_embedding_config,
│       diagnose_vector_search
├── 07-performance.test.js      ⚠️ NEEDED (~20 tests)
│   └── Large batches, stress tests, concurrent operations
├── 08-scenarios.test.js        ⚠️ NEEDED (~20 tests)
│   └── Real-world workflows, multi-step operations
└── fixtures/
    ├── entities.js             ✅ Comprehensive fixtures
    ├── relations.js            ✅ Comprehensive fixtures
    ├── shared-client.js        ✅ Shared MCP client setup
    └── helpers.js              ✅ Test utility functions
```

---

## Test Count Summary

| Category | Tests | Status | Notes |
|----------|-------|--------|-------|
| MCP Client | 4 | ✅ Done | Basic smoke tests |
| CRUD Operations | 37 | ✅ Done | All 5 tools comprehensive |
| Relations | 48 | ✅ Done | Very comprehensive, edge cases |
| Search & Discovery | 38 | ✅ Done | All 4 tools with parameters |
| Validation & Errors | 67 | ✅ Done | Comprehensive validation |
| **CURRENT TOTAL** | **194** | **65% Complete** | |
| Temporal Features | 0 | ⚠️ Needed | 3 tools, ~25-30 tests |
| Debug Tools | 0 | ⚠️ Needed | 3 tools, ~15-20 tests |
| Performance | 0 | ⚠️ Needed | ~20 tests |
| Real-World Scenarios | 0 | ⚠️ Needed | ~20 tests |
| **REMAINING NEEDED** | **~80** | | |
| **FINAL TARGET** | **~274** | | |

---

## Implementation Priority - UPDATED

### ✅ Phase 1: Core Functionality - COMPLETE (194 tests)
- ✅ CRUD operations (37 tests)
- ✅ Relation management (48 tests)
- ✅ Search & discovery (38 tests)
- ✅ Validation & errors (67 tests)
- ✅ MCP client integration (4 tests)

**Status:** COMPLETE

---

### ⚠️ Phase 2: Temporal Features - HIGH PRIORITY (~25-30 tests)

**File:** `05-temporal.test.js`

**Tools to Test:**
1. **get_entity_history** (8-10 tests)
   - Get history for entity with multiple versions
   - Verify chronological ordering
   - Handle entities with no history
   - Handle non-existent entities
   - Verify all temporal fields (version, createdAt, updatedAt, validFrom, validTo, changedBy)

2. **get_relation_history** (8-10 tests)
   - Get history for relation with multiple versions
   - Verify chronological ordering
   - Handle relations with no history
   - Handle non-existent relations
   - Verify temporal metadata preserved

3. **get_graph_at_time** (6-8 tests)
   - Get graph at specific timestamp
   - Verify only entities valid at that time
   - Verify only relations valid at that time
   - Handle timestamp before any data
   - Handle timestamp after all data
   - Handle current timestamp

4. **get_decayed_graph** (4-6 tests)
   - Get graph with confidence decay
   - Verify old relations have lower confidence
   - Verify recent relations have high confidence
   - Handle graph with no decay configuration
   - Handle empty graph

**Estimated Effort:** 4-6 hours

---

### ⚠️ Phase 3: Debug Tools - MEDIUM PRIORITY (~15-20 tests)

**File:** `06-debug-tools.test.js`

**Prerequisites:** Set DEBUG=true in test environment

**Tools to Test:**
1. **force_generate_embedding** (6-8 tests)
   - Force generate embedding for entity
   - Verify embedding stored in vector store
   - Verify embedding dimensions match model
   - Handle non-existent entity
   - Handle entity name vs ID lookup
   - Verify embedding service initialized

2. **debug_embedding_config** (4-6 tests)
   - Get embedding configuration
   - Verify OpenAI API key detected
   - Verify model configuration
   - Verify vector store status
   - Verify embedding job manager status
   - Check entities with embeddings count

3. **diagnose_vector_search** (4-6 tests)
   - Run vector search diagnostics
   - Verify SQLite vector index status
   - Check vector dimensions
   - Verify similarity function
   - Count indexed entities

**Estimated Effort:** 3-4 hours

---

### ⚠️ Phase 4: Performance & Scalability - MEDIUM PRIORITY (~20 tests)

**File:** `07-performance.test.js`

**Test Scenarios:**
1. **Batch Operations** (6-8 tests)
   - Create 100+ entities in single batch
   - Create 1000+ relations in single batch
   - Delete 100+ entities in single batch
   - Measure operation time (<5s for 100 entities)

2. **Large Graph Operations** (6-8 tests)
   - Read graph with 1000+ entities
   - Search in graph with 1000+ entities
   - Semantic search with 1000+ entities
   - Verify performance <100ms for typical operations

3. **Concurrent Operations** (4-6 tests)
   - Multiple create_entities simultaneously
   - Multiple semantic_search simultaneously
   - Read and write operations simultaneously
   - Verify no race conditions or deadlocks

**Estimated Effort:** 6-8 hours

---

### ⚠️ Phase 5: Real-World Scenarios - LOW PRIORITY (~20 tests)

**File:** `08-scenarios.test.js`

**Test Scenarios:**
1. **Software Development Workflow** (8-10 tests)
   - Feature → Tasks workflow
   - Tasks → Components dependencies
   - Decision → Implementation chain
   - Test → Component relationships

2. **Knowledge Graph Evolution** (6-8 tests)
   - Build graph over time
   - Update entities and relations
   - Track changes through history
   - Verify temporal consistency

3. **Complex Dependency Management** (4-6 tests)
   - Multi-level dependency trees
   - Circular dependency detection
   - Dependency impact analysis
   - Cascade delete scenarios

**Estimated Effort:** 4-6 hours

---

## Success Criteria - UPDATED

### ✅ Already Achieved
- ✅ 13 of 20 tools tested with valid inputs
- ✅ 13 of 20 tools tested with invalid inputs
- ✅ Error cases return proper error messages
- ✅ All validation rules enforced
- ✅ Zero flaky tests (current tests stable)
- ✅ SQLite-only architecture validated
- ✅ Comprehensive edge case coverage

### ⚠️ Remaining Goals
- ⚠️ All 20 tools tested with valid inputs (7 tools remaining)
- ⚠️ All 20 tools tested with invalid inputs (7 tools remaining)
- ⚠️ Temporal features validated
- ⚠️ Debug tools validated
- ⚠️ Real-world scenarios pass
- ⚠️ Performance acceptable (<100ms for typical queries)
- ⚠️ Concurrent operations verified
- ⚠️ Internal optimizations verified (WAL mode, cache)

---

## Running Tests

```bash
# All E2E tests
npm run test:e2e
# or
pnpm run test:e2e

# Specific test file
node --test src/tests/integration/e2e/01-crud.test.js

# With DEBUG tools enabled
DEBUG=true node --test src/tests/integration/e2e/06-debug-tools.test.js

# All tests (unit + integration + e2e)
pnpm test

# Run specific test suite
node --test src/tests/integration/e2e/02-relations.test.js

# Watch mode (if configured)
pnpm run test:watch
```

---

## Test Data & Validation Rules

### Entity Types (Required)
```typescript
"feature" | "task" | "decision" | "component"
```
**Note:** "test" entity type removed in latest schema

### Relation Types (Required)
```typescript
"depends_on" | "implements" | "part_of" | "relates_to"
```

### Optional Fields with Defaults
```typescript
strength: 0.0 - 1.0 (relation strength)
confidence: 0.0 - 1.0 (relation confidence)
limit: number (default: 10, for search results)
min_similarity: 0.0 - 1.0 (default: 0.6, for semantic search)
hybrid_search: boolean (default: true, for semantic search)
semantic_weight: 0.0 - 1.0 (default: 0.6, for hybrid search)
```

### Temporal Fields (Optional, auto-generated)
```typescript
id: string (UUID, auto-generated)
version: number (auto-incremented)
createdAt: number (timestamp in ms)
updatedAt: number (timestamp in ms)
validFrom: number (timestamp in ms)
validTo: number (timestamp in ms, optional)
changedBy: string (user/system identifier, optional)
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
  "message": "Error message with context",
  "code": -32603
}
```

---

## Architecture Notes

### SQLite-Only Implementation
- **Database:** SQLite with sqlite-vec extension for vector operations
- **Vector Store:** Integrated into SQLite (no separate vector database)
- **Schema Manager:** SqliteSchemaManager handles table creation and indices
- **No External Dependencies:** No Docker, no Neo4j, no separate services
- **File Location:** Configurable via `DFM_SQLITE_LOCATION` env var
- **Test Database:** Uses `:memory:` for E2E tests (fast, isolated)

### Test Infrastructure
- **Client:** Shared MCP client instance across tests (performance optimization)
- **Fixtures:** Reusable entity and relation fixtures
- **Helpers:** MCPTestHelper class for common operations
- **Cleanup:** Automatic cleanup between test suites
- **Isolation:** Each test suite creates unique entity names with timestamps

---

## Next Steps for Contributors

### Immediate Priorities (Ordered by Value)

1. **Implement Temporal Tests** (HIGH VALUE - 25-30 tests)
   - File: `05-temporal.test.js`
   - Test 4 temporal tools
   - Estimated: 4-6 hours
   - See Phase 2 above for details

2. **Implement Debug Tool Tests** (MEDIUM VALUE - 15-20 tests)
   - File: `06-debug-tools.test.js`
   - Test 3 debug tools
   - Requires DEBUG=true
   - Estimated: 3-4 hours
   - See Phase 3 above for details

3. **Implement Performance Tests** (MEDIUM VALUE - 20 tests)
   - File: `07-performance.test.js`
   - Large batches, stress tests, concurrent operations
   - Estimated: 6-8 hours
   - See Phase 4 above for details

4. **Implement Scenario Tests** (LOW VALUE - 20 tests)
   - File: `08-scenarios.test.js`
   - Real-world workflows
   - Estimated: 4-6 hours
   - See Phase 5 above for details

---

## Test Implementation Guide

### Setting Up a New Test File

```javascript
/**
 * E2E Tests: [Category Name]
 * [Description of what this file tests]
 */

import { strictEqual, ok } from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { getSharedClient, cleanupAllTestData } from './fixtures/shared-client.js'

describe('E2E: [Category Name]', () => {
  let client
  let helper

  before(async () => {
    const shared = await getSharedClient()
    client = shared.client
    helper = shared.helper

    // Optional: Clean up before tests
    await cleanupAllTestData()
  })

  after(async () => {
    // Clean up after tests
    await cleanupAllTestData()
  })

  describe('[tool_name]', () => {
    it('should [test description]', async () => {
      // Arrange
      const testData = { /* ... */ }

      // Act
      const result = await helper.callToolJSON('[tool_name]', testData)

      // Assert
      strictEqual(result.property, expectedValue)
      ok(result.success)
    })

    it('should reject [invalid input]', async () => {
      await helper.expectToolError(
        '[tool_name]',
        { invalidData: true },
        'expected error keyword'
      )
    })
  })
})
```

### Using Test Helpers

```javascript
// Create entities
const entities = await helper.createEntities([
  { name: 'test1', entityType: 'feature', observations: ['obs1'] }
])

// Call any tool and parse JSON
const result = await helper.callToolJSON('tool_name', { args })

// Expect an error
await helper.expectToolError('tool_name', { bad_args }, 'error keyword')

// Read entire graph
const graph = await helper.readGraph()

// Search
const results = await helper.searchNodes('query')
const semantic = await helper.semanticSearch('query', { limit: 5 })

// Delete entities
await helper.deleteEntities(['entity1', 'entity2'])
```

---

## Maintenance

### Updating This Document

**When to Update:**
- After adding new test files
- After completing a test phase
- When test counts change significantly
- When tools are added/removed/modified
- After architecture changes

**Update Checklist:**
- [ ] Update test counts in tables
- [ ] Update completion percentages
- [ ] Update status indicators (✅ ⚠️)
- [ ] Update "Last Updated" date
- [ ] Update test file structure
- [ ] Update implementation priority if needed

---

**Maintained By:** DevFlow Team
**Last Updated:** 2025-10-16
**Next Review:** After temporal tests implementation
