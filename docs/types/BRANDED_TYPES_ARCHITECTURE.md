# Branded Types Architecture

**A guide to understanding and using branded types in DevFlow MCP**

## What Are Branded Types?

Branded types use TypeScript's type system to create **distinct types from primitives**, preventing accidental misuse.

### The Problem Without Branding

```typescript
// All these are just "strings" to TypeScript
function getEntity(name: string) { ... }
function getUser(id: string) { ... }
function formatDate(timestamp: string) { ... }

const userId = "user-123"
const entityName = "MyEntity"
const timestamp = "2024-01-01"

// All of these compile, even when wrong!
getEntity(userId)        // ❌ Wrong but compiles
getUser(entityName)      // ❌ Wrong but compiles
formatDate(entityName)   // ❌ Wrong but compiles
```

### The Solution With Branding

```typescript
// Each is a distinct branded type
type EntityName = string & { __brand: "EntityName" }
type UserId = string & { __brand: "UserId" }
type Timestamp = number & { __brand: "Timestamp" }

function getEntity(name: EntityName) { ... }
function getUser(id: UserId) { ... }
function formatDate(timestamp: Timestamp) { ... }

const userId = "user-123" as UserId
const entityName = "MyEntity" as EntityName
const timestamp = 1234567890 as Timestamp

getEntity(userId)        // ✅ Compile error!
getUser(entityName)      // ✅ Compile error!
formatDate(entityName)   // ✅ Compile error!
```

## Our Branded Types

Located in `src/types/validation.ts`:

```typescript
import { z } from "#config"

// Time-related
export const TimestampSchema = z.number().int().nonnegative().brand<"Timestamp">()
export type Timestamp = z.infer<typeof TimestampSchema>

export const VersionSchema = z.number().int().positive().brand<"Version">()
export type Version = z.infer<typeof VersionSchema>

// Score-related
export const ConfidenceScoreSchema = z.number().min(0).max(1).brand<"ConfidenceScore">()
export type ConfidenceScore = z.infer<typeof ConfidenceScoreSchema>

export const StrengthScoreSchema = z.number().min(0).max(1).brand<"StrengthScore">()
export type StrengthScore = z.infer<typeof StrengthScoreSchema>

// ID-related
export const EntityIdSchema = z.string().uuid().brand<"EntityId">()
export type EntityId = z.infer<typeof EntityIdSchema>

export const RelationIdSchema = z.string().brand<"RelationId">()
export type RelationId = z.infer<typeof RelationIdSchema>

// Name-related
export const EntityNameSchema = z
  .string()
  .min(1, "Entity name cannot be empty")
  .max(255, "Entity name too long")
  .brand<"EntityName">()
export type EntityName = z.infer<typeof EntityNameSchema>
```

## How Branded Types Flow Through The System

### Layer 1: MCP Protocol (JSON)

```json
{
  "method": "tools/call",
  "params": {
    "name": "delete_entities",
    "arguments": {
      "entityNames": ["User", "Product", "Order"]
    }
  }
}
```

**Type**: Plain JSON - no types yet

### Layer 2: Handler Input Validation (Zod)

```typescript
// src/server/handlers/call-tool-handler.ts
export async function handleDeleteEntities(
  args: unknown,  // ← Unknown input from JSON
  manager: KnowledgeGraphManager,
  logger?: Logger,
): Promise<MCPToolResponse> {
  // Validate with Zod schema
  const result = DeleteEntitiesInputSchema.safeParse(args)

  if (!result.success) {
    return buildErrorResponse("Validation failed")
  }

  // result.data.entityNames is now EntityName[] (branded!)
  const { entityNames } = result.data
}
```

**Input Schema**:
```typescript
export const DeleteEntitiesInputSchema = z.object({
  entityNames: z.array(EntityNameSchema).min(1),
}).strict()
```

**Type Flow**:
- `args: unknown` → validated → `entityNames: EntityName[]` (branded)

### Layer 3: Handler to Business Logic (Type Extraction)

```typescript
// Still in handler
const { entityNames } = result.data  // entityNames: EntityName[]

// Pass to business logic - extract from brand
await manager.deleteEntities(
  entityNames.map(name => name as string)  // ← Extract to plain string
)
```

**Why extract?**
- Business logic methods currently expect `string[]`
- Phase 4 will update business logic to accept branded types directly
- For now, we extract at the boundary

### Layer 4: Business Logic (Future: Branded Types)

