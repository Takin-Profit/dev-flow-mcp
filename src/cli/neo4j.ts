/**
 * Neo4j CLI Commands
 * Commands for managing Neo4j schema and connections
 */

import { buildCommand, buildRouteMap } from "@stricli/core"
import type { CliContext } from "#cli/app.ts"
import { env } from "#config.ts"
import { cliLogger } from "#logger.ts"
import type { Neo4jConfig } from "#storage/neo4j/neo4j-config.ts"
import { Neo4jConnectionManager } from "#storage/neo4j/neo4j-connection-manager.ts"
import { Neo4jSchemaManager } from "#storage/neo4j/neo4j-schema-manager.ts"

/**
 * Flags for Neo4j commands
 */
type Neo4jFlags = {
  uri?: string
  username?: string
  password?: string
  database?: string
  vectorIndex?: string
  dimensions?: number
  similarity?: "cosine" | "euclidean"
  debug?: boolean
}

/**
 * Init command specific flags
 */
type InitFlags = Neo4jFlags & {
  recreate?: boolean
}

/**
 * Build Neo4j config from flags with environment variable fallback
 */
function buildConfig(flags: Neo4jFlags): Neo4jConfig {
  return {
    uri: flags.uri ?? env.NEO4J_URI,
    username: flags.username ?? env.NEO4J_USERNAME,
    password: flags.password ?? env.NEO4J_PASSWORD,
    database: flags.database ?? env.NEO4J_DATABASE,
    vectorIndexName: flags.vectorIndex ?? env.NEO4J_VECTOR_INDEX,
    vectorDimensions: flags.dimensions ?? env.NEO4J_VECTOR_DIMENSIONS,
    similarityFunction: flags.similarity ?? env.NEO4J_SIMILARITY_FUNCTION,
  }
}

/**
 * Test Neo4j connection
 */
async function testConnectionImpl(
  this: CliContext,
  flags: Neo4jFlags
): Promise<void> {
  const config = buildConfig(flags)
  const debug = flags.debug ?? env.DFM_DEBUG

  cliLogger.info("Testing connection to Neo4j...")
  cliLogger.info(`  URI: ${config.uri}`)
  cliLogger.info(`  Username: ${config.username}`)
  cliLogger.info(`  Database: ${config.database}`)

  const connectionManager = new Neo4jConnectionManager(config)

  try {
    if (debug) {
      cliLogger.debug("Attempting to verify connectivity...")
    }

    await connectionManager.verifyConnectivity()

    if (debug) {
      cliLogger.debug("Verifying authentication...")
    }

    const driver = connectionManager.getDriver()
    await driver.verifyAuthentication()

    if (debug) {
      cliLogger.debug("Getting server info...")
    }

    const serverInfo = await driver.getServerInfo()

    cliLogger.success("✓ Connection successful!")
    cliLogger.info(`  Server: ${serverInfo.address}`)
    cliLogger.info(`  Version: ${serverInfo.agent}`)
    cliLogger.info(`  Protocol: ${serverInfo.protocolVersion}`)
  } catch (error) {
    cliLogger.error("✗ Connection failed", error)
    this.process.exit(1)
  } finally {
    await connectionManager.close()
  }
}

/**
 * Initialize Neo4j schema
 */
async function initSchemaImpl(
  this: CliContext,
  flags: InitFlags
): Promise<void> {
  const config = buildConfig(flags)
  const debug = flags.debug ?? env.DFM_DEBUG
  const recreate = flags.recreate ?? false

  const connectionManager = new Neo4jConnectionManager(config)
  const schemaManager = new Neo4jSchemaManager(connectionManager, {
    debug,
  })

  try {
    cliLogger.start("Initializing Neo4j schema...")
    if (recreate) {
      cliLogger.warn(
        "Recreate mode enabled: will drop and recreate constraints and indexes"
      )
    }

    if (debug) {
      cliLogger.debug("Listing current constraints and indexes...")
      const constraints = await schemaManager.listConstraints()
      cliLogger.debug(`Found ${constraints.length} constraints`)

      const indexes = await schemaManager.listIndexes()
      cliLogger.debug(`Found ${indexes.length} indexes`)
    }

    cliLogger.info("Creating entity constraints...")
    await schemaManager.createEntityConstraints(recreate)

    cliLogger.info(`Creating vector index "${config.vectorIndexName}"...`)
    await schemaManager.createVectorIndex(
      config.vectorIndexName,
      "Entity",
      "embedding",
      config.vectorDimensions,
      config.similarityFunction,
      recreate
    )

    if (debug) {
      cliLogger.debug("Verifying schema was created...")
      const constraints = await schemaManager.listConstraints()
      cliLogger.debug(
        `Found ${constraints.length} constraints after initialization`
      )

      const indexes = await schemaManager.listIndexes()
      cliLogger.debug(`Found ${indexes.length} indexes after initialization`)

      const vectorIndexExists = await schemaManager.vectorIndexExists(
        config.vectorIndexName
      )
      cliLogger.debug(
        `Vector index "${config.vectorIndexName}" exists: ${vectorIndexExists}`
      )
    }

    cliLogger.success("✓ Neo4j schema initialization complete")
  } catch (error) {
    cliLogger.error("✗ Neo4j schema initialization failed", error)
    this.process.exit(1)
  } finally {
    await schemaManager.close()
  }
}

/**
 * Test command definition
 */
const testCommand = buildCommand({
  loader: async () => testConnectionImpl,
  parameters: {
    flags: {
      uri: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j connection URI",
        optional: true,
      },
      username: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j username",
        optional: true,
      },
      password: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j password",
        optional: true,
      },
      database: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j database name",
        optional: true,
      },
      vectorIndex: {
        kind: "parsed",
        parse: String,
        brief: "Vector index name",
        optional: true,
      },
      dimensions: {
        kind: "parsed",
        parse: Number,
        brief: "Vector dimensions",
        optional: true,
      },
      similarity: {
        kind: "enum",
        values: ["cosine", "euclidean"],
        brief: "Similarity function",
        optional: true,
      },
      debug: {
        kind: "boolean",
        brief: "Enable debug output",
        optional: true,
      },
    },
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Test connection to Neo4j",
  },
})

/**
 * Init command definition
 */
const initCommand = buildCommand({
  loader: async () => initSchemaImpl,
  parameters: {
    flags: {
      uri: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j connection URI",
        optional: true,
      },
      username: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j username",
        optional: true,
      },
      password: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j password",
        optional: true,
      },
      database: {
        kind: "parsed",
        parse: String,
        brief: "Neo4j database name",
        optional: true,
      },
      vectorIndex: {
        kind: "parsed",
        parse: String,
        brief: "Vector index name",
        optional: true,
      },
      dimensions: {
        kind: "parsed",
        parse: Number,
        brief: "Vector dimensions",
        optional: true,
      },
      similarity: {
        kind: "enum",
        values: ["cosine", "euclidean"],
        brief: "Similarity function",
        optional: true,
      },
      recreate: {
        kind: "boolean",
        brief: "Drop and recreate existing constraints/indexes",
        optional: true,
      },
      debug: {
        kind: "boolean",
        brief: "Enable debug output",
        optional: true,
      },
    },
    positional: {
      kind: "tuple",
      parameters: [],
    },
  },
  docs: {
    brief: "Initialize Neo4j schema",
  },
})

/**
 * Neo4j command routes
 */
export const neo4jRoutes = buildRouteMap({
  routes: {
    test: testCommand,
    init: initCommand,
  },
  docs: {
    brief: "Neo4j database management commands",
  },
})
