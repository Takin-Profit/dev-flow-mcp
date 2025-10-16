# DevFlow MCP: SQLite Migration Roadmap

**Created:** 2025-10-16
**Target Completion:** 2-3 days
**Goal:** Complete migration from Neo4j to SQLite and delete all Neo4j code

---

## Overview

This roadmap outlines the concrete steps to complete the Neo4j → SQLite migration. Each phase includes specific files to modify, code changes to make, and tests to run.

---

## Phase 1: Configuration Migration

**Duration:** 2-4 hours
**Priority:** 🔴 **CRITICAL** (Blocks all other work)
**Status:** ❌ Not Started

### Objectives

1. Make SQLite the default storage backend
2. Add SQLite configuration schema
3. Update factories to support both backends (for transition period)
4. Make storage type configurable via environment variable

---

### Task 1.1: Update Main Configuration

**File:** `src/config.ts`

**Changes:**

```typescript
// BEFORE:
const storageType = "neo4j" // Hardcoded

// AFTER:
const storageType = z.enum(["sqlite", "neo4j"]).default("sqlite")
```

**Add SQLite Config Schema:**

```typescript
const sqliteConfig = z.object({
  location: z.string().default("./devflow.db"),
  vectorDimensions: z.number().int().positive().default(1536),
  allowExtension: z.boolean().default(true),
})
```

**Environment Variables:**

```typescript
DFM_STORAGE_TYPE: storageType.parse(process.env.DFM_STORAGE_TYPE),
DFM_SQLITE_LOCATION: z.string().default("./devflow.db").parse(process.env.DFM_SQLITE_LOCATION),
DFM_SQLITE_VECTOR_DIMENSIONS: z.coerce.number().default(1536).parse(process.env.DFM_SQLITE_VECTOR_DIMENSIONS),
```

**Validation:**
- [ ] TypeScript compiles
- [ ] Config loads with defaults
- [ ] Environment variables override defaults

---

### Task 1.2: Update Storage Provider Factory

**File:** `src/storage/storage-provider-factory.ts`

**Changes:**

```typescript
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteStorageProvider } from "./sqlite/sqlite-storage-provider"
import { SqliteSchemaManager } from "./sqlite/sqlite-schema-manager"

export async function createStorageProvider(
  config: StorageConfig,
  logger: Logger
): Promise<StorageProvider> {
  switch (config.type) {
    case "sqlite": {
      // Create SQLite database instance
      const db = new DB({
        location: config.sqlite.location,
        logger: logger as any,
        allowExtension: true,
      })

      // Load sqlite-vec extension
      loadSqliteVec(db.nativeDb)

      // Initialize schema
      const schemaManager = new SqliteSchemaManager(
        db,
        logger,
        config.sqlite.vectorDimensions
      )
      await schemaManager.initializeSchema()

      // Create storage provider
      return new SqliteStorageProvider(db, logger, {
        vectorDimensions: config.sqlite.vectorDimensions,
      })
    }

    case "neo4j": {
      // Existing Neo4j code...
      return new Neo4jStorageProvider(/* ... */)
    }

    default:
      throw new Error(`Unknown storage type: ${config.type}`)
  }
}
```

**Validation:**
- [ ] Creates SQLite provider correctly
- [ ] Loads sqlite-vec extension
- [ ] Initializes schema on startup
- [ ] Falls back to Neo4j if configured

---

### Task 1.3: Update Vector Store Factory

**File:** `src/storage/vector-store-factory.ts`

**Changes:**

```typescript
import { SqliteVectorStore } from "./sqlite/sqlite-vector-store"

export async function createVectorStore(
  config: StorageConfig,
  logger: Logger
): Promise<VectorStore> {
  switch (config.type) {
    case "sqlite": {
      const db = new DB({
        location: config.sqlite.location,
        logger: logger as any,
        allowExtension: true,
      })

      loadSqliteVec(db.nativeDb)

      return new SqliteVectorStore({
        db,
        dimensions: config.sqlite.vectorDimensions,
        logger,
      })
    }

    case "neo4j": {
      // Existing Neo4j code...
    }

    default:
      throw new Error(`Unknown storage type: ${config.type}`)
  }
}
```

**Validation:**
- [ ] Creates SQLite vector store
- [ ] Uses correct dimensions
- [ ] Shares same DB instance as storage provider (or opens same file)

---

### Task 1.4: Add SQLite CLI Commands

**File:** `src/cli/sqlite.ts` (NEW FILE)

**Create:**

```typescript
import { Command } from "commander"
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteSchemaManager } from "../storage/sqlite/sqlite-schema-manager"
import { logger } from "../logger"
import { getConfig } from "../config"

export function createSqliteCommand(): Command {
  const sqlite = new Command("sqlite")
    .description("SQLite database management commands")

  sqlite
    .command("init")
    .description("Initialize SQLite schema (tables, indexes, triggers)")
    .option("--recreate", "Drop and recreate all tables (WARNING: destructive)")
    .action(async (options) => {
      const config = getConfig()
      const db = new DB({
        location: config.sqlite.location,
        logger: logger as any,
        allowExtension: true,
      })

      loadSqliteVec(db.nativeDb)

      const schemaManager = new SqliteSchemaManager(
        db,
        logger,
        config.sqlite.vectorDimensions
      )

      if (options.recreate) {
        logger.warn("Recreating schema - all data will be lost!")
        schemaManager.resetSchema()
      } else {
        await schemaManager.initializeSchema()
      }

      logger.info("SQLite schema initialized successfully")
      db.close()
    })

  sqlite
    .command("info")
    .description("Show SQLite database information")
    .action(async () => {
      const config = getConfig()
      const db = new DB({
        location: config.sqlite.location,
        logger: logger as any,
        allowExtension: true,
      })

      loadSqliteVec(db.nativeDb)

      // Get database stats
      const stats = {
        location: config.sqlite.location,
        exists: db.isOpen(),
        sqliteVersion: db.sql`SELECT sqlite_version() as version`.get(),
        vecVersion: db.sql`SELECT vec_version() as version`.get(),
        entityCount: db.sql`SELECT COUNT(*) as count FROM entities WHERE valid_to IS NULL`.get(),
        relationCount: db.sql`SELECT COUNT(*) as count FROM relations WHERE valid_to IS NULL`.get(),
        embeddingCount: db.sql`SELECT COUNT(*) as count FROM embeddings`.get(),
      }

      console.log(JSON.stringify(stats, null, 2))
      db.close()
    })

  return sqlite
}
```

