# DevFlow MCP: SQLite Migration Roadmap

**Created:** 2025-10-16
**Target Completion:** 2-3 days
**Goal:** Complete migration from Neo4j to SQLite and delete all Neo4j code

---

## Overview

This roadmap outlines the concrete steps to complete the Neo4j → SQLite migration with a **SQLite-only architecture**. DevFlow MCP is 100% committed to SQLite with no plans for other storage backends. This allows us to remove all abstraction layers and simplify the codebase significantly.

Each phase includes specific files to modify, code changes to make, and tests to run.

---

## Phase 1: Architecture Simplification

**Duration:** 3-5 hours
**Priority:** 🔴 **CRITICAL** (Blocks all other work)
**Status:** ❌ Not Started

### Objectives

1. **Extreme Simplification** - Remove ALL abstraction layers
2. **Directory restructure** - `src/storage/` → `src/db/` (we're dealing with a database)
3. **Clear naming** - No generic names, use explicit `SqliteDb`, `SqliteVectorStore`, `SqliteSchemaManager`
4. **Delete factories** - Direct instantiation only
5. **Minimal configuration** - One option: database file location

---

### Task 1.1: Restructure to `src/db/` with Clear SQLite Names

**Objective:** Move from `src/storage/` to `src/db/` with explicit SQLite class names

**Commands:**
```bash
# Rename directory
mv src/storage src/db

# Rename files (from src/db/sqlite/ to src/db/)
mv src/db/sqlite/sqlite-storage-provider.ts src/db/sqlite-db.ts
mv src/db/sqlite/sqlite-vector-store.ts src/db/sqlite-vector-store.ts
mv src/db/sqlite/sqlite-schema-manager.ts src/db/sqlite-schema-manager.ts

# Delete empty nested directory
rmdir src/db/sqlite/

# Delete factory files
rm src/db/storage-provider-factory.ts
rm src/db/vector-store-factory.ts
```

**Update Class Names:**
In the renamed files:
- `class SqliteStorageProvider` → `class SqliteDb`
- `class SqliteVectorStore` → `class SqliteVectorStore` (already clear)
- `class SqliteSchemaManager` → `class SqliteSchemaManager` (already clear)

**Update Imports:** Global find/replace across codebase
- Find: `from "#storage/sqlite/sqlite-storage-provider"`
- Replace: `from "#db/sqlite-db"`
- Find: `from "#storage/sqlite/sqlite-vector-store"`
- Replace: `from "#db/sqlite-vector-store"`
- Find: `from "#storage/sqlite/sqlite-schema-manager"`
- Replace: `from "#db/sqlite-schema-manager"`
- Find: `#storage/` (path alias)
- Replace: `#db/` (new path alias)

**Update tsconfig.json paths:**
```json
{
  "compilerOptions": {
    "paths": {
      "#db/*": ["./src/db/*"]  // was "#storage/*"
    }
  }
}
```

**Validation:**
- [ ] Directory renamed to `src/db/`
- [ ] All files in `src/db/` (not nested)
- [ ] Class names are explicit: `SqliteDb`, `SqliteVectorStore`, `SqliteSchemaManager`
- [ ] Factory files deleted
- [ ] All imports updated
- [ ] TypeScript compiles
- [ ] Tests still pass

---

### Task 1.2: Simplify Configuration

**File:** `src/config.ts`

**Remove:**
```typescript
// DELETE these lines:
DFM_STORAGE_TYPE: z.enum(["neo4j", "sqlite"])
Neo4jConfig (entire schema)
NEO4J_* environment variables (all of them)
```

**Simplify to:**
```typescript
// SQLite Configuration (minimal, user-facing)
const config = z.object({
  // Database location (only user-configurable option)
  sqliteLocation: z.string().default("./devflow.db"),

  // All other SQLite settings are INTERNAL (not exposed to users)
  // - Vector dimensions: hardcoded to 1536
  // - WAL mode: enabled by default
  // - Cache size: optimized internally
  // - Busy timeout: set internally
  // - Extensions: automatically loaded
})

// Environment variable mapping
export const getConfig = () => ({
  sqliteLocation: process.env.DFM_SQLITE_LOCATION ?? "./devflow.db",

  // Internal optimizations (not exposed)
  _internal: {
    vectorDimensions: 1536,
    walMode: true,
    cacheSize: -64000, // 64MB
    busyTimeout: 5000,
  }
})
```

**Validation:**
- [ ] Only one user-facing config option (`DFM_SQLITE_LOCATION`)
- [ ] All Neo4j config removed
- [ ] No storage type selection
- [ ] TypeScript compiles

---

### Task 1.3: Update Server Initialization - Direct SQLite Instantiation

**Objective:** Remove factory pattern, use direct SQLite class instantiation

**File to UPDATE:** `src/server/index.ts`

**BEFORE (with factories):**
```typescript
import { createStorageProvider } from "#storage/storage-provider-factory"
import { createVectorStore } from "#storage/vector-store-factory"

const storage = await createStorageProvider(config, logger)
const vectorStore = await createVectorStore(config, logger)
```

**AFTER (direct SQLite):**
```typescript
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteDb } from "#db/sqlite-db"
import { SqliteVectorStore } from "#db/sqlite-vector-store"
import { SqliteSchemaManager } from "#db/sqlite-schema-manager"

// Direct SQLite initialization
const db = new DB({
  location: config.sqliteLocation,
  logger: logger as any,
  allowExtension: true,
})

// Load sqlite-vec extension
loadSqliteVec(db.nativeDb)

// Apply internal optimizations (not exposed to users)
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA cache_size = -64000") // 64MB
db.exec("PRAGMA busy_timeout = 5000")
db.exec("PRAGMA synchronous = NORMAL") // Faster writes
db.exec("PRAGMA temp_store = MEMORY") // Use memory for temp tables

// Initialize schema
const schemaManager = new SqliteSchemaManager(db, logger)
await schemaManager.initializeSchema()

// Create database instances (explicit SQLite classes)
const sqliteDb = new SqliteDb(db, logger)
const vectorStore = new SqliteVectorStore({ db, logger })
```

**Validation:**
- [ ] No factory imports
- [ ] Direct SQLite class instantiation
- [ ] Internal optimizations applied (not configurable)
- [ ] Clear naming: `SqliteDb`, `SqliteVectorStore`, `SqliteSchemaManager`
- [ ] Server starts successfully
- [ ] TypeScript compiles
- [ ] Tests pass

---

### Task 1.4: Simplify CLI Commands

**Objective:** Remove Neo4j CLI, use direct SQLite classes in CLI

**File to DELETE:**
```bash
rm src/cli/neo4j.ts
```

**File to UPDATE:** `src/cli/index.ts`

**Remove:**
```typescript
// DELETE import:
import { createNeo4jCommand } from "./neo4j"

// DELETE registration:
program.addCommand(createNeo4jCommand())
```

**Update database commands** (use direct SQLite classes):

```typescript
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
import { getConfig } from "#config"

// Rename "sqlite" command to just "db" (it's the only database)
export function createDbCommand(): Command {
  const db = new Command("db")
    .description("SQLite database management")

  db.command("init")
    .description("Initialize database schema")
    .option("--reset", "Reset database (destructive)")
    .action(async (options) => {
      const config = getConfig()

      // Direct SQLite instantiation
      const database = new DB({
        location: config.sqliteLocation,
        allowExtension: true,
      })

      loadSqliteVec(database.nativeDb)

      // Explicit SQLite class
      const schemaManager = new SqliteSchemaManager(database, logger)

      if (options.reset) {
        await schemaManager.resetSchema()
      } else {
        await schemaManager.initializeSchema()
      }

      database.close()
    })

  db.command("info")
    .description("Show SQLite database information")
    .action(async () => {
      // Show SQLite-specific stats
    })

  return db
}
```

**Validation:**
- [ ] Neo4j CLI deleted
- [ ] Commands use `SqliteSchemaManager` (not generic names)
- [ ] Imports from `#db/` (not `#storage/`)
- [ ] Commands work: `db init`, `db info`

---

### Phase 1 Validation Checklist

**Directory Structure:**
- [ ] `src/storage/` renamed to `src/db/`
- [ ] All files in `src/db/` (no nested `sqlite/` directory)
- [ ] Path alias updated: `#db/*` (was `#storage/*`)

**Clear Naming:**
- [ ] `SqliteDb` class (was `SqliteStorageProvider`)
- [ ] `SqliteVectorStore` class (explicit SQLite prefix)
- [ ] `SqliteSchemaManager` class (explicit SQLite prefix)
- [ ] Files named: `sqlite-db.ts`, `sqlite-vector-store.ts`, `sqlite-schema-manager.ts`

**Abstraction Removal:**
- [ ] Factory files deleted (`storage-provider-factory.ts`, `vector-store-factory.ts`)
- [ ] No generic interfaces (no `StorageProvider` interface for abstraction)
- [ ] Direct instantiation in `src/server/index.ts`

**Configuration:**
- [ ] Only one user option: `DFM_SQLITE_LOCATION`
- [ ] Internal optimizations hardcoded (WAL, cache, busy timeout, etc.)
- [ ] No storage type selection
- [ ] All Neo4j config removed

**Functionality:**
- [ ] Server starts with direct SQLite instantiation
- [ ] SQLite database created at `./devflow.db`
- [ ] Internal optimizations applied automatically
- [ ] Schema initialized automatically
- [ ] sqlite-vec extension loaded
- [ ] All tests pass (76/76)
- [ ] TypeScript compiles
- [ ] CLI commands use `SqliteSchemaManager` directly

---

## Phase 2: E2E Testing

**Duration:** 1-2 days
**Priority:** 🟡 **HIGH** (Validates production readiness)
**Status:** ❌ Not Started
**Depends On:** Phase 1

### Objectives

1. Test all 20 MCP tools with simplified architecture
2. Validate direct SQLite implementation works correctly
3. Verify internal optimizations are effective
4. Benchmark performance with optimized defaults

---

### Task 2.1: Setup E2E Test Infrastructure

**File:** `src/tests/integration/e2e/setup.ts` (NEW FILE)

**Create:**

```typescript
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteDb } from "#db/sqlite-db"
import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
import { SqliteVectorStore } from "#db/sqlite-vector-store"
import { logger } from "#logger"

export async function setupTestDatabase(): Promise<{
  db: DB
  sqliteDb: SqliteDb
  vectorStore: SqliteVectorStore
}> {
  // In-memory SQLite database for tests
  const db = new DB({
    location: ":memory:",
    logger: logger as any,
    allowExtension: true,
  })

  // Load sqlite-vec
  loadSqliteVec(db.nativeDb)

  // Apply same optimizations as production (hardcoded, not configurable)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA cache_size = -64000")
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA synchronous = NORMAL")
  db.exec("PRAGMA temp_store = MEMORY")

  // Initialize schema (explicit SQLite class)
  const schemaManager = new SqliteSchemaManager(db, logger)
  await schemaManager.initializeSchema()

  // Create SQLite instances (explicit naming)
  const sqliteDb = new SqliteDb(db, logger)
  const vectorStore = new SqliteVectorStore({ db, logger })

  return { db, sqliteDb, vectorStore }
}

export function teardownTestDatabase(db: DB): void {
  db.close()
}
```

---

### Task 2.2: Test Core CRUD Operations

**File:** `src/tests/integration/e2e/mcp-crud.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **create_entities**
   - Create single entity
   - Create multiple entities in batch
   - Reject invalid entity types
   - Reject missing required fields
   - Handle duplicate names (should update existing)

2. **read_graph**
   - Read empty graph
   - Read graph with entities
   - Read graph with relations
   - Filter by entity type

3. **delete_entities**
   - Delete single entity
   - Delete multiple entities
   - Cascade delete relations
   - Remove vectors from vector store
   - Verify soft delete (valid_to set)

4. **add_observations**
   - Add observation to entity
   - Add multiple observations
   - Create new version
   - Preserve history

5. **delete_observations**
   - Delete single observation
   - Delete multiple observations
   - Create new version
   - Preserve remaining observations

**Template:**

```typescript
import { describe, test, before, after } from "node:test"
import assert from "node:assert/strict"
import { setupTestDatabase, teardownTestDatabase } from "./setup"
import type { DB } from "@takinprofit/sqlite-x"
import type { SqliteDb } from "#db/sqlite-db"

describe("MCP CRUD Operations E2E", () => {
  let db: DB
  let sqliteDb: SqliteDb

  before(async () => {
    ({ db, sqliteDb } = await setupTestDatabase())
  })

  after(() => {
    teardownTestDatabase(db)
  })

  describe("create_entities", () => {
    test("creates single entity with all fields", async () => {
      const entities = await sqliteDb.createEntities([
        {
          name: "test-feature",
          entityType: "feature",
          observations: ["Initial implementation"],
        },
      ])

      assert.strictEqual(entities.length, 1)
      assert.strictEqual(entities[0].name, "test-feature")
      assert.strictEqual(entities[0].entityType, "feature")
      assert.strictEqual(entities[0].version, 1)
      assert.ok(entities[0].id)
      assert.ok(entities[0].createdAt)
      assert.ok(entities[0].validFrom)
      assert.strictEqual(entities[0].validTo, null)
    })

    test("creates multiple entities in batch", async () => {
      const entities = await sqliteDb.createEntities([
        { name: "entity1", entityType: "task", observations: [] },
        { name: "entity2", entityType: "decision", observations: [] },
        { name: "entity3", entityType: "component", observations: [] },
      ])

      assert.strictEqual(entities.length, 3)
      assert.strictEqual(entities[0].name, "entity1")
      assert.strictEqual(entities[1].name, "entity2")
      assert.strictEqual(entities[2].name, "entity3")
    })

    // Add more test cases...
  })

  // Add more describe blocks for other tools...
})
```

---

### Task 2.3: Test Relation Management

**File:** `src/tests/integration/e2e/mcp-relations.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **create_relations**
   - Create relation between entities
   - Set strength and confidence
   - Validate relation types
   - Reject non-existent entities

2. **get_relation**
   - Get existing relation
   - Return null for non-existent
   - Include metadata

3. **update_relation**
   - Update strength
   - Update confidence
   - Update metadata
   - Create new version
   - Preserve history

4. **delete_relations**
   - Delete single relation
   - Delete multiple relations
   - Soft delete (valid_to set)

5. **get_relation_history**
   - Return all versions
   - Chronological order
   - Include all metadata

---

### Task 2.4: Test Search & Discovery

**File:** `src/tests/integration/e2e/mcp-search.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **search_nodes**
   - Search by name pattern
   - Search by entity type
   - Return matching entities
   - Case sensitivity

2. **semantic_search**
   - Search with query vector
   - Return similar entities
   - Include relations
   - Fallback to text search

3. **open_nodes**
   - Open multiple nodes by name
   - Return entities with relations
   - Handle non-existent nodes

---

### Task 2.5: Test Temporal Features

**File:** `src/tests/integration/e2e/mcp-temporal.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **get_entity_history**
   - Return all versions
   - Chronological order
   - Show version numbers
   - Include all observations

2. **get_graph_at_time**
   - Query past state
   - Filter by validFrom/validTo
   - Include entities and relations

3. **get_decayed_graph**
   - Apply confidence decay
   - Use exponential calculation
   - Respect minimum threshold
   - Use configurable half-life

---

### Task 2.6: Test Embedding Management

**File:** `src/tests/integration/e2e/mcp-embeddings.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **get_entity_embedding**
   - Return embedding if exists
   - Return null if not exists
   - Include model info

2. **force_generate_embedding**
   - Generate new embedding
   - Update existing embedding
   - Store in vector store

---

### Task 2.7: Test Validation & Error Handling

**File:** `src/tests/integration/e2e/mcp-validation.e2e.test.ts` (NEW FILE)

**Test Cases:**

1. **Input Validation**
   - Invalid entity types rejected
   - Invalid relation types rejected
   - Missing required fields
   - Array field validation
   - Type coercion

2. **Error Responses**
   - Proper MCP error format
   - Clear error messages
   - Status codes

3. **Edge Cases**
   - Empty arrays
   - Special characters in names
   - Very long strings
   - Null/undefined handling

---

### Task 2.8: Test Real-World Scenarios

**File:** `src/tests/integration/e2e/mcp-scenarios.e2e.test.ts` (NEW FILE)

**Scenarios:**

1. **Software Development Workflow**
   - Create feature entity
   - Add implementation tasks
   - Link task dependencies
   - Track decisions
   - Search for related work
   - Generate embeddings
   - Semantic search

2. **Knowledge Graph Evolution**
   - Create entities over time
   - Update observations (new versions)
   - Query history
   - Point-in-time queries
   - Confidence decay

3. **Complex Dependency Graph**
   - Multiple features
   - Shared components
   - Relation chains
   - Graph traversal

---

### Task 2.9: Performance Benchmarking

**File:** `src/tests/integration/e2e/mcp-performance.e2e.test.ts` (NEW FILE)

**Benchmarks:**

1. **Batch Operations**
   - Create 100 entities in one call
   - Create 100 relations in one call
   - Measure time (<1 second)

2. **Search Performance**
   - Text search with 100 entities
   - Semantic search with 100 embeddings
   - Measure time (<100ms)

3. **Large Graph**
   - Create graph with 500 entities
   - 1000 relations
   - Query performance
   - Memory usage

---

### Phase 2 Validation Checklist

- [ ] All 20 MCP tools tested with simplified architecture
- [ ] All validation tests pass
- [ ] Real-world scenarios work correctly
- [ ] Internal optimizations verified (WAL mode, cache settings)
- [ ] Performance meets targets:
  - CRUD operations: <50ms
  - Search: <100ms
  - Batch operations: <1s
  - Large graph queries: <200ms
- [ ] No data corruption
- [ ] Temporal versioning correct
- [ ] Vector search with hardcoded dimensions (1536) works
- [ ] All errors handled gracefully
- [ ] Zero-configuration setup works in tests

---

## Phase 3: Cleanup & Code Removal

**Duration:** 2-3 hours
**Priority:** 🟢 **CLEANUP** (Non-blocking)
**Status:** ❌ Not Started
**Depends On:** Phase 2

### Objectives

1. Delete all Neo4j-specific code (~4,500 lines)
2. Remove Neo4j dependencies from package.json
3. Clean up Neo4j-specific types and configuration
4. Remove Docker Compose Neo4j service
5. Verify all abstraction layers removed (from Phase 1)

---

### Task 3.1: Delete Neo4j Files & Verify Abstraction Removal

**Files to Delete:**

```bash
# Neo4j implementation (~4,000 lines)
rm -rf src/storage/neo4j/

# Neo4j types
rm src/types/neo4j.ts

# Neo4j CLI (if not already removed in Phase 1)
rm src/cli/neo4j.ts

# Neo4j tests
rm src/tests/integration/neo4j-storage.integration.test.ts
rm src/tests/integration/neo4j-vector-store.integration.test.ts
```

**Verify Abstraction Layers Removed (from Phase 1):**

```bash
# These should NOT exist (deleted in Phase 1):
# src/storage/storage-provider-factory.ts
# src/storage/vector-store-factory.ts
# src/storage/sqlite/ (directory should be empty or deleted)

# Run verification:
ls src/storage/storage-provider-factory.ts 2>/dev/null && echo "ERROR: Factory still exists!" || echo "✓ Factory removed"
ls src/storage/vector-store-factory.ts 2>/dev/null && echo "ERROR: Factory still exists!" || echo "✓ Factory removed"
ls -d src/storage/sqlite/ 2>/dev/null && echo "ERROR: sqlite/ dir still exists!" || echo "✓ Directory removed"
```

**Validation:**
- [ ] All Neo4j files deleted
- [ ] Abstraction layers verified removed
- [ ] Git shows ~5,000 line deletion
- [ ] No broken imports
- [ ] TypeScript compiles

---

### Task 3.2: Final Configuration Cleanup

**File:** `src/config.ts`

**Note:** Most config changes done in Phase 1. This is final cleanup.

**Verify Removed:**
```typescript
// These should already be gone (from Phase 1):
// - DFM_STORAGE_TYPE
// - Neo4jConfig type
// - NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, etc.
```

**Final cleanup if any Neo4j references remain:**
```typescript
// Remove any lingering Neo4j imports
// Remove any Neo4j-related type definitions
// Ensure config only has SQLite options
```

---

### Task 3.3: Update Type Definitions

**File:** `src/types/storage.ts`

**Changes:**

```typescript
// REMOVE Neo4jConfig
// REMOVE references to neo4j types
// KEEP StorageProvider interface (storage-agnostic)
```

---

### Task 3.5: Remove package.json Dependencies

**File:** `package.json`

**Changes:**

```json
{
  "dependencies": {
    // REMOVE "neo4j-driver": "^6.0.0",
    // KEEP "@takinprofit/sqlite-x": "^1.2.3",
    // KEEP "sqlite-vec": "0.1.7-alpha.2"
  }
}
```

**Run:** `pnpm install` to update lockfile

---

### Task 3.6: Update Docker Compose (Optional)

**File:** `docker-compose.yml`

**Changes:**

```yaml
# REMOVE neo4j service entirely
# REMOVE volumes for neo4j-data
# REMOVE ports 7474, 7687
```

---

### Task 3.7: Update CLI

**File:** `src/cli/index.ts`

**Changes:**

```typescript
// REMOVE import of neo4j command
// REMOVE program.addCommand(createNeo4jCommand())
// KEEP sqlite command
```

---

### Phase 3 Validation Checklist

- [ ] Zero Neo4j code in `src/`
- [ ] Zero Neo4j dependencies in `package.json`
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Server starts without Neo4j
- [ ] Git diff shows ~4,500 lines deleted

---

## Phase 4: Documentation Updates

**Duration:** 2-3 hours
**Priority:** 🟢 **CLEANUP** (Non-blocking)
**Status:** ❌ Not Started
**Depends On:** Phase 3

### Objectives

1. Update README with SQLite instructions
2. Consolidate docs folder
3. Remove Neo4j references
4. Add migration guide

---

### Task 4.1: Update README.md

**File:** `README.md`

**Changes:**

```markdown
# REMOVE
- Neo4j 5.13+ requirement
- Docker Compose setup for Neo4j
- Neo4j connection parameters

# ADD
- SQLite (built-in, no installation needed!)
- SQLite database location configuration
- Zero-configuration quick start

## Quick Start

1. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

2. Run the server:
   \`\`\`bash
   pnpm dev
   \`\`\`

That's it! SQLite database will be created automatically at `./devflow.db`.

## Configuration

### SQLite (Default)

- **DFM_SQLITE_LOCATION** - Database file path (default: `./devflow.db`)
- **DFM_SQLITE_VECTOR_DIMENSIONS** - Vector dimensions (default: 1536)

## Development

### Initialize Database Schema

\`\`\`bash
pnpm run sqlite:init
\`\`\`

### View Database Info

\`\`\`bash
pnpm run sqlite:info
\`\`\`
```

---

### Task 4.2: Update CONTRIBUTING.md

**File:** `CONTRIBUTING.md`

**Changes:**

```markdown
# REMOVE
- Docker setup instructions
- npm run neo4j:init
- Neo4j connection testing

# SIMPLIFY
- Development environment (just Node.js + pnpm)
- Testing (no external dependencies)
```

---

### Task 4.3: Consolidate Documentation

**Files to Delete:**

```bash
cd docs/
rm sqlite-temporal-implementation-plan.md  # 51kb - already executed
rm sqlite-temporal-implementation-code-review.md  # 11kb - already done
rm sqlite-temporal-implementation-summary.md  # 4.9kb - redundant
rm sqlite-vector-implementation-plan.md  # 54kb - already executed
rm sqlite-vector-implementation-complete.md  # 9.8kb - redundant
rm sqlite-vector-testing-blockers.md  # 36kb - resolved
rm sqlite-vector-testing-fix-implementation-plan.md  # 31kb - executed
```

**Files to Keep:**

```
docs/
├── MIGRATION_STATUS.md  (THIS DOCUMENT - comprehensive status)
├── ROADMAP.md  (Implementation roadmap)
├── E2E_TEST_PLAN.md  (Test plan to port)
└── E2E_TEST_SUMMARY.md  (Test results when done)
```

**Total Space Saved:** ~200kb of redundant documentation

---

### Task 4.4: Create Migration Guide

**File:** `docs/MIGRATION_GUIDE.md` (NEW FILE)

**Content:**

```markdown
# Migrating from Neo4j to SQLite

If you were using DevFlow MCP with Neo4j, here's how to migrate to SQLite.

## Why Migrate?

- **Zero Configuration** - No Docker, no external database
- **Portable** - Single file database
- **Faster Development** - No connection overhead
- **Same Features** - Full feature parity

## Migration Steps

### Option 1: Fresh Start (Recommended)

1. Pull latest changes
2. Delete old Neo4j database (if desired)
3. Run `pnpm install`
4. Run `pnpm dev`

SQLite database will be created automatically.

### Option 2: Migrate Data

If you need to preserve Neo4j data:

1. Export from Neo4j:
   \`\`\`bash
   npm run neo4j:export > data.json
   \`\`\`

2. Import to SQLite:
   \`\`\`bash
   npm run sqlite:import < data.json
   \`\`\`

(Note: Export/import scripts not yet implemented)

## Configuration Changes

### Old (Neo4j)

\`\`\`bash
DFM_STORAGE_TYPE=neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=dfm_password
NEO4J_DATABASE=neo4j
\`\`\`

### New (SQLite)

\`\`\`bash
DFM_STORAGE_TYPE=sqlite  # Optional, now default
DFM_SQLITE_LOCATION=./devflow.db  # Optional
\`\`\`

## FAQs

**Q: Can I still use Neo4j?**
A: No, Neo4j support has been removed in v2.0. Use v1.x if you need Neo4j.

**Q: Will my embeddings work?**
A: Yes! SQLite uses the same vector search library (sqlite-vec).

**Q: Is SQLite as fast as Neo4j?**
A: For typical workloads (< 10k entities), SQLite is actually faster.

**Q: Can I backup my data?**
A: Yes, just copy the `devflow.db` file.
```

---

### Phase 4 Validation Checklist

- [ ] README has no Neo4j references
- [ ] README shows SQLite quick start
- [ ] CONTRIBUTING simplified
- [ ] Docs folder cleaned up (~4 files remaining)
- [ ] Migration guide published
- [ ] All links working

---

## Success Metrics

### Code Quality
- [ ] Zero TypeScript errors
- [ ] Zero linting errors
- [ ] All tests passing (unit + E2E)
- [ ] Test coverage > 80%

### Performance
- [ ] CRUD operations < 50ms
- [ ] Search operations < 100ms
- [ ] Batch operations < 1s
- [ ] Startup time < 2s

### Documentation
- [ ] README accurate and complete
- [ ] Migration guide clear
- [ ] API documentation up-to-date
- [ ] No dead links

### Deployment
- [ ] Server starts without errors
- [ ] Database auto-initialized
- [ ] Zero configuration required
- [ ] Works on macOS, Linux, Windows

---

## Rollback Plan

If migration fails, we can rollback:

1. Revert to `main` branch
2. Neo4j code still exists in git history
3. Can restore Neo4j service from Docker Compose

**Risk:** Low (SQLite implementation is complete and tested)

---

## Post-Migration Tasks (Future Work)

### Performance Optimization
- [ ] Add covering indexes for common queries
- [ ] Enable WAL mode for concurrency
- [ ] Implement connection pooling (if needed)
- [ ] Add query performance monitoring

### Feature Enhancements
- [ ] Data export/import tools
- [ ] Backup/restore CLI commands
- [ ] Database vacuum/optimize command
- [ ] Migration scripts for schema changes

### Monitoring
- [ ] Add database size tracking
- [ ] Query performance metrics
- [ ] Error rate monitoring
- [ ] Usage analytics

---

## Timeline

| Phase | Task | Duration | Start | End |
|-------|------|----------|-------|-----|
| **Phase 1** | Configuration Migration | 2-4 hours | Day 1 AM | Day 1 PM |
| **Phase 2** | E2E Testing | 1-2 days | Day 1 PM | Day 2 PM |
| **Phase 3** | Neo4j Removal | 2-3 hours | Day 2 PM | Day 2 EOD |
| **Phase 4** | Documentation | 2-3 hours | Day 3 AM | Day 3 PM |
| **Total** | **Complete Migration** | **2-3 days** | - | - |

---

## Next Steps

1. **Review this roadmap** with team/stakeholders
2. **Create branch** `sqlite-migration-final` from `sqlite`
3. **Start Phase 1** (Configuration Migration)
4. **Run validation** after each phase
5. **Merge to main** when all phases complete

---

## Contact

For questions or issues during migration, contact:
- **Repository Issues:** https://github.com/your-org/devflow-mcp/issues
- **Documentation:** `/docs` folder

---

**Last Updated:** 2025-10-16
**Maintainer:** DevFlow Team
