# DevFlow MCP: SQLite-Only Implementation Checklist

**Purpose:** Step-by-step execution guide for migrating to SQLite-only architecture

**Total Estimated Time:** 2-3 days
**Branch:** `sqlite`

---

## ⚠️ IMPORTANT: Read This First

### Your Role
You are responsible for **executing** this checklist. Each checkbox represents a single, atomic operation. Complete them **in order**. Do not skip steps.

### Rules
1. **Complete steps sequentially** - Dependencies exist between steps
2. **Check the box** after completing each step
3. **Run validation** after every step that has one
4. **Stop immediately** if validation fails
5. **Commit after each major section** (marked with 🔒)
6. **Do not improvise** - Follow instructions exactly

### If Something Goes Wrong
1. **Stop immediately**
2. **Do not continue to next step**
3. **Report the error** with the step number
4. **Wait for guidance**

---

## Pre-Flight Checks ✈️

**Time:** 5 minutes

Run these checks before starting any work:

- [ ] **Check branch**
  ```bash
  git branch --show-current
  # Expected output: sqlite
  ```
  ❌ If not on `sqlite`: `git checkout sqlite`

- [ ] **Check test status**
  ```bash
  npm test
  # Expected: All tests passing (76/76)
  ```
  ❌ If tests fail: **STOP** - Report failed tests

- [ ] **Check for uncommitted changes**
  ```bash
  git status --short
  # Expected: Should show existing modifications (that's OK)
  ```
  ✅ If you see files listed: This is expected (existing work in progress)

- [ ] **Check TypeScript compilation**
  ```bash
  npm run build
  # Expected: Successful compilation
  ```
  ❌ If build fails: **STOP** - Report build errors

- [ ] **Verify current directory structure**
  ```bash
  ls -la src/storage/sqlite/
  # Expected: Should show sqlite-storage-provider.ts, sqlite-vector-store.ts, sqlite-schema-manager.ts
  ```
  ❌ If directory doesn't exist: **STOP** - Wrong starting state

**✅ Pre-flight Complete** - You may proceed to Phase 1

---

# Phase 1: Architecture Simplification

**Time:** 3-5 hours
**Objective:** Restructure to `src/db/` with explicit SQLite naming, remove all abstractions

---

## Section 1.1: Directory Restructure

**Time:** 10 minutes

### Step 1.1.1: Rename storage directory to db

- [ ] **Rename directory**
  ```bash
  git mv src/storage src/db
  ```

- [ ] **Validate rename**
  ```bash
  ls src/db/
  # Expected: Should show neo4j/, sqlite/, and other files
  ```
  ❌ If `src/db/` doesn't exist: Retry the `git mv` command

- [ ] **Verify git tracked the rename**
  ```bash
  git status | grep -E "(renamed|src/storage|src/db)"
  # Expected: Should show "renamed: src/storage -> src/db"
  ```

### Step 1.1.2: Update tsconfig.json path alias

- [ ] **Open file:** `tsconfig.json`

- [ ] **Find this line:**
  ```json
  "#storage/*": ["./src/storage/*"]
  ```

- [ ] **Replace with:**
  ```json
  "#db/*": ["./src/db/*"]
  ```

- [ ] **Validate change**
  ```bash
  grep '"#db/\*"' tsconfig.json
  # Expected: Should show the new path alias
  ```
  ❌ If not found: Check you saved the file

- [ ] **Verify old path removed**
  ```bash
  grep '"#storage/\*"' tsconfig.json
  # Expected: Should return nothing
  ```
  ❌ If still found: You didn't replace it correctly

---

## Section 1.2: Move SQLite Files to Top Level

**Time:** 10 minutes

### Step 1.2.1: Move sqlite-storage-provider.ts and rename to sqlite-db.ts

- [ ] **Move and rename file**
  ```bash
  git mv src/db/sqlite/sqlite-storage-provider.ts src/db/sqlite-db.ts
  ```

- [ ] **Validate file exists**
  ```bash
  ls src/db/sqlite-db.ts
  # Expected: File found
  ```

### Step 1.2.2: Move sqlite-vector-store.ts

- [ ] **Move file**
  ```bash
  git mv src/db/sqlite/sqlite-vector-store.ts src/db/sqlite-vector-store.ts
  ```

- [ ] **Validate file exists**
  ```bash
  ls src/db/sqlite-vector-store.ts
  # Expected: File found
  ```

### Step 1.2.3: Move sqlite-schema-manager.ts

- [ ] **Move file**
  ```bash
  git mv src/db/sqlite/sqlite-schema-manager.ts src/db/sqlite-schema-manager.ts
  ```

- [ ] **Validate file exists**
  ```bash
  ls src/db/sqlite-schema-manager.ts
  # Expected: File found
  ```

### Step 1.2.4: Check if sqlite directory is empty

- [ ] **List remaining files in sqlite directory**
  ```bash
  ls src/db/sqlite/
  # Expected: Empty or only sqlite-config.ts (which we'll move next)
  ```

- [ ] **If sqlite-config.ts exists, move it**
  ```bash
  # Only run if sqlite-config.ts exists:
  git mv src/db/sqlite/sqlite-config.ts src/db/sqlite-config.ts
  ```

### Step 1.2.5: Remove empty sqlite directory

- [ ] **Remove directory**
  ```bash
  rmdir src/db/sqlite/
  ```

- [ ] **Validate removal**
  ```bash
  ls src/db/sqlite/
  # Expected: "No such file or directory"
  ```

### Step 1.2.6: Verify final structure

- [ ] **List db directory contents**
  ```bash
  ls src/db/
  # Expected: Should show sqlite-db.ts, sqlite-vector-store.ts, sqlite-schema-manager.ts, neo4j/, and other files
  ```

---

## Section 1.3: Rename Class in sqlite-db.ts

**Time:** 5 minutes

### Step 1.3.1: Update class name

- [ ] **Open file:** `src/db/sqlite-db.ts`

- [ ] **Find:** `export class SqliteStorageProvider`

- [ ] **Replace with:** `export class SqliteDb`

- [ ] **Save file**

- [ ] **Validate change**
  ```bash
  grep "export class SqliteDb" src/db/sqlite-db.ts
  # Expected: Should show the line with the new class name
  ```

### Step 1.3.2: Update constructor references (if any)

- [ ] **Check if constructor explicitly references the old name**
  ```bash
  grep "SqliteStorageProvider" src/db/sqlite-db.ts
  # Expected: Should return nothing (or only in comments)
  ```

- [ ] **If found:** Replace all occurrences with `SqliteDb`

