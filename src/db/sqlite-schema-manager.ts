// Copyright 2025 Takin Profit. All rights reserved.
// Manages SQLite database schema creation and migrations

import type { DataRow, DB, Schema } from "@takinprofit/sqlite-x"
import { raw } from "@takinprofit/sqlite-x"
import { load } from "sqlite-vec"
import type { Logger } from "#types"

type EntityRow = {
  id: string
  name: string
  entity_type: "feature" | "task" | "decision" | "component" | "test"
  observations: string // JSON array stored as TEXT
  embedding: string | null // JSON array of numbers stored as TEXT
  version: number
  created_at: number
  updated_at: number
  valid_from: number
  valid_to: number | null
  changed_by: string | null
}

type RelationRow = {
  id: string
  from_entity_id: string // References entities.id
  to_entity_id: string // References entities.id
  from_entity_name: string // Denormalized for performance
  to_entity_name: string // Denormalized for performance
  relation_type: "implements" | "depends_on" | "relates_to" | "part_of"
  strength: number
  confidence: number
  metadata: string // JSON object stored as TEXT
  version: number
  created_at: number
  updated_at: number
  valid_from: number
  valid_to: number | null
  changed_by: string | null
}

// Helper function to create tables using sqlite-x API
function createTable<T extends DataRow>({
  db,
  name,
  schema,
}: {
  db: DB
  name: string
  schema: Schema<T>
}) {
  return db.sql<T>`CREATE TABLE IF NOT EXISTS ${raw`${name.toLowerCase()}`} ${{
    schema,
  }}`
}

export class SqliteSchemaManager {
  private readonly db: DB
  private readonly logger: Logger
  private readonly vectorDimensions: number

  constructor(db: DB, logger: Logger, vectorDimensions: number = 1536) {
    this.db = db
    this.logger = logger
    this.vectorDimensions = vectorDimensions
  }

  /**
   * Initializes the complete database schema including tables, indexes, and triggers
   */
  async initializeSchema(): Promise<void> {
    this.logger.info("Initializing SQLite schema")

    try {
      // Load sqlite-vec extension for vector similarity search
      await this.loadVectorExtension()

      // Create tables
      this.createEntitiesTable()
      this.createRelationsTable()
      this.createEmbeddingsTable()

      // Create indexes for performance
      this.createIndexes()

      // Create triggers for updated_at timestamps
      this.createTriggers()

      this.logger.info("SQLite schema initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize SQLite schema", { error })
      throw error
    }
  }

  /**
   * Loads the sqlite-vec extension for vector operations
   * Note: DB must be constructed with allowExtension: true
   */
  private async loadVectorExtension(): Promise<void> {
    try {
      this.logger.debug("Loading sqlite-vec extension using nativeDb getter...")

      // Use the new `nativeDb` getter to pass the raw db instance to the loader
      load(this.db.nativeDb)

      this.logger.info("sqlite-vec extension loaded successfully via nativeDb")

      // Verify extension is loaded by checking vec_version()
      const version = this.db.sql`SELECT vec_version() as version`.get<{
        version: string
      }>()
      this.logger.info("sqlite-vec version", { version: version?.version })
    } catch (error) {
      this.logger.error(
        "Could not load sqlite-vec extension. Ensure the library is installed and the environment supports native extensions.",
        { error }
      )
      throw error
    }
  }

  /**
   * Creates the entities table with proper schema
   */
  private createEntitiesTable(): void {
    this.logger.debug("Creating entities table")

    const schema: Schema<EntityRow> = {
      id: "TEXT PRIMARY KEY",
      name: "TEXT NOT NULL",
      entity_type:
        "TEXT NOT NULL CHECK(entity_type IN ('feature', 'task', 'decision', 'component', 'test'))",
      observations: "TEXT NOT NULL DEFAULT '[]'",
      embedding: "TEXT",
      version: "INTEGER NOT NULL DEFAULT 1",
      created_at:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      updated_at:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      valid_from:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      valid_to: "INTEGER",
      changed_by: "TEXT",
    }

    createTable<EntityRow>({
      db: this.db,
      name: "entities",
      schema,
    }).run()

    // Create UNIQUE index on name for current versions only (where valid_to IS NULL)
    // This allows multiple versions of the same entity in the history
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_name_unique
      ON entities (name) WHERE valid_to IS NULL
    `)

    // Create index on name for efficient lookups
    this.db.createIndex<EntityRow>({
      name: "idx_entities_name",
      tableName: "entities",
      columns: ["name"],
    })

    // Create index on valid_to for current version queries
    this.db.createIndex<EntityRow>({
      name: "idx_entities_valid_to",
      tableName: "entities",
      columns: ["valid_to"],
    })

    this.logger.info("Entities table created")
  }

  /**
   * Creates the relations table with foreign key constraints
   */
  private createRelationsTable(): void {
    this.logger.debug("Creating relations table")

    const schema: Schema<RelationRow> = {
      id: "TEXT PRIMARY KEY",
      from_entity_id: "TEXT NOT NULL",
      to_entity_id: "TEXT NOT NULL",
      from_entity_name: "TEXT NOT NULL",
      to_entity_name: "TEXT NOT NULL",
      relation_type:
        "TEXT NOT NULL CHECK(relation_type IN ('implements', 'depends_on', 'relates_to', 'part_of'))",
      strength:
        "REAL NOT NULL DEFAULT 0.5 CHECK(strength >= 0 AND strength <= 1)",
      confidence:
        "REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0 AND confidence <= 1)",
      metadata: "TEXT NOT NULL DEFAULT '{}'",
      version: "INTEGER NOT NULL DEFAULT 1",
      created_at:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      updated_at:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      valid_from:
        "INTEGER NOT NULL DEFAULT (unixepoch('now', 'subsec') * 1000)",
      valid_to: "INTEGER",
      changed_by: "TEXT",
      $$foreignKeys: [
        {
          key: "from_entity_id",
          references: {
            table: "entities",
            columns: ["id"],
          },
          onDelete: "CASCADE",
          deferrable: "DEFERRABLE INITIALLY DEFERRED",
        },
        {
          key: "to_entity_id",
          references: {
            table: "entities",
            columns: ["id"],
          },
          onDelete: "CASCADE",
          deferrable: "DEFERRABLE INITIALLY DEFERRED",
        },
      ],
    }

    createTable<RelationRow>({
      db: this.db,
      name: "relations",
      schema,
    }).run()

    // Create index on valid_to for current version queries
    this.db.createIndex<RelationRow>({
      name: "idx_relations_valid_to",
      tableName: "relations",
      columns: ["valid_to"],
    })

    this.logger.info("Relations table created with foreign key constraints")
  }

  /**
   * Creates the embeddings virtual table using sqlite-vec
   */
  private createEmbeddingsTable(): void {
    this.logger.debug("Creating embeddings table", { dimensions: this.vectorDimensions })

    // Create vec0 virtual table with just the embedding column
    // vec0 only supports vector columns, not custom metadata
    this.db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
				embedding FLOAT[${this.vectorDimensions}]
			)
		`)

