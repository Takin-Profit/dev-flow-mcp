# DevFlow MCP E2E Test Implementation Tasks

**Status:** Ready for Implementation  
**Target:** 80 additional tests across 4 new test files  
**Current Coverage:** 194/274 tests (65% complete)

---

## TASK 1: Implement Temporal Feature Tests (HIGH PRIORITY)

**File:** `src/tests/integration/e2e/05-temporal.test.js`  
**Target:** 25-30 tests  
**Estimated Time:** 4-6 hours  
**Tools to Test:** 4 temporal tools

### Implementation Requirements

```javascript
/**
 * E2E Tests: Temporal Features
 * Tests get_entity_history, get_relation_history, get_graph_at_time, get_decayed_graph
 */

import { strictEqual, ok, deepStrictEqual } from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { getSharedClient, cleanupAllTestData } from './fixtures/shared-client.js'

describe('E2E: Temporal Features', () => {
  let client, helper
  
  before(async () => {
    const shared = await getSharedClient()
    client = shared.client
    helper = shared.helper
    await cleanupAllTestData()
  })

  after(async () => {
    await cleanupAllTestData()
  })
  
  // Test implementations go here
})
```

### Test Group 1: get_entity_history (8-10 tests)

**Purpose:** Verify entity version history tracking and retrieval

**Test Cases:**

1. **Basic History Retrieval**
   ```javascript
   it('should return entity history with multiple versions', async () => {
     // Create entity
     const entityName = `history_test_${Date.now()}`
     await helper.createEntities([{
       name: entityName,
       entityType: 'feature',
       observations: ['Initial observation']
     }])
     
     // Update entity multiple times
     await helper.callToolJSON('add_observations', {
       observations: [{
         entityName,
         contents: ['Second observation']
       }]
     })
     
     await helper.callToolJSON('add_observations', {
       observations: [{
         entityName,
         contents: ['Third observation']
       }]
     })
     
     // Get history
     const result = await helper.callToolJSON('get_entity_history', {
       entityName
     })
     
     // Verify structure
     ok(Array.isArray(result.history))
     ok(result.history.length >= 2) // At least 2 versions
     
     // Verify chronological order (newest first)
     for (let i = 1; i < result.history.length; i++) {
       ok(result.history[i-1].version >= result.history[i].version)
     }
     
     // Verify required temporal fields
     result.history.forEach(version => {
       ok(version.id)
       ok(typeof version.version === 'number')
       ok(typeof version.createdAt === 'number')
       ok(typeof version.updatedAt === 'number')
       ok(typeof version.validFrom === 'number')
       // validTo and changedBy are optional
     })
   })
   ```

2. **Entity with No History**
   ```javascript
   it('should handle entity with no version history', async () => {
     const entityName = `no_history_${Date.now()}`
     await helper.createEntities([{
       name: entityName,
       entityType: 'task',
       observations: ['Single observation']
     }])
     
     const result = await helper.callToolJSON('get_entity_history', {
       entityName
     })
     
     // Should return current version only
     ok(Array.isArray(result.history))
     strictEqual(result.history.length, 1)
     strictEqual(result.history[0].version, 1)
   })
   ```

3. **Non-existent Entity**
   ```javascript
   it('should handle non-existent entity gracefully', async () => {
     await helper.expectToolError(
       'get_entity_history',
       { entityName: 'nonexistent_entity' },
       'not found'
     )
   })
   ```

4. **History Field Validation**
   ```javascript
   it('should include all temporal metadata fields', async () => {
     const entityName = `metadata_test_${Date.now()}`
     await helper.createEntities([{
       name: entityName,
       entityType: 'component',
       observations: ['Test observation']
     }])
     
     const result = await helper.callToolJSON('get_entity_history', {
       entityName
     })
     
     const version = result.history[0]
     
     // Required fields
     ok(typeof version.id === 'string')
     ok(typeof version.version === 'number')
     ok(typeof version.createdAt === 'number')
     ok(typeof version.updatedAt === 'number')
     ok(typeof version.validFrom === 'number')
     
     // Timestamps should be reasonable (within last minute)
     const now = Date.now()
     ok(version.createdAt <= now)
     ok(version.createdAt > now - 60000) // Within last minute
     ok(version.validFrom <= now)
   })
   ```

### Test Group 2: get_relation_history (8-10 tests)

**Purpose:** Verify relation version history tracking

**Test Cases:**