**Update:** `src/cli/index.ts` to register command

**Validation:**
- [ ] `npm run sqlite:init` initializes schema
- [ ] `npm run sqlite:info` shows database stats
- [ ] `npm run sqlite:init --recreate` resets database

---

### Phase 1 Validation Checklist

- [ ] Server starts with `DFM_STORAGE_TYPE=sqlite`
- [ ] SQLite database file created at `./devflow.db`
- [ ] No Neo4j connection errors
- [ ] Schema tables created (entities, relations, embeddings, embedding_metadata)
- [ ] sqlite-vec extension loaded successfully
- [ ] Can switch back to Neo4j with `DFM_STORAGE_TYPE=neo4j`

---

## Phase 2: E2E Testing with SQLite

**Duration:** 1-2 days
**Priority:** 🟡 **HIGH** (Validates production readiness)
**Status:** ❌ Not Started
**Depends On:** Phase 1

### Objectives

1. Port existing E2E test plan to SQLite
2. Test all 20 MCP tools with SQLite backend
3. Validate data integrity and correctness
4. Benchmark performance

---

### Task 2.1: Setup E2E Test Infrastructure

**File:** `src/tests/integration/e2e/setup.ts` (NEW FILE)

**Create:**

```typescript
import { DB } from "@takinprofit/sqlite-x"
import { load as loadSqliteVec } from "sqlite-vec"
import { SqliteStorageProvider } from "#storage/sqlite/sqlite-storage-provider"
import { SqliteSchemaManager } from "#storage/sqlite/sqlite-schema-manager"
import { logger } from "#logger"

export async function setupTestDatabase(): Promise<{
  db: DB
  storage: SqliteStorageProvider
}> {
  const db = new DB({
    location: ":memory:",
    logger: logger as any,
    allowExtension: true,
  })

  loadSqliteVec(db.nativeDb)

  const schemaManager = new SqliteSchemaManager(db, logger, 1536)
  await schemaManager.initializeSchema()

  const storage = new SqliteStorageProvider(db, logger, {
    vectorDimensions: 1536,
  })

  return { db, storage }
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

describe("MCP CRUD Operations E2E", () => {
  let db: DB
  let storage: SqliteStorageProvider

  before(async () => {
    ({ db, storage } = await setupTestDatabase())
  })

  after(() => {
    teardownTestDatabase(db)
  })

  describe("create_entities", () => {
    test("creates single entity with all fields", async () => {
      const entities = await storage.createEntities([
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
      const entities = await storage.createEntities([
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

- [ ] All 20 MCP tools tested
- [ ] All validation tests pass
- [ ] Real-world scenarios work
- [ ] Performance acceptable:
  - CRUD operations: <50ms
  - Search: <100ms
  - Batch operations: <1s
  - Large graph queries: <200ms
- [ ] No data corruption
- [ ] Temporal versioning correct
- [ ] Vector search returns relevant results
- [ ] All errors handled gracefully

---

## Phase 3: Neo4j Code Removal

**Duration:** 2-3 hours
**Priority:** 🟢 **CLEANUP** (Non-blocking)
**Status:** ❌ Not Started
**Depends On:** Phase 2

### Objectives

1. Delete all Neo4j-specific code
2. Remove Neo4j dependencies
3. Clean up configuration
4. Update imports and types

---

### Task 3.1: Delete Neo4j Files

**Files to Delete:**

```bash
# Storage implementation
rm -rf src/storage/neo4j/

# Types
rm src/types/neo4j.ts

# CLI
rm src/cli/neo4j.ts

# Tests
rm src/tests/integration/neo4j-storage.integration.test.ts
rm src/tests/integration/neo4j-vector-store.integration.test.ts
```

**Validation:**
- [ ] Files deleted
- [ ] Git shows deletions
- [ ] No broken imports

---

### Task 3.2: Update Configuration

**File:** `src/config.ts`

**Changes:**

```typescript
// REMOVE Neo4j config schema entirely
// REMOVE Neo4jConfig type
// REMOVE NEO4J_* environment variables
// KEEP only SQLite configuration

const storageConfig = z.object({
  type: z.literal("sqlite"), // Remove enum, only SQLite
  sqlite: sqliteConfig,
})
```

---

### Task 3.3: Update Factories

**File:** `src/storage/storage-provider-factory.ts`

**Changes:**

```typescript
// REMOVE Neo4j case statement
// REMOVE Neo4j imports

export async function createStorageProvider(
  config: StorageConfig,
  logger: Logger
): Promise<StorageProvider> {
  // Only SQLite case remains
  const db = new DB({ /* ... */ })
  loadSqliteVec(db.nativeDb)
  // ...
  return new SqliteStorageProvider(/* ... */)
}
```

**Repeat for:** `src/storage/vector-store-factory.ts`

---

### Task 3.4: Update Type Definitions

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