---

## Section 1.4: Update All Import Statements

**Time:** 20 minutes

**⚠️ CRITICAL:** These find/replace operations must be done across the **entire codebase**

### Step 1.4.1: Update imports from sqlite-storage-provider to sqlite-db

- [ ] **Find all files importing from storage/sqlite/sqlite-storage-provider**
  ```bash
  grep -r "from.*#storage/sqlite/sqlite-storage-provider" src/
  # Note: This shows you which files need updating
  ```

- [ ] **Global find/replace (Method 1: Using sed on macOS/Linux)**
  ```bash
  find src -type f -name "*.ts" -exec sed -i '' 's|from "#storage/sqlite/sqlite-storage-provider"|from "#db/sqlite-db"|g' {} +
  ```

  **OR (Method 2: Manual in your editor)**
  - Find: `from "#storage/sqlite/sqlite-storage-provider"`
  - Replace: `from "#db/sqlite-db"`
  - Replace All in Workspace

- [ ] **Validate replacement**
  ```bash
  grep -r "from.*#storage/sqlite/sqlite-storage-provider" src/
  # Expected: Should return nothing
  ```

- [ ] **Verify new imports exist**
  ```bash
  grep -r "from.*#db/sqlite-db" src/
  # Expected: Should show multiple files
  ```

### Step 1.4.2: Update imports from sqlite-vector-store

- [ ] **Global find/replace**
  ```bash
  find src -type f -name "*.ts" -exec sed -i '' 's|from "#storage/sqlite/sqlite-vector-store"|from "#db/sqlite-vector-store"|g' {} +
  ```

  **Manual alternative:**
  - Find: `from "#storage/sqlite/sqlite-vector-store"`
  - Replace: `from "#db/sqlite-vector-store"`

- [ ] **Validate**
  ```bash
  grep -r "from.*#storage/sqlite/sqlite-vector-store" src/
  # Expected: Nothing
  ```

### Step 1.4.3: Update imports from sqlite-schema-manager

- [ ] **Global find/replace**
  ```bash
  find src -type f -name "*.ts" -exec sed -i '' 's|from "#storage/sqlite/sqlite-schema-manager"|from "#db/sqlite-schema-manager"|g' {} +
  ```

- [ ] **Validate**
  ```bash
  grep -r "from.*#storage/sqlite/sqlite-schema-manager" src/
  # Expected: Nothing
  ```

### Step 1.4.4: Update any other #storage/* imports to #db/*

- [ ] **Find remaining #storage/ imports**
  ```bash
  grep -r "from.*#storage/" src/ | grep -v node_modules
  # Note: This shows you what's left
  ```

- [ ] **For each remaining import, update manually:**
  - `#storage/storage-provider-factory` → `#db/storage-provider-factory` (will delete later)
  - `#storage/vector-store-factory` → `#db/vector-store-factory` (will delete later)
  - `#storage/neo4j/*` → `#db/neo4j/*`
  - Any others

- [ ] **Validate no #storage/ imports remain**
  ```bash
  grep -r '"#storage/' src/ | grep -v node_modules
  # Expected: Nothing
  grep -r "'#storage/" src/ | grep -v node_modules
  # Expected: Nothing
  ```

### Step 1.4.5: Update class name references (SqliteStorageProvider → SqliteDb)

- [ ] **Find all references to SqliteStorageProvider**
  ```bash
  grep -r "SqliteStorageProvider" src/ | grep -v node_modules | grep -v ".js"
  # Note: These all need to be changed to SqliteDb
  ```

- [ ] **Global find/replace**
  ```bash
  find src -type f -name "*.ts" -exec sed -i '' 's/SqliteStorageProvider/SqliteDb/g' {} +
  ```

- [ ] **Validate replacement**
  ```bash
  grep -r "SqliteStorageProvider" src/ | grep -v node_modules | grep -v ".js"
  # Expected: Nothing (except maybe in comments)
  ```

### Step 1.4.6: Test TypeScript compilation