1. **Relation History with Updates**
   ```javascript
   it('should track relation history through updates', async () => {
     // Create entities
     const from = `rel_from_${Date.now()}`
     const to = `rel_to_${Date.now()}`
     
     await helper.createEntities([
       { name: from, entityType: 'feature', observations: ['From entity'] },
       { name: to, entityType: 'task', observations: ['To entity'] }
     ])
     
     // Create relation
     await helper.callToolJSON('create_relations', {
       relations: [{
         from,
         to,
         relationType: 'depends_on',
         strength: 0.5,
         confidence: 0.8
       }]
     })
     
     // Update relation
     await helper.callToolJSON('update_relation', {
       relation: {
         from,
         to,
         relationType: 'depends_on',
         strength: 0.9,
         confidence: 0.95,
         metadata: { updated: true }
       }
     })
     
     // Get history
     const result = await helper.callToolJSON('get_relation_history', {
       from,
       to,
       relationType: 'depends_on'
     })
     
     ok(Array.isArray(result.history))
     ok(result.history.length >= 2)
     
     // Verify chronological order
     for (let i = 1; i < result.history.length; i++) {
       ok(result.history[i-1].version >= result.history[i].version)
     }
     
     // Verify strength/confidence changes preserved
     const latest = result.history[0]
     strictEqual(latest.strength, 0.9)
     strictEqual(latest.confidence, 0.95)
   })
   ```

2. **Non-existent Relation**
   ```javascript
   it('should handle non-existent relation', async () => {
     await helper.expectToolError(
       'get_relation_history',
       {
         from: 'nonexistent_from',
         to: 'nonexistent_to',
         relationType: 'depends_on'
       },
       'not found'
     )
   })
   ```

### Test Group 3: get_graph_at_time (6-8 tests)

**Purpose:** Verify point-in-time graph retrieval

**Test Cases:**

1. **Graph at Specific Timestamp**
   ```javascript
   it('should return graph state at specific timestamp', async () => {
     const timestamp1 = Date.now()
     
     // Create initial entities
     await helper.createEntities([
       { name: `time_entity_1_${timestamp1}`, entityType: 'feature', observations: ['First'] }
     ])
     
     // Wait and record timestamp
     await new Promise(resolve => setTimeout(resolve, 10))
     const timestamp2 = Date.now()
     
     // Add more entities
     await helper.createEntities([
       { name: `time_entity_2_${timestamp1}`, entityType: 'task', observations: ['Second'] }
     ])
     
     // Get graph at timestamp2 (should only have first entity)
     const result = await helper.callToolJSON('get_graph_at_time', {
       timestamp: timestamp2
     })
     
     ok(result.entities)
     ok(result.relations)
     
     // Should contain first entity but not second
     const entityNames = result.entities.map(e => e.name)
     ok(entityNames.includes(`time_entity_1_${timestamp1}`))
     ok(!entityNames.includes(`time_entity_2_${timestamp1}`))
   })
   ```

2. **Timestamp Before Any Data**
   ```javascript
   it('should return empty graph for timestamp before any data', async () => {
     const veryOldTimestamp = Date.now() - 86400000 // 24 hours ago
     
     const result = await helper.callToolJSON('get_graph_at_time', {
       timestamp: veryOldTimestamp
     })
     
     ok(Array.isArray(result.entities))
     ok(Array.isArray(result.relations))
     strictEqual(result.entities.length, 0)
     strictEqual(result.relations.length, 0)
   })
   ```

### Test Group 4: get_decayed_graph (4-6 tests)

**Purpose:** Verify confidence decay calculations

**Test Cases:**

1. **Basic Confidence Decay**
   ```javascript
   it('should apply confidence decay to old relations', async () => {
     // Create entities and relation
     const from = `decay_from_${Date.now()}`
     const to = `decay_to_${Date.now()}`
     
     await helper.createEntities([
       { name: from, entityType: 'feature', observations: ['From'] },
       { name: to, entityType: 'task', observations: ['To'] }
     ])
     
     await helper.callToolJSON('create_relations', {
       relations: [{
         from,
         to,
         relationType: 'depends_on',
         confidence: 1.0
       }]
     })
     
     // Get decayed graph with reference time in future
     const futureTime = Date.now() + 86400000 // 24 hours from now
     
     const result = await helper.callToolJSON('get_decayed_graph', {
       options: {
         reference_time: futureTime
       }
     })
     
     ok(result.entities)
     ok(result.relations)
     
     // Find our relation
     const relation = result.relations.find(r => 
       r.from === from && r.to === to && r.relationType === 'depends_on'
     )
     
     ok(relation)
     // Confidence should be decayed (less than original 1.0)
     ok(relation.confidence < 1.0)
     ok(relation.confidence > 0) // But not zero
   })
   ```

---

## TASK 2: Implement Debug Tool Tests (MEDIUM PRIORITY)