    // Create a separate metadata table to track entity names and observation indices
    // The rowid links to the vec0 table's implicit rowid
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_metadata (
        rowid INTEGER PRIMARY KEY,
        entity_name TEXT NOT NULL,
        observation_index INTEGER NOT NULL DEFAULT 0,
        UNIQUE(entity_name, observation_index)
      )
    `)

    // Create index on entity_name for fast lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_embedding_metadata_entity
      ON embedding_metadata(entity_name)
    `)

    this.logger.info("Embeddings virtual table and metadata created", { dimensions: this.vectorDimensions })
  }

  /**
   * Creates indexes for query performance optimization
   */
  private createIndexes(): void {
    this.logger.debug("Creating indexes")

    // Index on entity_type for filtering by type
    this.db.createIndex<EntityRow>({
      name: "idx_entities_type",
      tableName: "entities",
      columns: ["entity_type"],
    })

    // Index on relation type for filtering relations
    this.db.createIndex<RelationRow>({
      name: "idx_relations_type",
      tableName: "relations",
      columns: ["relation_type"],
    })

    // Indexes for ID-based lookups (primary performance - foreign key joins)
    this.db.createIndex<RelationRow>({
      name: "idx_relations_from_id",
      tableName: "relations",
      columns: ["from_entity_id"],
    })

    this.db.createIndex<RelationRow>({
      name: "idx_relations_to_id",
      tableName: "relations",
      columns: ["to_entity_id"],
    })

    // Indexes for name-based lookups (API compatibility)
    this.db.createIndex<RelationRow>({
      name: "idx_relations_from_name",
      tableName: "relations",
      columns: ["from_entity_name"],
    })

    this.db.createIndex<RelationRow>({
      name: "idx_relations_to_name",
      tableName: "relations",
      columns: ["to_entity_name"],
    })

    // Composite index on from/to names for relation lookups
    this.db.createIndex<RelationRow>({
      name: "idx_relations_from_to_names",
      tableName: "relations",
      columns: ["from_entity_name", "to_entity_name"],
    })

    // Unique constraint on relation tuples to prevent duplicates on *current* versions (using IDs)
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique
      ON relations (from_entity_id, to_entity_id, relation_type)
      WHERE valid_to IS NULL
    `)

    this.logger.info("Indexes created successfully")
  }

  /**
   * Creates triggers for automatic timestamp updates
   */
  private createTriggers(): void {
    this.logger.debug("Creating triggers")

    // Trigger to update updated_at on entities table
    this.db.exec(`
			CREATE TRIGGER IF NOT EXISTS update_entities_timestamp
			AFTER UPDATE ON entities
			FOR EACH ROW
			BEGIN
				UPDATE entities
				SET updated_at = unixepoch('now', 'subsec') * 1000
				WHERE name = NEW.name;
			END
		`)

    // Trigger to update updated_at on relations table
    this.db.exec(`
			CREATE TRIGGER IF NOT EXISTS update_relations_timestamp
			AFTER UPDATE ON relations
			FOR EACH ROW
			BEGIN
				UPDATE relations
				SET updated_at = unixepoch('now', 'subsec') * 1000
				WHERE id = NEW.id;
			END
		`)

    this.logger.info("Triggers created successfully")
  }

  /**
   * Drops all tables and recreates the schema (useful for testing)
   */
  resetSchema(): void {
    this.logger.warn("Resetting SQLite schema - all data will be lost")

    this.db.exec("DROP TABLE IF EXISTS embeddings")
    this.db.exec("DROP TABLE IF EXISTS relations")
    this.db.exec("DROP TABLE IF EXISTS entities")

    this.initializeSchema()

    this.logger.info("Schema reset completed")
  }

  /**
   * Checks if the schema is initialized
   */
  isSchemaInitialized(): boolean {
    try {
      const result = this.db.sql<{ name: string }>`
					SELECT name FROM sqlite_master
					WHERE type='table' AND name='entities'
				`.get()

      return result !== undefined
    } catch {
      return false
    }
  }
}
