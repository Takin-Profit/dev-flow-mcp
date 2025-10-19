# DevFlow MCP Type System Guide

**Last Updated:** 2025-10-17
**Status:** Post ArkType→Zod Migration, Ongoing Cleanup

## Table of Contents

1. [Overview](#overview)
2. [Type Safety Architecture](#type-safety-architecture)
3. [Branded Types: When and How](#branded-types-when-and-how)
4. [Current State](#current-state)
5. [Completed Work](#completed-work)
6. [Remaining Work](#remaining-work)
7. [MCP Compliance](#mcp-compliance)
8. [Key Findings](#key-findings)

---

## Overview

DevFlow MCP uses **Zod for runtime validation** at API boundaries with **branded types for critical domain primitives**. This guide explains our pragmatic approach to type safety.

### Core Philosophy

1. **Validate at API boundaries** - All user input goes through Zod schemas
2. **Brand strategically** - Only use branded types where they add real value
3. **Keep it simple** - Avoid over-engineering and premature abstraction
4. **YAGNI principle** - Don't add complexity for theoretical future needs

---

## Type Safety Architecture

### The Three Layers

```
┌─────────────────────────────────────┐
│   API Layer (MCP Tools/Handlers)   │  ← Zod validation
│   - Input validation with schemas  │
│   - Output validation (TODO)       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│      Business Logic Layer          │  ← Branded types (selective)
│   - KnowledgeGraphManager          │
│   - EmbeddingJobManager            │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│      Database Layer                │  ← Raw types OK
│   - SqliteDb (single impl)         │
│   - No abstraction needed          │
└─────────────────────────────────────┘
```

### File Organization

- **`src/types/validation.ts`** - All Zod schemas, branded type definitions
- **`src/types/responses.ts`** - MCP response envelope, error codes only
- **`src/types/*.ts`** - Re-export wrappers for backward compatibility

---

## Branded Types: When and How

### When to Use Branded Types

✅ **DO use branded types for:**
- Standalone primitives from user input (e.g., `EntityName`)
- Values that need validation and have domain significance
- Data crossing trust boundaries (API → internal)

❌ **DON'T use branded types for:**
- Fields in validated objects (parent schema already validates)
- Internal-only values (e.g., hardcoded priorities)
- Data that never leaves the system
- Over-engineering "just in case"

### Branding vs. Flavoring

We use **branding** via Zod's `.brand<T>()` method:

```typescript
// In validation.ts
export const EntityNameSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .brand<"EntityName">()

export type EntityName = z.infer<typeof EntityNameSchema>
```

**Why branding over flavoring?**
- We validate at API boundaries anyway
- Branding enforces that validation happened
- Type safety where it matters most

### Current Branded Types

Located in `src/types/validation.ts`:

| Type | Purpose | Validation |
|------|---------|------------|
| `EntityName` | Entity identifiers | 1-200 chars, alphanumeric + `_-` |
| `EntityType` | Entity category | Literal union of valid types |
| `RelationType` | Relation category | Literal union of valid types |
| `Observation` | Entity observation text | 1-10000 chars |
| `StrengthScore` | Relation strength | 0.0-1.0 float |
| `ConfidenceScore` | Relation confidence | 0.0-1.0 float |
| `Timestamp` | Unix timestamp ms | Non-negative integer |
| `CharacterOffset` | String position | Non-negative integer |
| `EntityField` | Field name in entity | String |
| `Count` | Item count | Non-negative integer |
| `Duration` | Time duration ms | Non-negative integer |

**Removed branded types** (found to be overkill):
- ~~`Priority`~~ - Internal enum instead
- ~~`BatchSize`~~ - Simple number with default
- ~~`JobId`~~ - UUID string, not from user input

---

## Current State

### Migration Status

- ✅ **ArkType → Zod migration** - Complete
- ✅ **SQLite-only architecture** - Neo4j removed
- ✅ **Type safety audit** - In progress
- ⚠️ **Output validation** - Not yet implemented
- ⚠️ **TypeScript errors** - ~80 errors remaining (mostly branded type mismatches)

### Known Issues

1. **Branded Type Mismatches in Database Layer**
   - Database returns raw primitives from SQL queries
   - Business logic expects branded types
   - Need to cast or validate at boundary

2. **Missing Output Validation**
   - Schemas exist in `validation.ts`
   - Not used to validate handler outputs
   - Should validate before `buildSuccessResponse()`

3. **Type Abstraction Removal**
   - Removed useless `Database` interface (only one impl: `SqliteDb`)
   - Removed type guards for "optional" methods (all implemented)
   - Simplified `KnowledgeGraphManager` to use `SqliteDb` directly

---

## Completed Work

### This Session (2025-10-17)

1. **Added Branded Types** (validation.ts)
   - `CharacterOffset`, `EntityField`, `Count`, `Duration`
   - Later removed: `Priority`, `BatchSize`, `JobId` (overkill)

2. **Fixed `any` Types**
   - `EmbeddingDatabase.db`: Changed from `any` to `DB` type
   - `initializeVectorStore`: Removed unused `_options: any` parameter

3. **Removed Over-Engineering**
   - Deleted `Database` interface entirely
   - Removed type guards: `hasSearchVectors`, `hasSemanticSearch`, `hasUpdateRelation`
   - Removed extended database interfaces
   - Removed priority system from embedding jobs (was always 1, now FIFO)

4. **Cleaned Up Response Types**
   - Removed legacy `createSuccessResponseSchema` function
   - Removed unused `*ResponseSchema` definitions
   - Kept only `MCPToolResponseSchema` and `ErrorCode` enum

5. **Fixed Circular Dependencies**
   - Moved `KnowledgeGraphManagerOptions` from types folder to knowledge-graph-manager.ts
   - Broke cycle: types/knowledge-graph.ts → db/database.ts → types

### Previous Sessions

1. **ArkType → Zod Migration** (Complete)
   - All validation schemas migrated
   - Backward-compatible re-exports maintained
   - Documentation updated

2. **SQLite-Only Architecture** (Complete)
   - Neo4j implementation deleted
   - Vector store integrated into SQLite
   - Simplified storage layer

---

## Remaining Work

### High Priority

1. **Fix Database Layer Type Mismatches** (~80 TypeScript errors)
   - Option A: Cast raw DB values to branded types after reading
   - Option B: Remove branded types from internal Entity/Relation types
   - **Recommendation:** Option A - validate/cast at DB boundary

2. **Implement Output Validation**
   - Use existing `*OutputSchema` from validation.ts
   - Validate before calling `buildSuccessResponse()`
   - Catch implementation bugs early

3. **Fix Remaining TypeScript Errors**
   - `.catch()` on non-Promise values (use try/catch)
   - Implicit `any` types in parameters
   - Missing properties (`total` on `KnowledgeGraph`)
   - String → EntityName branded type mismatches

### Medium Priority

4. **Review Search Implementation**
   - Multiple search methods with unclear responsibilities
   - Semantic search, hybrid search, text search all intertwined
   - Consider simplifying

5. **Review VectorStore Abstraction**
   - Only used with SQLite's internal vector store
   - Type doesn't match actual usage
   - Consider removing abstraction

6. **Audit Temporal Types**
   - `TemporalEntity` vs `Entity` usage unclear
   - Database returns `TemporalEntity[]`
   - Manager expects `Entity[]`

### Low Priority

7. **Documentation**
   - Update API documentation
   - Add JSDoc to public methods
   - Document branded type usage patterns

8. **Testing**
   - Add tests for Zod schemas
   - Test branded type validation
   - E2E tests for MCP compliance

---

## MCP Compliance

### Tool Response Format

All tools must return `MCPToolResponse`:

```typescript
{
  content: [
    {
      type: "text",
      text: string  // JSON.stringify(data, null, 2)
    }
  ],
  isError?: boolean,
  structuredContent?: Record<string, unknown>  // The actual data object
}
```

### Error Handling

**The Golden Rule:** Tool errors should be reported within the result object, not as MCP protocol-level errors.

```typescript
// ✅ Correct - LLM can see and handle the error
return {
  isError: true,
  content: [{ type: "text", text: "Entity 'Foo' not found" }]
}

// ❌ Wrong - Breaks MCP protocol, LLM can't handle
throw new Error("Entity 'Foo' not found")
```

**Protocol-level errors** (JSON-RPC) only for:
- Unknown tool names
- Invalid JSON
- Server crashes

### Input/Output Validation

**Input validation** (implemented):
```typescript
const result = CreateEntitiesInputSchema.safeParse(params)
if (!result.success) {
  return buildValidationErrorResponse(result.error)
}
```

**Output validation** (TODO):
```typescript
const output = { created: 1, entities: [...] }
const validated = CreateEntitiesOutputSchema.parse(output)
return buildSuccessResponse(validated)
```

---

## Key Findings

### What We Learned

1. **Abstractions Have a Cost**
   - The `Database` interface added zero value
   - Type guards protected against problems that didn't exist
   - "Future-proofing" created complexity without benefit

2. **Branded Types Aren't Free**
   - Must cast or validate at every boundary
   - Easy to over-apply (Priority, JobId, BatchSize were overkill)
   - Best for user-facing primitives, not internal data

3. **YAGNI is Real**
   - Priority system was never used (always 1)
   - Multiple database implementations never needed
   - Optional methods in interface were all implemented

4. **Validation Should Have Purpose**
   - Input validation: Protects against bad user data ✅
   - Output validation: Catches implementation bugs ✅
   - Internal validation: Usually overkill ❌

### Pragmatic Type Safety Rules

1. **Validate at trust boundaries** (API → code, DB → code)
2. **Use branded types sparingly** (only where they add clarity)
3. **Prefer simple types internally** (validated objects don't need branded fields)
4. **Delete unused abstractions** (interfaces, type guards, wrappers)
5. **Don't future-proof** (solve actual problems, not theoretical ones)

---

## References

- **Zod Documentation:** https://zod.dev
- **MCP Specification:** https://modelcontextprotocol.io
- **TypeScript Branded Types:** https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

---

## Changelog

### 2025-10-17
- Removed `Database` interface and all type guards
- Removed priority system from embedding jobs
- Cleaned up response type definitions
- Fixed circular dependency in types folder
- Added pragmatic guidelines for branded types
