# DevFlow MCP E2E Test Plan

## Overview
Comprehensive end-to-end testing strategy for the DevFlow MCP server to ensure production readiness.

## Tools to Test (20 total)

### Core CRUD Operations
1. **create_entities** - Create new entities in the knowledge graph
2. **read_graph** - Read the entire knowledge graph
3. **delete_entities** - Delete entities from the graph
4. **add_observations** - Add observations to existing entities
5. **delete_observations** - Remove observations from entities

### Relation Management
6. **create_relations** - Create relationships between entities
7. **get_relation** - Get a specific relation
8. **update_relation** - Update an existing relation
9. **delete_relations** - Delete relations
10. **get_relation_history** - Get temporal history of a relation

### Search & Discovery
11. **search_nodes** - Text-based search
12. **semantic_search** - Vector similarity search
13. **open_nodes** - Open multiple nodes by name

### Temporal Features
14. **get_entity_history** - Get entity change history
15. **get_graph_at_time** - Get graph state at specific timestamp
16. **get_decayed_graph** - Get graph with confidence decay applied

### Embedding Management
17. **get_entity_embedding** - Get embedding for an entity
18. **force_generate_embedding** - Force regeneration of embeddings

### Debug/Diagnostic
19. **debug_embedding_config** - Debug embedding configuration
20. **diagnose_vector_search** - Diagnose vector search issues

## Test Categories

### 1. Happy Path Tests
- ✅ Basic CRUD operations work correctly
- ✅ Relations can be created and retrieved
- ✅ Search returns results
- ✅ All tools return properly formatted MCP responses

### 2. Data Validation Tests
- [ ] Invalid entity types rejected
- [ ] Missing required fields rejected
- [ ] Invalid relation types rejected
- [ ] Array fields validate correctly
- [ ] Optional fields work
- [ ] Type coercion works (strings to numbers, etc.)

### 3. Edge Case Tests
- [ ] Empty arrays handled
- [ ] Special characters in names
- [ ] Very long observation strings
- [ ] Duplicate entity creation
- [ ] Non-existent entity references
- [ ] Circular relationships
- [ ] Null/undefined handling

### 4. Error Handling Tests
- [ ] Tool returns proper error format
- [ ] Validation errors have clear messages
- [ ] Database errors handled gracefully
- [ ] Network timeouts handled
- [ ] Missing tool arguments

### 5. Real-World Scenario Tests
- [ ] **Software Development Workflow**
  - Create feature entity
  - Add implementation tasks
  - Link dependencies
  - Track decisions
  - Search for related work

- [ ] **Knowledge Graph Evolution**
  - Create entities over time
  - Update observations
  - Check temporal history
  - Verify confidence decay

- [ ] **Collaborative Work**
  - Multiple features
  - Shared components
  - Complex dependency graphs
  - Cross-feature relations

### 6. Performance Tests
- [ ] Large batch operations
- [ ] Many concurrent relations
- [ ] Search with many results
- [ ] Graph with 100+ entities

### 7. Integration Tests
- [ ] Embeddings generated correctly
- [ ] Vector search returns relevant results
- [ ] Temporal queries accurate
- [ ] Neo4j transactions work

## Prompt Tests (4 total)
1. **init-project** - Initialize new project
2. **remember-work** - Record work session
3. **get-context** - Retrieve context for work
4. **review-context** - Review and validate context

## Test File Structure

```
src/tests/integration/
├── mcp-client.integration.test.ts (basic - DONE ✅)
├── mcp-crud.e2e.test.ts (CRUD operations)
├── mcp-relations.e2e.test.ts (relation operations)
├── mcp-search.e2e.test.ts (search & discovery)
├── mcp-temporal.e2e.test.ts (temporal features)
├── mcp-embeddings.e2e.test.ts (embedding operations)
├── mcp-validation.e2e.test.ts (data validation & errors)
├── mcp-scenarios.e2e.test.ts (real-world workflows)
└── mcp-prompts.e2e.test.ts (prompt testing)
```

## Success Criteria

- [ ] All 20 tools tested with valid inputs
- [ ] All 20 tools tested with invalid inputs
- [ ] All error cases return proper MCP error format
- [ ] All validation rules enforced
- [ ] Real-world scenarios pass
- [ ] Performance benchmarks met
- [ ] 90%+ code coverage on handlers
- [ ] Zero flaky tests

## Next Steps

1. Document all tool schemas and validation rules
2. Create test fixtures for common data
3. Implement comprehensive test suite
4. Add performance benchmarks
5. Create CI/CD pipeline integration
