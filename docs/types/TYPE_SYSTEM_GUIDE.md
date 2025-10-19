# DevFlow MCP Type System Guide

**Last Updated:** 2025-10-19
**Status:** Complete - Zod v4 Migration & SQLite-Only Architecture

## Table of Contents

1. [Overview](#overview)
2. [Type Safety Architecture](#type-safety-architecture)
3. [Zod v4 Implementation](#zod-v4-implementation)
4. [Database Types](#database-types)
5. [MCP Protocol Types](#mcp-protocol-types)
6. [Migration Summary](#migration-summary)

---

## Overview

DevFlow MCP uses **Zod v4 for comprehensive runtime validation** with a **SQLite-only architecture**. The type system is designed for simplicity, safety, and maintainability.

### Core Philosophy

1. **Zod v4 everywhere** - Consistent validation across the entire codebase
2. **SQLite-first** - All types designed around SQLite's capabilities
3. **Zero `any` types** - Complete TypeScript type safety
4. **API boundary validation** - All external input validated with Zod schemas
5. **Self-documenting** - Types serve as living documentation

---

## Type Safety Architecture

### Input Validation Flow

```
External Input (unknown)
    ↓
Zod Schema Validation (API boundary)
    ↓ 
Typed Objects (Entity, Relation, etc.)
    ↓
SQLite Storage (with sqlite-x type safety)
```

### Key Principles

- **Single source of truth**: Zod schemas define both runtime validation and TypeScript types
- **Fail fast**: Invalid data is caught at API boundaries
- **Type inference**: TypeScript types are inferred from Zod schemas
- **No double validation**: Data validated once at entry point

---

## Zod v4 Implementation

### Schema Organization

```typescript
// Core entity validation
export const EntitySchema = z.object({
  name: z.string().min(1).max(255),
  entityType: z.enum(["feature", "task", "decision", "component", "test"]),
  observations: z.array(z.string().min(1))
})

// Relation validation with enhanced metadata
export const RelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1), 
  relationType: z.enum(["implements", "depends_on", "relates_to", "part_of"]),
  strength: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional()
})
```

### Configuration with z.config()

```typescript
// Enhanced error messages with zod-validation-error
z.config({
  customError: createErrorMap({
    displayInvalidFormatDetails: false,
    maxAllowedValuesToDisplay: 10,
    // ... additional configuration
  })
})
```

### UUID Generation

```typescript
// Zod v4 native UUID validation
export const EntityIdSchema = z.uuidv4()
export const JobIdSchema = z.uuidv4()
```

---

## Database Types

### SQLite-Specific Types

```typescript
// Temporal entity with version history
export interface TemporalEntity extends Entity {
  id: string
  version: number
  createdAt: number
  updatedAt: number
  validFrom: number
  validTo: number | null
}

// Enhanced relation with decay support
export interface TemporalRelation extends Relation {
  id: string
  version: number
  createdAt: number
  updatedAt: number
  validFrom: number
  validTo: number | null
  decayedConfidence?: number
}
```

### Vector Search Types

```typescript
// Entity embedding for semantic search
export interface EntityEmbedding {
  entityName: string
  vector: number[]
  model: string
  dimensions: number
  createdAt: number
}

// Search result with similarity scoring
export interface SimilarEntity {
  entity: Entity
  similarity: number
}
```

---

## MCP Protocol Types

### Tool Definitions

```typescript
// MCP tool response structure
export interface MCPToolResponse {
  content: Array<{
    type: "text"
    text: string
  }>
  isError?: boolean
}

// Tool argument validation
export const CreateEntitiesArgsSchema = z.object({
  entities: z.array(EntitySchema)
})
```

### Error Handling

```typescript
// Structured error responses
export class DFMError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
  }
}

// Error code enumeration
export type ErrorCode = 
  | "INVALID_INPUT"
  | "ENTITY_NOT_FOUND"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR"
```

---

## Migration Summary

### Completed Migrations

#### ✅ Zod v4 Migration
- **From**: Zod v3 with compatibility issues
- **To**: Zod v4 with forked MCP SDK (@socotra/modelcontextprotocol-sdk)
- **Impact**: Full compatibility, modern features, enhanced validation

#### ✅ SQLite-Only Architecture  
- **From**: Neo4j + SQLite multi-backend
- **To**: SQLite-only with sqlite-vec for vector search
- **Impact**: Simplified deployment, zero external dependencies

#### ✅ Type Safety Enhancement
- **From**: Mixed type safety with some `any` types
- **To**: Zero `any` types, complete TypeScript coverage
- **Impact**: Better IDE support, fewer runtime errors

#### ✅ Database Self-Initialization
- **From**: External database setup required
- **To**: Self-initializing SqliteDb class with environment awareness
- **Impact**: Simplified setup, automatic configuration

### Architecture Improvements

1. **Dependency Injection**: Testable, modular architecture
2. **Structured Logging**: Winston + Consola for observability  
3. **Environment Awareness**: Development/testing/production configurations
4. **Error Handling**: Comprehensive error types with proper propagation
5. **Test Coverage**: Type-safe tests with proper assertions

### Performance Optimizations

1. **SQLite Pragmas**: Environment-specific database optimization
2. **Vector Search**: Native sqlite-vec integration
3. **Connection Pooling**: Efficient database connection management
4. **Caching**: LRU cache for frequently accessed data

---

## Best Practices

### Schema Design

1. **Use specific types**: Prefer enums over generic strings
2. **Add constraints**: Min/max lengths, number ranges
3. **Document with descriptions**: Use `.describe()` for clarity
4. **Version schemas**: Plan for schema evolution

### Error Handling

1. **Validate early**: Check input at API boundaries
2. **Fail gracefully**: Provide meaningful error messages
3. **Log appropriately**: Structure logs for debugging
4. **Handle edge cases**: Consider null/undefined scenarios

### Testing

1. **Type-safe assertions**: Use proper type guards in tests
2. **Mock appropriately**: Mock external dependencies, not internal logic
3. **Test boundaries**: Focus on API validation and error cases
4. **Integration tests**: Verify end-to-end functionality

---

## Future Considerations

### Potential Enhancements

1. **Schema Registry**: Centralized schema versioning
2. **Custom Validators**: Domain-specific validation rules
3. **Performance Monitoring**: Type-aware performance tracking
4. **Documentation Generation**: Auto-generate API docs from schemas

### Maintenance

1. **Regular Updates**: Keep Zod and dependencies current
2. **Schema Evolution**: Plan for backward-compatible changes
3. **Performance Review**: Monitor validation performance
4. **Type Coverage**: Maintain 100% TypeScript coverage

The type system is now mature, well-tested, and ready for production use with excellent developer experience and runtime safety.