**File:** `src/tests/integration/e2e/06-debug-tools.test.js`  
**Target:** 15-20 tests  
**Estimated Time:** 3-4 hours  
**Prerequisites:** Set DEBUG=true in test environment

### Implementation Requirements

```javascript
/**
 * E2E Tests: Debug Tools
 * Tests force_generate_embedding, debug_embedding_config, diagnose_vector_search
 * NOTE: These tools are only available when DEBUG=true
 */

import { strictEqual, ok } from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { getSharedClient, cleanupAllTestData } from './fixtures/shared-client.js'

describe('E2E: Debug Tools', () => {
  let client, helper
  
  before(async () => {
    // Verify DEBUG mode is enabled
    if (!process.env.DEBUG) {
      throw new Error('DEBUG=true required for debug tool tests')
    }
    
    const shared = await getSharedClient()
    client = shared.client
    helper = shared.helper
    await cleanupAllTestData()
  })

  after(async () => {
    await cleanupAllTestData()
  })
  
  // Test implementations go here
})
```

### Test Group 1: force_generate_embedding (6-8 tests)

**Purpose:** Verify forced embedding generation for entities

**Key Test Cases:**
1. Force generate embedding for existing entity
2. Verify embedding stored with correct dimensions
3. Handle non-existent entity
4. Verify embedding service is initialized
5. Test entity name vs ID lookup
6. Verify embedding overwrites existing

### Test Group 2: debug_embedding_config (4-6 tests)

**Purpose:** Verify embedding configuration diagnostics

**Key Test Cases:**
1. Get embedding configuration details
2. Verify OpenAI API key detection
3. Verify model configuration
4. Check vector store status
5. Count entities with embeddings

### Test Group 3: diagnose_vector_search (4-6 tests)

**Purpose:** Verify vector search diagnostics

**Key Test Cases:**
1. Run vector search diagnostics
2. Verify SQLite vector index status
3. Check vector dimensions match config
4. Verify similarity function
5. Count indexed entities

---

## TASK 3: Implement Performance Tests (MEDIUM PRIORITY)

**File:** `src/tests/integration/e2e/07-performance.test.js`  
**Target:** 20 tests  
**Estimated Time:** 6-8 hours

### Test Categories:

1. **Batch Operations (6-8 tests)**
   - Create 100+ entities in single batch
   - Create 1000+ relations in single batch
   - Delete 100+ entities in single batch
   - Measure operation times (<5s for 100 entities)

2. **Large Graph Operations (6-8 tests)**
   - Read graph with 1000+ entities
   - Search in large graphs
   - Semantic search performance
   - Verify <100ms for typical operations

3. **Concurrent Operations (4-6 tests)**
   - Multiple simultaneous operations
   - Race condition testing
   - Deadlock prevention

---

## TASK 4: Implement Scenario Tests (LOW PRIORITY)

**File:** `src/tests/integration/e2e/08-scenarios.test.js`  
**Target:** 20 tests  
**Estimated Time:** 4-6 hours

### Test Categories:

1. **Software Development Workflow (8-10 tests)**
   - Feature → Tasks workflow
   - Tasks → Components dependencies
   - Decision → Implementation chains

2. **Knowledge Graph Evolution (6-8 tests)**
   - Build graph over time
   - Track changes through history
   - Verify temporal consistency

3. **Complex Dependencies (4-6 tests)**
   - Multi-level dependency trees
   - Circular dependency detection
   - Cascade operations

---

## Implementation Guidelines

### Test Structure Standards
- Use `describe()` for grouping by tool
- Use `it()` for individual test cases
- Always clean up test data
- Use unique entity names with timestamps
- Follow existing naming patterns

### Error Testing Patterns
```javascript
await helper.expectToolError(
  'tool_name',
  { invalid: 'data' },
  'expected error keyword'
)
```

### Success Testing Patterns
```javascript
const result = await helper.callToolJSON('tool_name', validData)
strictEqual(result.success, true)
ok(result.expectedProperty)
```

### Performance Testing Patterns
```javascript
const startTime = Date.now()
await helper.callToolJSON('tool_name', largeData)
const duration = Date.now() - startTime
ok(duration < 5000, `Operation took ${duration}ms, expected <5000ms`)
```

---

## Completion Criteria

- [ ] All 4 test files created and passing
- [ ] ~80 additional tests implemented
- [ ] All temporal tools tested
- [ ] All debug tools tested (when DEBUG=true)
- [ ] Performance benchmarks established
- [ ] Real-world scenarios validated
- [ ] Zero flaky tests
- [ ] All tests follow established patterns
- [ ] Documentation updated with new test counts

**Final Target:** 274 total tests (194 existing + 80 new)