**Current (Phase 3)**:
```typescript
// src/knowledge-graph-manager.ts
class KnowledgeGraphManager {
  async deleteEntities(names: string[]): Promise<void> {
    // Works with plain strings
    await this.database.deleteEntities(names)
  }
}
```

**Future (Phase 4)**:
```typescript
// src/knowledge-graph-manager.ts
class KnowledgeGraphManager {
  async deleteEntities(names: EntityName[]): Promise<void> {
    // Accepts branded types, extracts when calling database
    await this.database.deleteEntities(
      names.map(n => n as string)
    )
  }
}
```

### Layer 5: Database Layer (Plain Types)

```typescript
// src/db/sqlite-db.ts
class SqliteDb {
  async deleteEntities(names: string[]): Promise<void> {
    // Database operations use plain strings
    const placeholders = names.map(() => "?").join(",")
    const sql = `DELETE FROM entities WHERE name IN (${placeholders})`
    this.db.exec(sql, ...names)
  }
}
```

**Why plain types here?**
- SQL operations need primitive types
- Database layer is the "boundary" between typed domain and raw storage

## Validation vs Runtime Conversion

### Validation (Preferred)

Use Zod schemas to validate AND brand in one step:

```typescript
// Input validation
const result = EntityNameSchema.safeParse("MyEntity")
if (result.success) {
  const name: EntityName = result.data  // ← Validated AND branded
}

// Array validation
const result = z.array(EntityNameSchema).safeParse(["User", "Product"])
if (result.success) {
  const names: EntityName[] = result.data  // ← All validated AND branded
}
```

### Runtime Conversion (Use Sparingly)

Only use `as` casting when you're certain the value is valid:

```typescript
// ✅ OK - Known safe context
function createEntity(name: string) {
  // This is internal, we control the input
  const brandedName = name as EntityName
  return { name: brandedName, ... }
}

// ❌ AVOID - Untrusted input
function handleInput(userInput: string) {
  // Don't do this! Validate instead
  const name = userInput as EntityName  // ← No validation!
}
```

## Common Patterns

### Pattern 1: Validate Input

```typescript
// Handler receives unknown input
async function handleTool(args: unknown) {
  // Validate
  const result = ToolInputSchema.safeParse(args)
  if (!result.success) {
    return buildErrorResponse("Invalid input")
  }

  // result.data has all branded types
  const { entityName, timestamp, confidence } = result.data
  // entityName: EntityName
  // timestamp: Timestamp
  // confidence: ConfidenceScore
}
```

### Pattern 2: Pass to Business Logic

```typescript
// Current approach (Phase 3)
async function handleTool(args: unknown) {
  const { entityName } = validated.data

  // Extract brand when calling business logic
  await manager.getEntity(entityName as string)
}

// Future approach (Phase 4)
async function handleTool(args: unknown) {
  const { entityName } = validated.data

  // Pass branded type directly
  await manager.getEntity(entityName)  // ← Manager accepts EntityName
}
```

### Pattern 3: Build Response

```typescript
// Response data also uses branded types
const output = {
  entityName: result.name,           // EntityName
  createdAt: result.created,         // Timestamp
  confidence: result.confidence,     // ConfidenceScore
}

// Validate response against output schema
const validatedOutput = OutputSchema.parse(output)

return buildSuccessResponse(validatedOutput)
```

## Benefits of Our Approach

### 1. Compile-Time Safety

```typescript
function updateEntity(name: EntityName, timestamp: Timestamp) { ... }

const name: EntityName = "User" as EntityName
const timestamp: Timestamp = 1234567890 as Timestamp
const version: Version = 5 as Version

updateEntity(name, timestamp)   // ✅ OK
updateEntity(name, version)     // ❌ Compile error - Version is not Timestamp
updateEntity(timestamp, name)   // ❌ Compile error - wrong order
```

### 2. Self-Documenting Code

```typescript
// ❌ Unclear - what kind of number?
function getEntity(id: string, timestamp: number) { ... }

// ✅ Clear - exactly what each parameter is
function getEntity(name: EntityName, timestamp: Timestamp) { ... }
```

### 3. Refactoring Safety

```typescript
// Change entity identification from name to ID
// Before:
function getEntity(name: EntityName) { ... }

// After:
function getEntity(id: EntityId) { ... }

// All call sites get compile errors, forcing updates
getEntity(entityName)  // ❌ Compile error - helps find all usages
```

### 4. Validation + Types = One Step

```typescript
// Single operation: validate AND brand
const result = EntityNameSchema.safeParse(input)
if (result.success) {
  const name = result.data  // ← Already branded!
  // No need for separate validation then casting
}
```