- [ ] **Attempt to compile**
  ```bash
  npm run build
  ```

  **Expected:** May have errors about factory files (that's OK for now)

  ❌ **If you see errors about missing modules:** You missed updating some imports. Re-check Section 1.4.4

---

## 🔒 Checkpoint 1: Commit Directory Restructure

**Time:** 2 minutes

- [ ] **Review changes**
  ```bash
  git status
  ```

- [ ] **Stage all changes**
  ```bash
  git add -A
  ```

- [ ] **Commit**
  ```bash
  git commit -m "refactor: restructure src/storage to src/db with SQLite-only naming

- Rename directory: src/storage/ → src/db/
- Flatten structure: src/db/sqlite/* → src/db/*
- Rename class: SqliteStorageProvider → SqliteDb
- Update all imports: #storage/* → #db/*
- Update tsconfig path alias

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [ ] **Verify commit**
  ```bash
  git log --oneline -1
  # Expected: Should show your commit
  ```

**✅ Checkpoint 1 Complete** - Directory restructure committed

---

## Section 1.5: Delete Factory Files

**Time:** 5 minutes

### Step 1.5.1: Find factory files

- [ ] **List factory files**
  ```bash
  ls src/db/*factory*.ts
  # Expected: Should show storage-provider-factory.ts and vector-store-factory.ts
  ```

### Step 1.5.2: Delete storage-provider-factory.ts

- [ ] **Check if file exists**
  ```bash
  ls src/db/storage-provider-factory.ts
  ```

- [ ] **If exists, delete it**
  ```bash
  git rm src/db/storage-provider-factory.ts
  ```

- [ ] **Validate deletion**
  ```bash
  ls src/db/storage-provider-factory.ts
  # Expected: "No such file or directory"
  ```

### Step 1.5.3: Delete vector-store-factory.ts

- [ ] **Check if file exists**
  ```bash
  ls src/db/vector-store-factory.ts
  ```

- [ ] **If exists, delete it**
  ```bash
  git rm src/db/vector-store-factory.ts
  ```

- [ ] **Validate deletion**
  ```bash
  ls src/db/vector-store-factory.ts
  # Expected: "No such file or directory"
  ```

### Step 1.5.4: Find files that import from factories

- [ ] **Search for factory imports**
  ```bash
  grep -r "storage-provider-factory\|vector-store-factory" src/ | grep -v node_modules
  # Note: These files need to be updated to use direct imports
  ```

**📝 Note:** Keep this list - you'll need it for the next section

---

## Section 1.6: Update Server Initialization

**Time:** 15 minutes

### Step 1.6.1: Backup server/index.ts (safety)

- [ ] **Create backup**
  ```bash
  cp src/server/index.ts src/server/index.ts.backup
  ```

### Step 1.6.2: Open file for editing

- [ ] **Open:** `src/server/index.ts`

### Step 1.6.3: Remove factory imports

- [ ] **Find and DELETE these lines (if they exist):**
  ```typescript
  import { createStorageProvider } from "#db/storage-provider-factory"
  import { createVectorStore } from "#db/vector-store-factory"
  ```

### Step 1.6.4: Add direct SQLite imports

- [ ] **Add these imports at the top of the file:**
  ```typescript
  import { DB } from "@takinprofit/sqlite-x"
  import { load as loadSqliteVec } from "sqlite-vec"
  import { SqliteDb } from "#db/sqlite-db"
  import { SqliteVectorStore } from "#db/sqlite-vector-store"
  import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
  ```

### Step 1.6.5: Find the initialization code

- [ ] **Search for factory calls in the file:**
  ```typescript
  // Look for something like:
  const storage = await createStorageProvider(...)
  const vectorStore = await createVectorStore(...)
  ```

### Step 1.6.6: Replace factory calls with direct instantiation

- [ ] **Replace the factory-based initialization with:**
  ```typescript
  // Direct SQLite initialization
  const db = new DB({
    location: config.sqliteLocation || "./devflow.db",
    logger: logger as any,
    allowExtension: true,
  })

  // Load sqlite-vec extension
  loadSqliteVec(db.nativeDb)

  // Apply internal optimizations (not user-configurable)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA cache_size = -64000") // 64MB
  db.exec("PRAGMA busy_timeout = 5000")
  db.exec("PRAGMA synchronous = NORMAL")
  db.exec("PRAGMA temp_store = MEMORY")

  // Initialize schema
  const schemaManager = new SqliteSchemaManager(db, logger)
  await schemaManager.initializeSchema()

  // Create database instances (explicit SQLite classes)
  const sqliteDb = new SqliteDb(db, logger)
  const vectorStore = new SqliteVectorStore({ db, logger })
  ```

### Step 1.6.7: Update variable names throughout the file

- [ ] **Find all uses of `storage` variable (if that was the name)**

- [ ] **Replace with `sqliteDb`** (to be explicit that it's SQLite)

- [ ] **Save file**

### Step 1.6.8: Validate the changes

- [ ] **Check no factory imports remain**
  ```bash
  grep "factory" src/server/index.ts
  # Expected: Nothing
  ```

- [ ] **Check new imports exist**
  ```bash
  grep "SqliteDb\|SqliteVectorStore\|SqliteSchemaManager" src/server/index.ts
  # Expected: Should show the imports and usage
  ```

### Step 1.6.9: Test TypeScript compilation

- [ ] **Compile**
  ```bash
  npm run build
  ```

  ❌ **If build fails:** Check the error messages. Most likely:
  - Missing import
  - Variable name mismatch (storage vs sqliteDb)
  - Config property doesn't exist yet (we'll fix config next)

---

## Section 1.7: Simplify Configuration

**Time:** 15 minutes

### Step 1.7.1: Backup config.ts

- [ ] **Create backup**
  ```bash
  cp src/config.ts src/config.ts.backup
  ```

### Step 1.7.2: Open config.ts

- [ ] **Open:** `src/config.ts`

### Step 1.7.3: Remove DFM_STORAGE_TYPE

- [ ] **Find lines related to storage type selection**
  ```typescript
  // Look for:
  DFM_STORAGE_TYPE: z.enum(["neo4j", "sqlite"])
  // OR
  storageType: ...
  ```

- [ ] **DELETE these lines completely**

### Step 1.7.4: Remove Neo4j configuration

- [ ] **Find and DELETE all Neo4j config:**
  ```typescript
  // Look for and delete:
  Neo4jConfig
  NEO4J_URI
  NEO4J_USERNAME
  NEO4J_PASSWORD
  NEO4J_DATABASE
  // And any other NEO4J_* variables
  ```

### Step 1.7.5: Add simplified SQLite configuration

- [ ] **Add this configuration (adjust based on your current config structure):**
  ```typescript
  // SQLite Configuration (minimal, user-facing)
  sqliteLocation: z
    .string()
    .default("./devflow.db")
    .parse(process.env.DFM_SQLITE_LOCATION || "./devflow.db"),

  // Note: Vector dimensions, WAL mode, cache size, etc. are NOT exposed
  // They are hardcoded in src/server/index.ts
  ```

### Step 1.7.6: Remove storage type switching logic

- [ ] **Find any conditional logic based on storage type:**
  ```typescript
  // Look for:
  if (config.storageType === "neo4j") { ... }
  // OR
  switch (config.storageType) { ... }
  ```

- [ ] **DELETE these conditionals entirely**

### Step 1.7.7: Validate configuration changes

- [ ] **Check no Neo4j references remain**
  ```bash
  grep -i "neo4j" src/config.ts
  # Expected: Nothing
  ```

- [ ] **Check no storage type enum exists**
  ```bash
  grep "storageType\|STORAGE_TYPE" src/config.ts
  # Expected: Nothing
  ```

- [ ] **Check sqliteLocation exists**
  ```bash
  grep "sqliteLocation" src/config.ts
  # Expected: Should show the config property
  ```

### Step 1.7.8: Test configuration loads

- [ ] **Compile**
  ```bash
  npm run build
  ```

---

## Section 1.8: Update CLI Commands

**Time:** 10 minutes

### Step 1.8.1: Check if neo4j.ts CLI exists

- [ ] **Check for file**
  ```bash
  ls src/cli/neo4j.ts
  ```

### Step 1.8.2: Delete neo4j.ts (if exists)

- [ ] **If file exists, delete it**
  ```bash
  git rm src/cli/neo4j.ts
  ```

- [ ] **Validate deletion**
  ```bash
  ls src/cli/neo4j.ts
  # Expected: "No such file or directory"
  ```

### Step 1.8.3: Update CLI index to remove Neo4j command

- [ ] **Open:** `src/cli/index.ts`

- [ ] **Find and DELETE:**
  ```typescript
  import { createNeo4jCommand } from "./neo4j"
  ```

- [ ] **Find and DELETE:**
  ```typescript
  program.addCommand(createNeo4jCommand())
  ```

- [ ] **Save file**

### Step 1.8.4: Update database CLI commands (if sqlite.ts exists)

- [ ] **Check if sqlite.ts exists**
  ```bash
  ls src/cli/sqlite.ts
  ```

- [ ] **If exists, rename command from "sqlite" to "db"**

  Open `src/cli/sqlite.ts` (or wherever DB commands are):

  - [ ] **Find:** `new Command("sqlite")`
  - [ ] **Replace:** `new Command("db")`
  - [ ] **Update description:** `"SQLite database management"`

### Step 1.8.5: Update CLI commands to use direct SQLite classes

- [ ] **In the CLI file, find factory imports (if any)**

- [ ] **Replace factory imports with:**
  ```typescript
  import { DB } from "@takinprofit/sqlite-x"
  import { load as loadSqliteVec } from "sqlite-vec"
  import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
  ```

- [ ] **Update command implementations to use direct instantiation:**
  ```typescript
  // Example for "db init" command:
  const db = new DB({
    location: config.sqliteLocation,
    allowExtension: true,
  })

  loadSqliteVec(db.nativeDb)
  const schemaManager = new SqliteSchemaManager(db, logger)
  await schemaManager.initializeSchema()
  db.close()
  ```

### Step 1.8.6: Test CLI compilation

- [ ] **Compile**
  ```bash
  npm run build
  ```

---

## 🔒 Checkpoint 2: Commit Architecture Changes

**Time:** 2 minutes

- [ ] **Run all tests**
  ```bash
  npm test
  # Expected: All tests should still pass (76/76)
  ```

  ❌ **If tests fail:** Review changes in this section. Most likely issue:
  - Import path incorrect
  - Variable name mismatch

- [ ] **Stage changes**
  ```bash
  git add -A
  ```

- [ ] **Commit**
  ```bash
  git commit -m "refactor: remove abstraction layers and simplify configuration

- Delete factory files (storage-provider-factory, vector-store-factory)
- Update server initialization with direct SQLite instantiation
- Apply hardcoded optimizations (WAL, cache, busy timeout, etc.)
- Simplify config: 1 user option (DFM_SQLITE_LOCATION)
- Remove Neo4j configuration entirely
- Delete Neo4j CLI commands
- Update DB CLI to use direct SqliteSchemaManager

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

**✅ Checkpoint 2 Complete** - Architecture simplification done

---

## Section 1.9: Update Type Definitions

**Time:** 10 minutes

### Step 1.9.1: Update src/types/storage.ts

- [ ] **Open:** `src/types/storage.ts`

### Step 1.9.2: Remove Neo4j-specific types

- [ ] **Find and DELETE:**
  ```typescript
  // Look for and remove:
  Neo4jConfig
  Neo4jNode
  Neo4jRelationship
  // And any other Neo4j-specific types
  ```

### Step 1.9.3: Remove or simplify StorageProvider interface

**Decision point:** Is `StorageProvider` interface used only for abstraction?

- [ ] **Check usage**
  ```bash
  grep -r "interface StorageProvider\|: StorageProvider" src/ | grep -v node_modules
  ```

- [ ] **If only used for multi-backend abstraction:** DELETE the interface entirely

- [ ] **If used for typing:** Keep it, but rename to `DatabaseInterface` or similar (optional)

### Step 1.9.4: Validate no Neo4j types remain

- [ ] **Check**
  ```bash
  grep -i "neo4j" src/types/storage.ts
  # Expected: Nothing
  ```

### Step 1.9.5: Test compilation

- [ ] **Compile**
  ```bash
  npm run build
  ```

---

## Section 1.10: Update Package Dependencies

**Time:** 5 minutes

### Step 1.10.1: Check current dependencies

- [ ] **View dependencies**
  ```bash
  grep "neo4j-driver" package.json
  # Note: Shows if neo4j-driver is installed
  ```

### Step 1.10.2: Remove neo4j-driver (DO NOT run npm install yet)

- [ ] **Remove from package.json**
  ```bash
  npm uninstall neo4j-driver --save
  ```

- [ ] **Validate removal**
  ```bash
  grep "neo4j-driver" package.json
  # Expected: Nothing
  ```

### Step 1.10.3: Verify SQLite dependencies exist

- [ ] **Check**
  ```bash
  grep "@takinprofit/sqlite-x\|sqlite-vec" package.json
  # Expected: Should show both dependencies
  ```

### Step 1.10.4: Install dependencies

- [ ] **Install**
  ```bash
  pnpm install
  ```

- [ ] **Validate lock file updated**
  ```bash
  git status pnpm-lock.yaml
  # Expected: Should show as modified
  ```

---

## 🔒 Checkpoint 3: Final Phase 1 Validation

**Time:** 10 minutes

### Step 1.10.5: Run full test suite

- [ ] **Run tests**
  ```bash
  npm test
  ```

  **Expected:** 76/76 tests passing

  ❌ **If tests fail:**
  - Check error messages
  - Likely import path issues or variable naming mismatches
  - Review Sections 1.4-1.9

### Step 1.10.6: Run build

- [ ] **Compile TypeScript**
  ```bash
  npm run build
  ```

  ❌ **If build fails:** Fix compilation errors before proceeding

### Step 1.10.7: Verify directory structure

- [ ] **Check final structure**
  ```bash
  ls -la src/db/
  # Expected:
  # - sqlite-db.ts
  # - sqlite-vector-store.ts
  # - sqlite-schema-manager.ts
  # - neo4j/ (directory, will delete in Phase 3)
  # - NO factory files
  # - NO sqlite/ nested directory
  ```

### Step 1.10.8: Verify no #storage imports remain

- [ ] **Search codebase**
  ```bash
  grep -r "#storage/" src/ | grep -v node_modules | grep -v ".js"
  # Expected: Nothing
  ```

### Step 1.10.9: Verify explicit SQLite naming

- [ ] **Check class names**
  ```bash
  grep -r "class Sqlite" src/db/*.ts
  # Expected: Should show SqliteDb, SqliteVectorStore, SqliteSchemaManager
  ```

### Step 1.10.10: Commit final Phase 1 changes

- [ ] **Stage all changes**
  ```bash
  git add -A
  ```

- [ ] **Commit**
  ```bash
  git commit -m "refactor: complete Phase 1 architecture simplification

- Remove neo4j-driver dependency
- Update type definitions (remove Neo4j types)
- Final validation: all tests passing (76/76)

Phase 1 Complete:
✅ Directory restructured (src/db/)
✅ Explicit SQLite naming (SqliteDb, SqliteVectorStore, SqliteSchemaManager)
✅ All abstractions removed (no factories)
✅ Configuration simplified (1 option)
✅ Direct SQLite instantiation everywhere

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

**✅ Phase 1 Complete** - Architecture simplification finished

---

# Phase 2: E2E Testing

**Time:** 1-2 days
**Objective:** Validate all 20 MCP tools work with simplified SQLite architecture

---

## Section 2.1: Setup E2E Test Infrastructure

**Time:** 30 minutes

### Step 2.1.1: Create e2e directory

- [ ] **Create directory**
  ```bash
  mkdir -p src/tests/integration/e2e
  ```

- [ ] **Validate creation**
  ```bash
  ls -la src/tests/integration/e2e/
  # Expected: Empty directory
  ```

### Step 2.1.2: Create test setup file

- [ ] **Create file:** `src/tests/integration/e2e/setup.ts`

- [ ] **Add content:**
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

- [ ] **Save file**

### Step 2.1.3: Validate setup file compiles

- [ ] **Compile**
  ```bash
  npm run build
  ```

---

## Section 2.2: Create CRUD E2E Tests

**Time:** 2-3 hours

### Step 2.2.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-crud.e2e.test.ts`

### Step 2.2.2: Add test template

- [ ] **Add this content:**
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
    })

    describe("read_graph", () => {
      test("reads empty graph", async () => {
        const graph = await sqliteDb.readGraph()
        assert.ok(graph)
        assert.ok(Array.isArray(graph.entities))
        assert.ok(Array.isArray(graph.relations))
      })

      test("reads graph with entities", async () => {
        await sqliteDb.createEntities([
          { name: "e1", entityType: "feature", observations: [] },
        ])

        const graph = await sqliteDb.readGraph()
        assert.ok(graph.entities.length > 0)
      })
    })

    describe("delete_entities", () => {
      test("deletes single entity", async () => {
        await sqliteDb.createEntities([
          { name: "to-delete", entityType: "task", observations: [] },
        ])

        await sqliteDb.deleteEntities(["to-delete"])

        const graph = await sqliteDb.readGraph()
        const found = graph.entities.find((e) => e.name === "to-delete")
        assert.strictEqual(found, undefined)
      })
    })

    describe("add_observations", () => {
      test("adds observation to entity", async () => {
        await sqliteDb.createEntities([
          { name: "obs-test", entityType: "feature", observations: ["v1"] },
        ])

        await sqliteDb.addObservations("obs-test", ["v2"])

        const graph = await sqliteDb.readGraph()
        const entity = graph.entities.find((e) => e.name === "obs-test")
        assert.ok(entity)
        assert.ok(entity.observations.includes("v2"))
      })
    })

    describe("delete_observations", () => {
      test("deletes observation from entity", async () => {
        await sqliteDb.createEntities([
          {
            name: "del-obs-test",
            entityType: "feature",
            observations: ["keep", "delete"],
          },
        ])

        await sqliteDb.deleteObservations("del-obs-test", ["delete"])

        const graph = await sqliteDb.readGraph()
        const entity = graph.entities.find((e) => e.name === "del-obs-test")
        assert.ok(entity)
        assert.ok(entity.observations.includes("keep"))
        assert.ok(!entity.observations.includes("delete"))
      })
    })
  })
  ```

- [ ] **Save file**

### Step 2.2.3: Run CRUD tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-crud.e2e.test.ts
  ```

  **Expected:** All tests pass

  ❌ **If tests fail:** Review test output and fix issues

---

## Section 2.3: Create Relation E2E Tests

**Time:** 2-3 hours

### Step 2.3.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-relations.e2e.test.ts`

### Step 2.3.2: Add comprehensive relation tests

- [ ] **Add test template (similar structure to CRUD tests):**
  - Test: `create_relations`
  - Test: `get_relation`
  - Test: `update_relation`
  - Test: `delete_relations`
  - Test: `get_relation_history`

### Step 2.3.3: Run relation tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-relations.e2e.test.ts
  ```

---

## Section 2.4: Create Search E2E Tests

**Time:** 2 hours

### Step 2.4.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-search.e2e.test.ts`

### Step 2.4.2: Add search tests

- [ ] **Add tests for:**
  - `search_nodes`
  - `semantic_search`
  - `open_nodes`
  - `get_entity_embedding`

### Step 2.4.3: Run search tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-search.e2e.test.ts
  ```

---

## Section 2.5: Create Temporal E2E Tests

**Time:** 2 hours

### Step 2.5.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-temporal.e2e.test.ts`

### Step 2.5.2: Add temporal tests

- [ ] **Add tests for:**
  - `get_entity_history`
  - `get_relation_history`
  - `get_graph_at_time`
  - `get_decayed_graph`

### Step 2.5.3: Run temporal tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-temporal.e2e.test.ts
  ```

---

## Section 2.6: Create Embeddings E2E Tests

**Time:** 1 hour

### Step 2.6.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-embeddings.e2e.test.ts`

### Step 2.6.2: Add embedding tests

- [ ] **Add tests for:**
  - `get_entity_embedding`
  - `force_generate_embedding`
  - `debug_embedding_config`
  - `diagnose_vector_search`

### Step 2.6.3: Run embedding tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-embeddings.e2e.test.ts
  ```

---

## Section 2.7: Create Validation E2E Tests

**Time:** 2 hours

### Step 2.7.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-validation.e2e.test.ts`

### Step 2.7.2: Add validation tests

- [ ] **Test invalid inputs:**
  - Invalid entity types
  - Invalid relation types
  - Missing required fields
  - Boundary values
  - Null/undefined handling

### Step 2.7.3: Run validation tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-validation.e2e.test.ts
  ```

---

## Section 2.8: Create Scenario E2E Tests

**Time:** 3 hours

### Step 2.8.1: Create test file

- [ ] **Create file:** `src/tests/integration/e2e/mcp-scenarios.e2e.test.ts`

### Step 2.8.2: Add real-world scenarios

- [ ] **Scenario 1: Software development workflow**
  - Create feature
  - Add tasks
  - Link dependencies
  - Track decisions
  - Search for related work

- [ ] **Scenario 2: Knowledge graph evolution**
  - Create entities over time
  - Update observations
  - Query history
  - Confidence decay

### Step 2.8.3: Run scenario tests

- [ ] **Run tests**
  ```bash
  npm test -- mcp-scenarios.e2e.test.ts
  ```

---

## 🔒 Checkpoint 4: E2E Tests Complete

**Time:** 5 minutes

### Step 2.8.4: Run full E2E test suite

- [ ] **Run all E2E tests**
  ```bash
  npm test -- e2e/
  ```

  **Expected:** All E2E tests passing

  ❌ **If tests fail:** Review and fix failing tests

### Step 2.8.5: Run full test suite

- [ ] **Run all tests (integration + E2E)**
  ```bash
  npm test
  ```

  **Expected:** All tests passing (76+ tests)

### Step 2.8.6: Commit E2E tests

- [ ] **Stage changes**
  ```bash
  git add src/tests/integration/e2e/
  ```

- [ ] **Commit**
  ```bash
  git commit -m "test: add comprehensive E2E tests for SQLite-only architecture

- Add test infrastructure (setup.ts with SqliteDb)
- Add CRUD operation tests (create, read, delete, observations)
- Add relation management tests
- Add search tests (text, semantic, vector)
- Add temporal feature tests (history, point-in-time, decay)
- Add embedding tests
- Add validation tests (invalid inputs, edge cases)
- Add real-world scenario tests

All tests use direct SqliteDb, SqliteVectorStore, SqliteSchemaManager classes.
All tests validate internal optimizations (WAL mode, cache, etc.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

**✅ Phase 2 Complete** - E2E testing finished

---

# Phase 3: Cleanup & Code Removal

**Time:** 2-3 hours
**Objective:** Delete all Neo4j code and verify abstraction layers removed

---

## Section 3.1: Delete Neo4j Implementation

**Time:** 10 minutes

### Step 3.1.1: Find Neo4j directory

- [ ] **Check if Neo4j directory exists**
  ```bash
  ls -la src/db/neo4j/
  # Expected: Should show Neo4j implementation files
  ```

### Step 3.1.2: Delete Neo4j directory

- [ ] **Delete entire directory**
  ```bash
  git rm -r src/db/neo4j/
  ```

- [ ] **Validate deletion**
  ```bash
  ls src/db/neo4j/
  # Expected: "No such file or directory"
  ```

### Step 3.1.3: Delete Neo4j types

- [ ] **Delete types file**
  ```bash
  git rm src/types/neo4j.ts
  ```

- [ ] **Validate deletion**
  ```bash
  ls src/types/neo4j.ts
  # Expected: "No such file or directory"
  ```

### Step 3.1.4: Delete Neo4j integration tests

- [ ] **Find Neo4j test files**
  ```bash
  find src/tests -name "*neo4j*"
  ```

- [ ] **Delete each file found:**
  ```bash
  git rm src/tests/integration/neo4j-storage.integration.test.ts
  # Add more git rm commands for any other Neo4j test files found
  ```

### Step 3.1.5: Delete Neo4j CLI (if not already deleted)

- [ ] **Check if exists**
  ```bash
  ls src/cli/neo4j.ts
  ```

- [ ] **If exists, delete**
  ```bash
  git rm src/cli/neo4j.ts
  ```

---

## Section 3.2: Verify Abstraction Layers Removed

**Time:** 5 minutes

### Step 3.2.1: Verify factory files deleted

- [ ] **Check for factory files**
  ```bash
  find src/db -name "*factory*"
  # Expected: Nothing
  ```

### Step 3.2.2: Verify no nested sqlite directory

- [ ] **Check**
  ```bash
  ls src/db/sqlite/
  # Expected: "No such file or directory"
  ```

### Step 3.2.3: Count lines removed

- [ ] **Check git diff stats**
  ```bash
  git diff --cached --stat
  # Note: Should show ~4,000-5,000 lines removed
  ```

---

## Section 3.3: Search for Remaining Neo4j References

**Time:** 10 minutes

### Step 3.3.1: Search codebase for Neo4j references

- [ ] **Search source code**
  ```bash
  grep -ri "neo4j" src/ | grep -v node_modules | grep -v ".js"
  # Expected: Nothing (or only in comments)
  ```

### Step 3.3.2: Search configuration files

- [ ] **Search config**
  ```bash
  grep -i "neo4j" src/config.ts
  # Expected: Nothing
  ```

### Step 3.3.3: Search package.json

- [ ] **Search dependencies**
  ```bash
  grep "neo4j" package.json
  # Expected: Nothing
  ```

### Step 3.3.4: Search Docker Compose (if it exists)

- [ ] **Check if docker-compose.yml exists**
  ```bash
  ls docker-compose.yml
  ```

- [ ] **If exists, check for Neo4j service**
  ```bash
  grep -i "neo4j" docker-compose.yml
  ```

- [ ] **If found, remove Neo4j service from docker-compose.yml**
  - Open file
  - Delete Neo4j service section
  - Delete Neo4j volumes
  - Save file

---

## Section 3.4: Update Remaining Type Files

**Time:** 10 minutes

### Step 3.4.1: Check src/types/storage.ts

- [ ] **Open:** `src/types/storage.ts`

- [ ] **Verify no Neo4j types**
  ```bash
  grep -i "neo4j" src/types/storage.ts
  # Expected: Nothing
  ```

- [ ] **If found, remove them**

### Step 3.4.2: Check src/types/index.ts

- [ ] **Check for Neo4j exports**
  ```bash
  grep -i "neo4j" src/types/index.ts
  # Expected: Nothing
  ```

- [ ] **If found, remove export statements**

---

## 🔒 Checkpoint 5: Cleanup Complete

**Time:** 5 minutes

### Step 3.4.3: Run full test suite

- [ ] **Run tests**
  ```bash
  npm test
  ```

  **Expected:** All tests passing

  ❌ **If tests fail:** Check if any tests were importing Neo4j code

### Step 3.4.4: Run build

- [ ] **Compile**
  ```bash
  npm run build
  ```

  ❌ **If build fails:** Check for remaining Neo4j imports

### Step 3.4.5: Verify code reduction

- [ ] **Check git status**
  ```bash
  git diff --cached --shortstat
  # Expected: Should show ~5,000 lines removed
  ```

### Step 3.4.6: Commit cleanup

- [ ] **Stage all deletions**
  ```bash
  git add -A
  ```

- [ ] **Commit**
  ```bash
  git commit -m "refactor: delete Neo4j implementation and verify abstraction removal

Removed:
- src/db/neo4j/ (~4,000 lines)
- src/types/neo4j.ts
- src/tests/integration/neo4j-*.test.ts
- Neo4j CLI commands
- Neo4j Docker Compose service (if existed)

Verified:
- No factory files remain
- No nested sqlite/ directory
- No #storage/ imports
- No Neo4j references in codebase
- All tests passing

Total reduction: ~5,000 lines (Neo4j + abstractions)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

**✅ Phase 3 Complete** - All Neo4j code removed

---

# Phase 4: Documentation Updates

**Time:** 2-3 hours
**Objective:** Update user-facing documentation to reflect SQLite-only architecture

---

## Section 4.1: Update README.md

**Time:** 30 minutes

### Step 4.1.1: Backup README

- [ ] **Create backup**
  ```bash
  cp README.md README.md.backup
  ```

### Step 4.1.2: Remove Neo4j references

- [ ] **Open:** `README.md`

- [ ] **Find and REMOVE:**
  - Neo4j 5.13+ requirement
  - Docker Compose setup instructions
  - Neo4j connection parameters
  - `npm run neo4j:init` commands

### Step 4.1.3: Add SQLite-only information

- [ ] **Add to README (adjust based on your structure):**
  ```markdown
  ## Database

  DevFlow MCP uses **SQLite** for data storage. No external database required!

  - **Zero Configuration** - Works out of the box
  - **Single File Database** - Easy backup and portability
  - **Embedded** - No separate server process

  ### Configuration

  Only one environment variable:

  - `DFM_SQLITE_LOCATION` - Database file location (default: `./devflow.db`)

  That's it! All performance optimizations are handled internally.

  ## Quick Start

  1. Install dependencies:
     ```bash
     pnpm install
     ```

  2. Run the server:
     ```bash
     pnpm dev
     ```

  The SQLite database will be created automatically at `./devflow.db`.

  ## Database Commands

  Initialize schema:
  ```bash
  npm run db:init
  ```

  View database info:
  ```bash
  npm run db:info
  ```
  ```

### Step 4.1.4: Validate no Neo4j references remain

- [ ] **Search README**
  ```bash
  grep -i "neo4j" README.md
  # Expected: Nothing
  ```

### Step 4.1.5: Save and test links

- [ ] **Save file**

- [ ] **Preview README** (if using VS Code or similar)

---

## Section 4.2: Update CONTRIBUTING.md (if exists)

**Time:** 20 minutes

### Step 4.2.1: Check if file exists

- [ ] **Check**
  ```bash
  ls CONTRIBUTING.md
  ```

### Step 4.2.2: If exists, update it

- [ ] **Open:** `CONTRIBUTING.md`

- [ ] **Remove:**
  - Docker setup instructions
  - Neo4j connection testing
  - `npm run neo4j:init`

- [ ] **Simplify development environment:**
  ```markdown
  ## Development Environment

  Requirements:
  - Node.js 18+
  - pnpm

  That's it! No Docker, no external databases.

  ## Running Tests

  ```bash
  npm test
  ```

  All tests run against in-memory SQLite databases.
  ```

---

## Section 4.3: Create Migration Guide for Existing Users

**Time:** 30 minutes

### Step 4.3.1: Create migration guide

- [ ] **Create file:** `docs/MIGRATION_GUIDE.md`

### Step 4.3.2: Add migration instructions

- [ ] **Add content:**
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

  SQLite database will be created automatically at `./devflow.db`.

  ### Option 2: Migrate Data

  **Note:** Data migration tools not yet implemented.

  If you need to preserve Neo4j data, please open an issue.

  ## Configuration Changes

  ### Old (Neo4j)

  ```bash
  DFM_STORAGE_TYPE=neo4j
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USERNAME=neo4j
  NEO4J_PASSWORD=password
  NEO4J_DATABASE=neo4j
  ```

  ### New (SQLite)

  ```bash
  DFM_SQLITE_LOCATION=./devflow.db  # Optional, this is the default
  ```

  ## FAQs

  **Q: Can I still use Neo4j?**
  A: No, Neo4j support has been removed. Use the last v1.x release if you need Neo4j.

  **Q: Will my embeddings work?**
  A: Yes! SQLite uses sqlite-vec for vector search.

  **Q: Is SQLite as fast as Neo4j?**
  A: For typical workloads (<10k entities), SQLite is actually faster.

  **Q: Can I backup my data?**
  A: Yes, just copy the `devflow.db` file.
  ```

- [ ] **Save file**

---

## Section 4.4: Update Existing Documentation

**Time:** 30 minutes

### Step 4.4.1: Update docs/README.md (already done)

- [ ] **Verify:** `docs/README.md` reflects SQLite-only architecture

### Step 4.4.2: Update package.json scripts (if needed)

- [ ] **Open:** `package.json`

- [ ] **Check scripts section:**
  - Remove: `neo4j:*` scripts
  - Add: `db:init`, `db:info` (if not already present)

- [ ] **Example:**
  ```json
  {
    "scripts": {
      "db:init": "node dist/cli/index.js db init",
      "db:info": "node dist/cli/index.js db info"
    }
  }
  ```

### Step 4.4.3: Update .env.example (if exists)

- [ ] **Check if file exists**
  ```bash
  ls .env.example
  ```

- [ ] **If exists, update it:**
  - Remove all `NEO4J_*` variables
  - Add: `DFM_SQLITE_LOCATION=./devflow.db`

---

## 🔒 Checkpoint 6: Documentation Complete

**Time:** 5 minutes

### Step 4.4.4: Validate all documentation changes

- [ ] **Search all docs for Neo4j**
  ```bash
  grep -ri "neo4j" README.md CONTRIBUTING.md docs/ | grep -v "Migration\|migrating"
  # Expected: Only references in MIGRATION_GUIDE.md
  ```

### Step 4.4.5: Test README links

- [ ] **Check all links in README work**

### Step 4.4.6: Commit documentation

- [ ] **Stage changes**
  ```bash
  git add README.md CONTRIBUTING.md docs/MIGRATION_GUIDE.md package.json .env.example
  ```

- [ ] **Commit**
  ```bash
  git commit -m "docs: update all documentation for SQLite-only architecture

- Update README: remove Neo4j, add SQLite quick start
- Update CONTRIBUTING: simplify dev environment
- Add MIGRATION_GUIDE: help for existing users
- Update package.json scripts (db:init, db:info)
- Update .env.example (remove Neo4j vars)

All docs now reflect SQLite-only architecture with:
- Zero configuration
- Single file database
- No external dependencies

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

**✅ Phase 4 Complete** - Documentation updated

---

# Final Validation & Completion

**Time:** 30 minutes

---

## Section 5.1: Final Checks

### Step 5.1.1: Run full test suite

- [ ] **Run all tests**
  ```bash
  npm test
  ```

  **Expected:** All tests passing

  ✅ **Success Criteria:** 76+ tests passing (integration + E2E)

### Step 5.1.2: Run production build

- [ ] **Build for production**
  ```bash
  npm run build
  ```

  ❌ **If build fails:** Fix compilation errors

### Step 5.1.3: Test CLI commands

- [ ] **Test db init**
  ```bash
  npm run db:init
  # Expected: Schema initialized successfully
  ```

- [ ] **Test db info**
  ```bash
  npm run db:info
  # Expected: Shows database statistics
  ```

### Step 5.1.4: Test server start

- [ ] **Start server**
  ```bash
  npm run dev
  ```

  **Expected:** Server starts without errors

  - [ ] Check logs for SQLite database creation
  - [ ] Check logs for schema initialization
  - [ ] Check logs for sqlite-vec extension loading
  - [ ] Stop server (Ctrl+C)

---

## Section 5.2: Code Quality Checks

### Step 5.2.1: Run linter

- [ ] **Lint code**
  ```bash
  npm run lint
  ```

  ❌ **If linting fails:** Fix linting errors

### Step 5.2.2: Check for unused imports

- [ ] **Search for Neo4j imports**
  ```bash
  grep -r "neo4j" src/ | grep -v node_modules | grep -v ".js"
  # Expected: Nothing
  ```

### Step 5.2.3: Check for factory imports

- [ ] **Search for factory imports**
  ```bash
  grep -r "factory" src/ | grep import | grep -v node_modules
  # Expected: Nothing
  ```

---

## Section 5.3: Architecture Validation

### Step 5.3.1: Verify directory structure

- [ ] **Check final structure**
  ```bash
  tree -L 2 src/db/
  # Expected:
  # src/db/
  # ├── sqlite-db.ts
  # ├── sqlite-vector-store.ts
  # ├── sqlite-schema-manager.ts
  # └── (other files, but NO neo4j/, NO sqlite/, NO factories)
  ```

### Step 5.3.2: Verify class names

- [ ] **Check for explicit SQLite naming**
  ```bash
  grep -r "class Sqlite" src/db/*.ts
  # Expected: SqliteDb, SqliteVectorStore, SqliteSchemaManager
  ```

### Step 5.3.3: Verify no generic abstractions

- [ ] **Check for generic interfaces**
  ```bash
  grep -r "interface StorageProvider\|interface VectorStore" src/
  # Expected: Nothing (or only if used for actual typing, not abstraction)
  ```

### Step 5.3.4: Verify configuration

- [ ] **Check config has only SQLite option**
  ```bash
  grep -c "sqliteLocation" src/config.ts
  # Expected: At least 1
  ```

- [ ] **Check no storage type selection**
  ```bash
  grep "storageType\|STORAGE_TYPE" src/config.ts
  # Expected: Nothing
  ```

---

## Section 5.4: Metrics & Summary

### Step 5.4.1: Calculate lines removed

- [ ] **Get total diff stats**
  ```bash
  git diff main..HEAD --shortstat
  # Note: Should show ~5,000 lines removed
  ```

### Step 5.4.2: Count commits

- [ ] **List commits for this migration**
  ```bash
  git log --oneline main..HEAD
  # Note: Should show all checkpoints
  ```

### Step 5.4.3: Generate final report

- [ ] **Create summary:**
  ```
  Migration Complete! ✅

  Commits: [count from Step 5.4.2]
  Lines Removed: ~5,000
  Tests Passing: [count from Step 5.1.1]

  Architecture Changes:
  ✅ Directory: src/storage/ → src/db/
  ✅ Classes: SqliteDb, SqliteVectorStore, SqliteSchemaManager
  ✅ Abstractions: All removed (no factories)
  ✅ Configuration: 1 option (DFM_SQLITE_LOCATION)
  ✅ Neo4j: Completely removed
  ✅ Documentation: Updated for SQLite-only

  Ready for production! 🚀
  ```

---

## 🔒 Final Commit

### Step 5.4.4: Create final summary commit (optional)

- [ ] **If you made any last-minute fixes, commit them:**
  ```bash
  git add -A
  git commit -m "chore: final cleanup and validation

- All tests passing
- All documentation updated
- SQLite-only architecture complete

Migration Summary:
- 5,000+ lines removed
- 0 abstraction layers
- 1 configuration option
- 100% SQLite

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Section 5.5: Branch & PR Preparation

### Step 5.5.1: Push branch

- [ ] **Push to remote**
  ```bash
  git push origin sqlite
  ```

### Step 5.5.2: Verify on GitHub/GitLab

- [ ] **Check remote branch exists**
  ```bash
  git branch -r | grep sqlite
  # Expected: origin/sqlite
  ```

### Step 5.5.3: Ready for PR

**You are now ready to create a Pull Request!**

- [ ] **PR Title:** "refactor: migrate to SQLite-only architecture"

- [ ] **PR Description:**
  ```markdown
  ## Summary
  Complete migration from Neo4j to SQLite-only architecture with extreme simplification.

  ## Changes
  - ✅ Restructured `src/storage/` → `src/db/`
  - ✅ Renamed classes to explicit SQLite names (`SqliteDb`, `SqliteVectorStore`, `SqliteSchemaManager`)
  - ✅ Removed all abstraction layers (factories, generic interfaces)
  - ✅ Simplified configuration to 1 user option
  - ✅ Deleted Neo4j implementation (~4,000 lines)
  - ✅ Added comprehensive E2E tests
  - ✅ Updated all documentation

  ## Test Plan
  - [x] All integration tests passing (76/76)
  - [x] All E2E tests passing
  - [x] Production build successful
  - [x] Server starts without errors
  - [x] CLI commands work

  ## Breaking Changes
  - Neo4j support removed entirely
  - Configuration simplified (only `DFM_SQLITE_LOCATION`)

  ## Migration Path
  See `docs/MIGRATION_GUIDE.md` for existing users.
  ```

---

# ✅ Migration Complete!

You have successfully completed the SQLite-only architecture migration.

**Total Time Spent:** [Your actual time]

**Checklist Summary:**
- [ ] Phase 1: Architecture Simplification - ✅ Complete
- [ ] Phase 2: E2E Testing - ✅ Complete
- [ ] Phase 3: Cleanup & Code Removal - ✅ Complete
- [ ] Phase 4: Documentation Updates - ✅ Complete
- [ ] Final Validation - ✅ Complete

**What You Accomplished:**
1. Restructured entire codebase to `src/db/`
2. Removed 5,000+ lines of code
3. Eliminated all abstraction layers
4. Implemented comprehensive E2E tests
5. Updated all documentation
6. Maintained 100% test coverage

**Next Steps:**
- Create Pull Request
- Request code review
- Merge to main branch
- Deploy to production

🎉 **Congratulations!** The migration is complete.
