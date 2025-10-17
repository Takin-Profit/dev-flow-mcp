# DevFlow MCP - Future Improvements

## High Priority

### 1. Migrate from ArkType to Zod
- [ ] Replace all arktype schemas with Zod equivalents in existing files
- [ ] Update `src/types/shared.ts` - replace EntityName and Observation arktype schemas
- [ ] Update `src/types/entity.ts` - replace Entity and EntityEmbedding schemas
- [ ] Update `src/types/relation.ts` - replace Relation and RelationMetadata schemas
- [ ] Update `src/types/neo4j.ts` - replace Neo4j-specific validators
- [ ] Remove arktype dependency from package.json
- [ ] Update all imports across codebase (12 files currently use arktype)
- [ ] Maintain same file structure - don't create new files, just replace content
- **Rationale**: Zod is more widely adopted, better TypeScript integration, already used in MCP SDK

### 2. Use Branded/Nominal Types Instead of Raw Scalars
- [ ] Replace `string` with `EntityName` branded type everywhere
- [ ] Replace `number` with semantic types like `Timestamp`, `Score`, `Confidence`, etc.
- [ ] Create branded types for:
  - `EntityName` (already defined, needs consistent usage)
  - `EntityId` (for database IDs)
  - `Timestamp` (Unix milliseconds)
  - `RelationStrength` (0-1 range)
  - `RelationConfidence` (0-1 range)
  - `SimilarityScore` (0-1 range)
  - `VectorDimension` (positive integer)
- [ ] Update function signatures to use branded types
- [ ] Update storage provider interfaces to use branded types
- **Benefits**:
  - Better type safety (can't accidentally mix up entity names with other strings)
  - Self-documenting code (function signatures are clearer)
  - Validation at type boundaries
  - IDE autocomplete improvements

### 3. Improve Error Handling and Reporting
- [ ] Create standardized error types for different failure modes:
  - `ValidationError` - input validation failures
  - `StorageError` - database/storage failures
  - `NotFoundError` - entity/relation not found
  - `DuplicateError` - constraint violations
  - `EmbeddingError` - embedding service failures
- [ ] Ensure all validation errors include:
  - Field path (e.g., "entity.name", "relation.from")
  - Expected value/format
  - Actual value received
  - Human-readable error message
- [ ] Add error codes for programmatic error handling
- [ ] Improve error messages returned to MCP clients
- [ ] Add structured logging for errors (include context, not just messages)
- [ ] Create error aggregation for batch operations (don't fail entire batch on single error)
- **User Experience Impact**:
  - Users get clear, actionable error messages
  - Easier debugging for both users and developers
  - Better error recovery in client applications

### 4. Validation Error Context
- [ ] When validation fails, include:
  - Input that failed validation
  - Validation rule that was violated
  - Suggestions for fixing (e.g., "remove spaces from entity name")
  - Examples of valid inputs
- [ ] Add validation error formatting for MCP responses
- [ ] Create helper functions for common validation scenarios

## Medium Priority

### 5. SQLite Performance Optimization
- [ ] Add database indexes for common query patterns
- [ ] Implement prepared statement caching
- [ ] Add query performance logging
- [ ] Consider implementing connection pooling (when Node.js async API available)

### 6. Vector Search Improvements
- [ ] Fully implement semantic search in SQLite provider
- [ ] Add embedding generation for observations on entity updates
- [ ] Implement hybrid search (text + vector)
- [ ] Add embedding cache to avoid regeneration

### 7. Testing
- [ ] Add unit tests for all validation schemas
- [ ] Add integration tests for SQLite storage provider
- [ ] Add e2e tests comparing Neo4j and SQLite behavior
- [ ] Add property-based testing for validation edge cases

## Low Priority

### 8. Documentation
- [ ] Document validation rules in user-facing docs
- [ ] Add examples of valid/invalid entity names
- [ ] Document error codes and their meanings
- [ ] Create migration guide from Neo4j to SQLite

### 9. Code Quality
- [ ] Remove all magic numbers (replace with named constants)
- [ ] Consolidate duplicate validation logic
- [ ] Extract common patterns into utility functions
- [ ] Reduce cognitive complexity in storage providers

## Notes

- Priority order may change based on user feedback
- Items should be tackled after SQLite migration is complete and stable
- Each item should be a separate PR with tests
- Maintain backward compatibility where possible