## When To Use Branded Types

### ✅ Use For:

- **Domain identifiers**: EntityName, EntityId, RelationId
- **Scores/metrics**: ConfidenceScore, StrengthScore (0-1 range)
- **Timestamps**: Timestamp (Unix timestamp), Version (version number)
- **Domain primitives**: Any value with semantic meaning beyond its primitive type

### ❌ Don't Use For:

- **Temporary variables**: Local calculations, intermediate results
- **Generic data**: Plain strings/numbers with no domain meaning
- **Performance-critical paths**: Where type overhead matters (rare)
- **External library interfaces**: When libraries expect plain types

## Migration Phases

### Phase 3 (Current)

**Status**: Handlers use branded types, business logic uses plain types

```typescript
// Handler (uses branded)
const { entityName } = validated.data  // EntityName

// Business logic (expects plain)
await manager.getEntity(entityName as string)
```

**Characteristics**:
- Validation happens at handler boundary
- Type safety in handlers
- Extraction at business logic boundary

### Phase 4 (Next)

**Status**: Business logic updated to accept branded types

```typescript
// Handler (uses branded)
const { entityName } = validated.data  // EntityName

// Business logic (accepts branded)
await manager.getEntity(entityName)  // ← No extraction needed

// Manager (Phase 4 update)
class KnowledgeGraphManager {
  async getEntity(name: EntityName): Promise<Entity> {
    // Extract only when calling database
    return await this.database.getEntity(name as string)
  }
}
```

**Characteristics**:
- Type safety through business logic layer
- Extraction only at database boundary
- Clearer domain modeling

### Phase 5 (Future - Optional)

**Status**: Database layer accepts branded types

```typescript
// Complete type safety through all layers
class SqliteDb {
  async getEntity(name: EntityName): Promise<Entity> {
    // Extract only when building SQL
    const sql = `SELECT * FROM entities WHERE name = ?`
    return this.db.get(sql, name as string)
  }
}
```

**Characteristics**:
- Type safety everywhere
- Extraction only at SQL boundary
- Maximum compile-time checking

## Common Mistakes

### Mistake 1: Using Branded Type Where Plain Expected

```typescript
const name = "User" as EntityName

// ❌ This will fail - Set expects plain strings
const names = new Set<string>([name])

// ✅ Extract first
const names = new Set<string>([name as string])
```

### Mistake 2: Forgetting to Validate

```typescript
// ❌ DANGEROUS - no validation
function handleInput(userInput: string) {
  const name = userInput as EntityName  // Trust user input??
  await manager.getEntity(name)
}

// ✅ SAFE - validate first
function handleInput(userInput: string) {
  const result = EntityNameSchema.safeParse(userInput)
  if (!result.success) {
    return buildErrorResponse("Invalid entity name")
  }
  await manager.getEntity(result.data)
}
```

### Mistake 3: Mixing Branded Types

```typescript
const timestamp: Timestamp = 1234567890 as Timestamp
const version: Version = 5 as Version

// ❌ Compile error - can't mix brands
const combined: Timestamp = version

// ✅ If you really need to convert (rare), be explicit
const timeFromVersion: Timestamp = (version as number) as Timestamp
```

## Testing with Branded Types

### Use Test Builders

```typescript
// src/tests/builders/entity-builder.ts
export class EntityBuilder {
  private name: EntityName = "TestEntity" as EntityName

  withName(name: string): this {
    // Validate and brand
    this.name = EntityNameSchema.parse(name)
    return this
  }

  build(): Entity {
    return {
      name: this.name,
      // ...
    }
  }
}

// Usage
const entity = new EntityBuilder()
  .withName("MyTest")
  .build()
```

### Mock with Branded Types

```typescript
const mockEntity: Entity = {
  name: "MockEntity" as EntityName,
  entityType: "test" as EntityType,
  observations: [],
}

// Or use builders
const mockEntity = new EntityBuilder().build()
```

## Summary

**Branded types provide**:
1. Compile-time safety against mixing similar primitives
2. Self-documenting code with semantic types
3. Validation + typing in one step (via Zod)
4. Refactoring safety through type checking

**Best practices**:
1. Always validate untrusted input with Zod schemas
2. Extract brands at layer boundaries (currently business logic, eventually database)
3. Don't overuse - only for domain primitives with semantic meaning
4. Use builders for testing

**Current state**:
- ✅ Handlers use branded types
- ✅ Validation schemas produce branded types
- 🔄 Business logic still uses plain types (Phase 4)
- 🔄 Database layer uses plain types (will remain)
