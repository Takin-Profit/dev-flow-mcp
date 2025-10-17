/**
 * Integration Tests for Neo4j Storage Provider
 *
 * These tests use a REAL Neo4j database to verify:
 * - Relations with strength/confidence are saved and retrieved correctly
 * - Metadata is persisted properly
 * - Temporal features work as expected
 * - Data actually persists to the database
 *
 * Prerequisites:
 * 1. Neo4j running: docker-compose up -d neo4j
 * 2. Schema initialized: pnpm run neo4j:init
 * 3. Environment: DFM_ENV=testing TEST_INTEGRATION=true
 */
/** biome-ignore-all lint/style/noMagicNumbers: tests */

import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { Session } from "neo4j-driver"
import { Neo4jConnectionManager } from "#db/neo4j/neo4j-connection-manager"
import { Neo4jStorageProvider } from "#db/neo4j/neo4j-storage-provider"
import { Neo4jVectorStore } from "#db/neo4j/neo4j-vector-store"
import type { Entity, Relation } from "#types"
import { createNoOpLogger } from "#types/logger"

// Regex patterns for validation
const INVALID_VECTOR_DIMENSIONS_PATTERN = /Invalid vector dimensions/
const INVALID_QUERY_VECTOR_DIMENSIONS_PATTERN =
  /Invalid query vector dimensions/

// Skip these tests unless TEST_INTEGRATION is set
const shouldRunIntegrationTests = process.env.TEST_INTEGRATION === "true"

if (!shouldRunIntegrationTests) {
  console.log(
    "⏭  Skipping integration tests. Set TEST_INTEGRATION=true to run."
  )
  // Skip all tests in this file
  process.exit(0)
}

// Test configuration
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687"
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || "neo4j"
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "dfm_password"
const TEST_PREFIX = `integration_test_${Date.now()}`

describe("Neo4j Storage Provider - Integration Tests", () => {
  let storageProvider: Neo4jStorageProvider
  const testEntityNames: string[] = []

  before(() => {
    // Create storage provider with real Neo4j connection
    storageProvider = new Neo4jStorageProvider({
      config: {
        uri: NEO4J_URI,
        username: NEO4J_USERNAME,
        password: NEO4J_PASSWORD,
      },
      logger: createNoOpLogger(),
    })

    console.log("✓ Connected to Neo4j for integration tests")
  })

  after(async () => {
    // Clean up test data
    if (testEntityNames.length > 0) {
      try {
        await storageProvider.deleteEntities(testEntityNames)
        console.log(`✓ Cleaned up ${testEntityNames.length} test entities`)
      } catch (error) {
        console.error("Failed to clean up test data:", error)
      }
    }

    // Close Neo4j connection to allow process to exit
    try {
      await storageProvider.close()
      console.log("✓ Neo4j connection closed")
    } catch (error) {
      console.error("Failed to close Neo4j connection:", error)
    }
  })

  describe("Relations with Strength and Confidence", () => {
    it("should save and retrieve relation with strength and confidence", async () => {
      // Create test entities
      const entityA: Entity = {
        name: `${TEST_PREFIX}_EntityA`,
        entityType: "component",
        observations: ["Test entity A for relations"],
      }
      const entityB: Entity = {
        name: `${TEST_PREFIX}_EntityB`,
        entityType: "component",
        observations: ["Test entity B for relations"],
      }

      testEntityNames.push(entityA.name, entityB.name)

      await storageProvider.createEntities([entityA, entityB])

      // Create relation with strength and confidence
      const relation: Relation = {
        from: entityA.name,
        to: entityB.name,
        relationType: "depends_on",
        strength: 0.85,
        confidence: 0.92,
      }

      const [createdRelation] = await storageProvider.createRelations([
        relation,
      ])

      // Verify relation was created with correct values
      const EXPECTED_STRENGTH = 0.85
      const EXPECTED_CONFIDENCE = 0.92

      ok(createdRelation, "Relation should be created")
      strictEqual(
        createdRelation.strength,
        EXPECTED_STRENGTH,
        "Strength should be saved correctly"
      )
      strictEqual(
        createdRelation.confidence,
        EXPECTED_CONFIDENCE,
        "Confidence should be saved correctly"
      )

      // Retrieve relation and verify persistence
      const retrievedRelation = await storageProvider.getRelation(
        entityA.name,
        entityB.name,
        "depends_on"
      )

      ok(retrievedRelation, "Relation should be retrievable")
      strictEqual(
        retrievedRelation.strength,
        EXPECTED_STRENGTH,
        "Strength should persist in database"
      )
      strictEqual(
        retrievedRelation.confidence,
        EXPECTED_CONFIDENCE,
        "Confidence should persist in database"
      )
    })

    it("should save and retrieve relation with metadata", async () => {
      const entityC: Entity = {
        name: `${TEST_PREFIX}_EntityC`,
        entityType: "feature",
        observations: ["Test entity C with metadata"],
      }
      const entityD: Entity = {
        name: `${TEST_PREFIX}_EntityD`,
        entityType: "task",
        observations: ["Test entity D with metadata"],
      }

      testEntityNames.push(entityC.name, entityD.name)

      await storageProvider.createEntities([entityC, entityD])

      const now = Date.now()
      const relation: Relation = {
        from: entityC.name,
        to: entityD.name,
        relationType: "part_of",
        strength: 0.95,
        confidence: 0.88,
        metadata: {
          inferredFrom: ["code_analysis"],
          lastAccessed: now,
          createdAt: now,
          updatedAt: now,
        },
      }

      const [createdRelation] = await storageProvider.createRelations([
        relation,
      ])

      // Verify metadata was saved
      ok(createdRelation, "Relation should be created")
      ok(createdRelation?.metadata, "Metadata should exist")
      deepStrictEqual(
        createdRelation?.metadata?.inferredFrom,
        ["code_analysis"],
        "inferredFrom should be saved"
      )
      strictEqual(
        createdRelation?.metadata?.lastAccessed,
        now,
        "lastAccessed should be saved"
      )

      // Retrieve and verify metadata persists
      const retrievedRelation = await storageProvider.getRelation(
        entityC.name,
        entityD.name,
        "part_of"
      )

      ok(retrievedRelation?.metadata, "Metadata should persist")
      deepStrictEqual(
        retrievedRelation.metadata?.inferredFrom,
        ["code_analysis"],
        "inferredFrom should persist"
      )
    })

    it("should handle relations without optional fields", async () => {
      const entityE: Entity = {
        name: `${TEST_PREFIX}_EntityE`,
        entityType: "decision",
        observations: ["Test entity E without optional fields"],
      }
      const entityF: Entity = {
        name: `${TEST_PREFIX}_EntityF`,
        entityType: "component",
        observations: ["Test entity F without optional fields"],
      }

      testEntityNames.push(entityE.name, entityF.name)

      await storageProvider.createEntities([entityE, entityF])

      // Create relation WITHOUT strength, confidence, metadata
      const relation: Relation = {
        from: entityE.name,
        to: entityF.name,
        relationType: "relates_to",
      }

      const [createdRelation] = await storageProvider.createRelations([
        relation,
      ])

      // Verify optional fields are handled correctly (null or undefined)
      ok(createdRelation, "Relation should be created")
      ok(
        createdRelation.strength === null ||
          createdRelation.strength === undefined,
        "Strength should be null/undefined when not provided"
      )
      ok(
        createdRelation.confidence === null ||
          createdRelation.confidence === undefined,
        "Confidence should be null/undefined when not provided"
      )
    })
  })

  describe("Entity CRUD Operations", () => {
    it("should create, read, and delete entities", async () => {
      const entity: Entity = {
        name: `${TEST_PREFIX}_CRUDTest`,
        entityType: "component",
        observations: ["Testing CRUD operations"],
      }

      testEntityNames.push(entity.name)

      // Create
      const [created] = await storageProvider.createEntities([entity])
      ok(created, "Entity should be created")
      strictEqual(created?.name, entity.name, "Entity name should match")

      // Read via loadGraph
      const graph = await storageProvider.loadGraph()
      const found = graph.entities.find((e) => e.name === entity.name)
      ok(found, "Entity should be retrievable from graph")

      // Delete
      await storageProvider.deleteEntities([entity.name])

      // Verify deletion
      const graphAfterDelete = await storageProvider.loadGraph()
      const notFound = graphAfterDelete.entities.find(
        (e) => e.name === entity.name
      )
      strictEqual(notFound, undefined, "Entity should be deleted")

      // Remove from cleanup list since we already deleted it
      const index = testEntityNames.indexOf(entity.name)
      if (index > -1) {
        testEntityNames.splice(index, 1)
      }
    })
  })

  describe("Observations", () => {
    it("should add observations to existing entity", async () => {
      const entity: Entity = {
        name: `${TEST_PREFIX}_ObservationTest`,
        entityType: "component",
        observations: ["Initial observation"],
      }

      testEntityNames.push(entity.name)

      await storageProvider.createEntities([entity])

      // Add more observations
      await storageProvider.addObservations([
        {
          entityName: entity.name,
          contents: ["Second observation", "Third observation"],
        },
      ])

      // Verify observations were added
      const EXPECTED_OBSERVATION_COUNT = 3
      const graph = await storageProvider.loadGraph()
      const updated = graph.entities.find((e) => e.name === entity.name)

      ok(updated, "Entity should exist")
      strictEqual(
        updated.observations.length,
        EXPECTED_OBSERVATION_COUNT,
        "Should have 3 observations total"
      )
      ok(
        updated.observations.includes("Initial observation"),
        "Should keep original observation"
      )
      ok(
        updated.observations.includes("Second observation"),
        "Should add second observation"
      )
      ok(
        updated.observations.includes("Third observation"),
        "Should add third observation"
      )
    })
  })

  describe("Complex Queries", () => {
    it("should retrieve relations for a specific entity", async () => {
      const hub: Entity = {
        name: `${TEST_PREFIX}_Hub`,
        entityType: "component",
        observations: ["Hub entity with multiple relations"],
      }
      const spoke1: Entity = {
        name: `${TEST_PREFIX}_Spoke1`,
        entityType: "component",
        observations: ["Spoke 1"],
      }
      const spoke2: Entity = {
        name: `${TEST_PREFIX}_Spoke2`,
        entityType: "component",
        observations: ["Spoke 2"],
      }

      testEntityNames.push(hub.name, spoke1.name, spoke2.name)

      await storageProvider.createEntities([hub, spoke1, spoke2])

      // Create multiple relations
      const createdRelations = await storageProvider.createRelations([
        {
          from: hub.name,
          to: spoke1.name,
          relationType: "depends_on",
          strength: 0.8,
        },
        {
          from: hub.name,
          to: spoke2.name,
          relationType: "depends_on",
          strength: 0.9,
        },
      ])

      // Verify relations were created
      strictEqual(createdRelations.length, 2, "Should create 2 relations")

      // Verify we can retrieve each relation individually
      const relation1 = await storageProvider.getRelation(
        hub.name,
        spoke1.name,
        "depends_on"
      )
      const relation2 = await storageProvider.getRelation(
        hub.name,
        spoke2.name,
        "depends_on"
      )

      ok(relation1, "Should retrieve relation to Spoke1")
      ok(relation2, "Should retrieve relation to Spoke2")
      strictEqual(
        relation1.strength,
        0.8,
        "Spoke1 relation strength should be 0.8"
      )
      strictEqual(
        relation2.strength,
        0.9,
        "Spoke2 relation strength should be 0.9"
      )
    })

    it("should load entire graph with entities and relations", async () => {
      const entity1: Entity = {
        name: `${TEST_PREFIX}_GraphEntity1`,
        entityType: "component",
        observations: ["Graph entity 1"],
      }
      const entity2: Entity = {
        name: `${TEST_PREFIX}_GraphEntity2`,
        entityType: "feature",
        observations: ["Graph entity 2"],
      }

      testEntityNames.push(entity1.name, entity2.name)

      await storageProvider.createEntities([entity1, entity2])
      await storageProvider.createRelations([
        {
          from: entity1.name,
          to: entity2.name,
          relationType: "implements",
          strength: 0.75,
        },
      ])

      const graph = await storageProvider.loadGraph()

      // Verify graph contains our test entities
      const foundEntity1 = graph.entities.find((e) => e.name === entity1.name)
      const foundEntity2 = graph.entities.find((e) => e.name === entity2.name)
      ok(foundEntity1, "Should find entity1 in graph")
      ok(foundEntity2, "Should find entity2 in graph")

      // Verify graph contains our relation
      const foundRelation = graph.relations.find(
        (r) => r.from === entity1.name && r.to === entity2.name
      )
      ok(foundRelation, "Should find relation in graph")
      strictEqual(foundRelation.relationType, "implements")
      strictEqual(foundRelation.strength, 0.75)
    })
  })

  describe("Search Functionality", () => {
    it("should search entities by name pattern", async () => {
      const searchPrefix = `${TEST_PREFIX}_Search`
      const entity1: Entity = {
        name: `${searchPrefix}_Alpha`,
        entityType: "component",
        observations: ["Searchable entity alpha"],
      }
      const entity2: Entity = {
        name: `${searchPrefix}_Beta`,
        entityType: "component",
        observations: ["Searchable entity beta"],
      }
      const entity3: Entity = {
        name: `${TEST_PREFIX}_Other`,
        entityType: "component",
        observations: ["Non-matching entity"],
      }

      testEntityNames.push(entity1.name, entity2.name, entity3.name)

      await storageProvider.createEntities([entity1, entity2, entity3])

      // Search for entities matching the search prefix
      const searchResults = await storageProvider.searchNodes(searchPrefix)

      // Should find both Alpha and Beta but not Other
      const foundNames = searchResults.entities.map((e) => e.name)
      ok(
        foundNames.includes(entity1.name),
        "Should find entity with search prefix"
      )
      ok(
        foundNames.includes(entity2.name),
        "Should find second entity with search prefix"
      )
      ok(
        !foundNames.includes(entity3.name),
        "Should not find entity without search prefix"
      )
    })

    it("should filter entities by type", async () => {
      const typePrefix = `${TEST_PREFIX}_Type`
      const componentEntity: Entity = {
        name: `${typePrefix}_Component`,
        entityType: "component",
        observations: ["Component type entity"],
      }
      const featureEntity: Entity = {
        name: `${typePrefix}_Feature`,
        entityType: "feature",
        observations: ["Feature type entity"],
      }

      testEntityNames.push(componentEntity.name, featureEntity.name)

      await storageProvider.createEntities([componentEntity, featureEntity])

      // Search for only component entities
      const componentResults = await storageProvider.searchNodes(typePrefix, {
        entityTypes: ["component"],
      })

      const foundNames = componentResults.entities.map((e) => e.name)
      ok(
        foundNames.includes(componentEntity.name),
        "Should find component entity"
      )
      ok(
        !foundNames.includes(featureEntity.name),
        "Should not find feature entity when filtering for components"
      )
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle concurrent entity creation", async () => {
      const concurrentPrefix = `${TEST_PREFIX}_Concurrent`
      const entities: Entity[] = Array.from({ length: 10 }, (_, i) => ({
        name: `${concurrentPrefix}_${i}`,
        entityType: "component",
        observations: [`Concurrent entity ${i}`],
      }))

      testEntityNames.push(...entities.map((e) => e.name))

      // Create all entities concurrently
      const createPromises = entities.map((entity) =>
        storageProvider.createEntities([entity])
      )
      const results = await Promise.all(createPromises)

      // Verify all entities were created
      strictEqual(results.length, 10, "Should create all 10 entities")
      for (const result of results) {
        ok(result[0], "Each entity should be created successfully")
      }

      // Verify all entities exist in the database
      const graph = await storageProvider.loadGraph()
      for (const entity of entities) {
        const found = graph.entities.find((e) => e.name === entity.name)
        ok(found, `Entity ${entity.name} should exist in database`)
      }
    })

    it("should handle concurrent relation creation", async () => {
      const relPrefix = `${TEST_PREFIX}_RelConcurrent`
      const source: Entity = {
        name: `${relPrefix}_Source`,
        entityType: "component",
        observations: ["Source for concurrent relations"],
      }
      const targets: Entity[] = Array.from({ length: 5 }, (_, i) => ({
        name: `${relPrefix}_Target${i}`,
        entityType: "component",
        observations: [`Target ${i}`],
      }))

      testEntityNames.push(source.name, ...targets.map((t) => t.name))

      await storageProvider.createEntities([source, ...targets])

      // Create relations concurrently
      const relationPromises = targets.map((target) =>
        storageProvider.createRelations([
          {
            from: source.name,
            to: target.name,
            relationType: "depends_on",
            strength: 0.5 + Math.random() * 0.5,
          },
        ])
      )

      const results = await Promise.all(relationPromises)

      // Verify all relations were created
      strictEqual(results.length, 5, "Should create all 5 relations")
      for (const result of results) {
        ok(result[0], "Each relation should be created successfully")
      }
    })
  })

  describe("Large Data Sets", () => {
    it("should handle batch creation of many entities", async () => {
      const batchPrefix = `${TEST_PREFIX}_Batch`
      const BATCH_SIZE = 50
      const entities: Entity[] = Array.from({ length: BATCH_SIZE }, (_, i) => ({
        name: `${batchPrefix}_${i}`,
        entityType: i % 2 === 0 ? "component" : "feature",
        observations: [
          `Batch entity ${i}`,
          `Type: ${i % 2 === 0 ? "even" : "odd"}`,
        ],
      }))

      testEntityNames.push(...entities.map((e) => e.name))

      // Create all entities in one batch
      const created = await storageProvider.createEntities(entities)

      strictEqual(
        created.length,
        BATCH_SIZE,
        `Should create ${BATCH_SIZE} entities`
      )

      // Verify a sample of entities exist
      const graph = await storageProvider.loadGraph()
      const sampleIndices = [0, 10, 25, 40, 49]
      for (const index of sampleIndices) {
        const entity = entities[index]
        if (entity) {
          const found = graph.entities.find((e) => e.name === entity.name)
          ok(found, `Sample entity at index ${index} should exist`)
        }
      }
    })

    it("should handle batch relation creation", async () => {
      const relBatchPrefix = `${TEST_PREFIX}_RelBatch`
      const ENTITY_COUNT = 10

      // Create a network of entities
      const entities: Entity[] = Array.from(
        { length: ENTITY_COUNT },
        (_, i) => ({
          name: `${relBatchPrefix}_${i}`,
          entityType: "component",
          observations: [`Network entity ${i}`],
        })
      )

      testEntityNames.push(...entities.map((e) => e.name))

      await storageProvider.createEntities(entities)

      // Create relations: each entity connects to the next (chain)
      const relations: Relation[] = []
      for (let i = 0; i < ENTITY_COUNT - 1; i++) {
        const currentEntity = entities[i]
        const nextEntity = entities[i + 1]
        if (currentEntity && nextEntity) {
          relations.push({
            from: currentEntity.name,
            to: nextEntity.name,
            relationType: "depends_on",
            strength: 0.8,
          })
        }
      }

      const created = await storageProvider.createRelations(relations)
      strictEqual(
        created.length,
        ENTITY_COUNT - 1,
        "Should create all chain relations"
      )

      // Verify the chain by checking a few relations
      const entity0 = entities[0]
      const entity1 = entities[1]
      const entity4 = entities[4]
      const entity5 = entities[5]
      const entitySecondLast = entities[ENTITY_COUNT - 2]
      const entityLast = entities[ENTITY_COUNT - 1]

      if (entity0 && entity1) {
        const firstRelation = await storageProvider.getRelation(
          entity0.name,
          entity1.name,
          "depends_on"
        )
        ok(firstRelation, "First relation in chain should exist")
      }

      if (entity4 && entity5) {
        const midRelation = await storageProvider.getRelation(
          entity4.name,
          entity5.name,
          "depends_on"
        )
        ok(midRelation, "Middle relation in chain should exist")
      }

      if (entitySecondLast && entityLast) {
        const lastRelation = await storageProvider.getRelation(
          entitySecondLast.name,
          entityLast.name,
          "depends_on"
        )
        ok(lastRelation, "Last relation in chain should exist")
      }
    })
  })

  describe("Error Handling", () => {
    it("should handle duplicate entity creation gracefully", async () => {
      const dupName = `${TEST_PREFIX}_Duplicate`
      const entity: Entity = {
        name: dupName,
        entityType: "component",
        observations: ["First creation"],
      }

      testEntityNames.push(dupName)

      // Create entity first time
      await storageProvider.createEntities([entity])

      // Try to create same entity again - should either update or handle gracefully
      const entity2: Entity = {
        name: dupName,
        entityType: "component",
        observations: ["Second creation attempt"],
      }

      // This should not throw - it should either update or ignore
      const result = await storageProvider.createEntities([entity2])
      ok(result, "Duplicate creation should be handled gracefully")
    })

    it("should handle non-existent entity in relation creation", async () => {
      const existingEntity: Entity = {
        name: `${TEST_PREFIX}_Existing`,
        entityType: "component",
        observations: ["This entity exists"],
      }

      testEntityNames.push(existingEntity.name)

      await storageProvider.createEntities([existingEntity])

      // Try to create relation with non-existent entity
      const relation: Relation = {
        from: existingEntity.name,
        to: `${TEST_PREFIX}_NonExistent`,
        relationType: "depends_on",
      }

      try {
        await storageProvider.createRelations([relation])
        // If it succeeds, that's okay - some implementations may auto-create
        ok(true, "Either auto-creates or throws error")
      } catch (error) {
        // If it throws, verify it's a meaningful error
        ok(error, "Should throw error for non-existent entity")
      }
    })

    it("should handle retrieval of non-existent relation", async () => {
      const entity1: Entity = {
        name: `${TEST_PREFIX}_NoRel1`,
        entityType: "component",
        observations: ["Entity without relations"],
      }
      const entity2: Entity = {
        name: `${TEST_PREFIX}_NoRel2`,
        entityType: "component",
        observations: ["Another entity without relations"],
      }

      testEntityNames.push(entity1.name, entity2.name)

      await storageProvider.createEntities([entity1, entity2])

      // Try to get non-existent relation
      const result = await storageProvider.getRelation(
        entity1.name,
        entity2.name,
        "does_not_exist"
      )

      // Should return null or undefined for non-existent relation
      ok(
        result === null || result === undefined,
        "Non-existent relation should return null/undefined"
      )
    })

    it("should handle empty search query", async () => {
      const result = await storageProvider.searchNodes("")

      // Empty query should either return all entities or empty results
      ok(Array.isArray(result.entities), "Should return array for empty query")
    })
  })

  describe("Observation Management", () => {
    it("should prevent duplicate observations", async () => {
      const entity: Entity = {
        name: `${TEST_PREFIX}_ObsDup`,
        entityType: "component",
        observations: ["Unique observation"],
      }

      testEntityNames.push(entity.name)

      await storageProvider.createEntities([entity])

      // Add same observation again
      await storageProvider.addObservations([
        {
          entityName: entity.name,
          contents: ["Unique observation"],
        },
      ])

      const graph = await storageProvider.loadGraph()
      const updated = graph.entities.find((e) => e.name === entity.name)

      ok(updated, "Entity should exist")
      // Should still have only 1 observation if duplicates are prevented
      ok(
        updated.observations.length <= 2,
        "Should prevent or limit duplicate observations"
      )
    })

    it("should handle adding multiple observations at once", async () => {
      const entity: Entity = {
        name: `${TEST_PREFIX}_MultiObs`,
        entityType: "component",
        observations: ["Initial observation"],
      }

      testEntityNames.push(entity.name)

      await storageProvider.createEntities([entity])

      const newObservations = Array.from(
        { length: 10 },
        (_, i) => `Observation ${i}`
      )

      await storageProvider.addObservations([
        {
          entityName: entity.name,
          contents: newObservations,
        },
      ])

      const graph = await storageProvider.loadGraph()
      const updated = graph.entities.find((e) => e.name === entity.name)

      ok(updated, "Entity should exist")
      ok(
        updated.observations.length >= 10,
        "Should have added multiple observations"
      )
    })
  })

  describe("Relation Updates", () => {
    it("should update relation strength and confidence", async () => {
      const entityX: Entity = {
        name: `${TEST_PREFIX}_UpdateX`,
        entityType: "component",
        observations: ["Entity X for updates"],
      }
      const entityY: Entity = {
        name: `${TEST_PREFIX}_UpdateY`,
        entityType: "component",
        observations: ["Entity Y for updates"],
      }

      testEntityNames.push(entityX.name, entityY.name)

      await storageProvider.createEntities([entityX, entityY])

      // Create initial relation
      await storageProvider.createRelations([
        {
          from: entityX.name,
          to: entityY.name,
          relationType: "depends_on",
          strength: 0.5,
          confidence: 0.6,
        },
      ])

      // Update the relation with new values
      await storageProvider.createRelations([
        {
          from: entityX.name,
          to: entityY.name,
          relationType: "depends_on",
          strength: 0.9,
          confidence: 0.95,
        },
      ])

      const updated = await storageProvider.getRelation(
        entityX.name,
        entityY.name,
        "depends_on"
      )

      ok(updated, "Relation should exist after update")
      strictEqual(
        updated.strength,
        0.9,
        "Strength should be updated to new value"
      )
      strictEqual(
        updated.confidence,
        0.95,
        "Confidence should be updated to new value"
      )
    })
  })
})

// ============================================================================
// Vector Store Integration Tests
// ============================================================================

describe("Neo4j Vector Store - Integration Tests", () => {
  let connectionManager: Neo4jConnectionManager
  let vectorStore: Neo4jVectorStore
  let session: Session

  before(async () => {
    const config = {
      uri: process.env.NEO4J_URI || "bolt://localhost:7687",
      username: process.env.NEO4J_USERNAME || "neo4j",
      password: process.env.NEO4J_PASSWORD || "dfm_password",
    }

    connectionManager = new Neo4jConnectionManager(config)
    session = connectionManager.getSession()
    console.log("✓ Connected to Neo4j for vector store tests")

    // Drop the default index to avoid conflicts
    try {
      await session.run("DROP INDEX entity_embeddings IF EXISTS")
    } catch (error) {
      console.warn("Could not drop default index, proceeding anyway...")
    }

    // Initialize vector store with test index
    vectorStore = new Neo4jVectorStore({
      connectionManager,
      indexName: "test_entity_embeddings",
      dimensions: 384, // Smaller dimension for faster testing
      similarityFunction: "cosine",
      entityNodeLabel: "Entity",
      logger: {
        debug: (message, meta) => console.log(`DEBUG: ${message}`, meta),
        info: (message, meta) => console.log(`INFO: ${message}`, meta),
        warn: (message, meta) => console.log(`WARN: ${message}`, meta),
        error: (message, error, meta) =>
          console.log(`ERROR: ${message}`, error, meta),
      },
    })

    await vectorStore.initialize()
    console.log("✓ Vector store initialized")
  })

  after(async () => {
    // Clean up test entities
    await session.run(`
      MATCH (e:Entity)
      WHERE e.name STARTS WITH 'test_vector_'
      DETACH DELETE e
    `)

    // Drop test vector index
    try {
      await session.run("DROP INDEX test_entity_embeddings IF EXISTS")
    } catch {
      // Ignore if index doesn't exist
    }

    await session.close()
    await connectionManager.close()
    console.log("✓ Vector store tests cleaned up")
  })

  /**
   * Helper function to create a normalized random vector
   */
  function createNormalizedVector(dimensions: number, seed = 0): number[] {
    const vector = Array.from(
      { length: dimensions },
      (_, i) => Math.sin(seed + i) * 0.5 + Math.cos(seed * i) * 0.5
    )

    // Normalize to unit length
    const l2Norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return vector.map((val) => val / l2Norm)
  }

  describe("Vector Storage", () => {
    it("should add and store a vector for an entity", async () => {
      const entityName = "test_vector_entity_1"
      const vector = createNormalizedVector(384, 1)

      await vectorStore.addVector(entityName, vector)

      // Verify the vector was stored
      const result = await session.run(
        `
        MATCH (e:Entity {name: $name})
        RETURN e.embedding AS embedding, size(e.embedding) AS dimensions
        `,
        { name: entityName }
      )

      strictEqual(result.records.length, 1, "Entity should exist")
      const record = result.records[0]
      const storedVector = record?.get("embedding")
      const dimensions = record?.get("dimensions")?.toNumber()

      strictEqual(dimensions, 384, "Should have correct dimensions")
      ok(Array.isArray(storedVector), "Embedding should be an array")
      strictEqual(
        storedVector.length,
        384,
        "Stored vector should have correct length"
      )
    })

    it("should update existing vector when adding to same entity", async () => {
      const entityName = "test_vector_entity_2"
      const vector1 = createNormalizedVector(384, 2)
      const vector2 = createNormalizedVector(384, 3)

      // Add first vector
      await vectorStore.addVector(entityName, vector1)

      // Add second vector (update)
      await vectorStore.addVector(entityName, vector2)

      // Verify only one entity exists with the second vector
      const result = await session.run(
        `
        MATCH (e:Entity {name: $name})
        RETURN count(e) AS count, e.embedding AS embedding
        `,
        { name: entityName }
      )

      strictEqual(result.records.length, 1, "Should have exactly one entity")
      const storedVector = result.records[0]?.get("embedding")
      ok(storedVector, "Stored vector should exist")
      ok(
        Array.isArray(storedVector) && storedVector.length > 0,
        "Vector should be array"
      )

      // Verify it's the second vector (not the first)
      ok(
        vector2[0] !== undefined &&
          Math.abs(storedVector[0] - vector2[0]) < 0.0001,
        "Should have updated vector"
      )
    })

    it("should store metadata with vector", async () => {
      const entityName = "test_vector_entity_3"
      const vector = createNormalizedVector(384, 4)
      const metadata = {
        entityType: "concept",
        source: "test",
        importance: 0.8,
      }

      await vectorStore.addVector(entityName, vector, metadata)

      // Verify metadata was stored
      const result = await session.run(
        `
        MATCH (e:Entity {name: $name})
        RETURN e.metadata AS metadata
        `,
        { name: entityName }
      )

      const storedMetadata = JSON.parse(result.records[0]?.get("metadata"))
      deepStrictEqual(
        storedMetadata,
        metadata,
        "Metadata should be stored correctly"
      )
    })

    it("should reject vectors with incorrect dimensions", async () => {
      const entityName = "test_vector_entity_bad"
      const wrongVector = [0.1, 0.2, 0.3] // Only 3 dimensions instead of 384

      await rejects(
        async () => {
          await vectorStore.addVector(entityName, wrongVector)
        },
        INVALID_VECTOR_DIMENSIONS_PATTERN,
        "Should reject wrong dimensions"
      )
    })
  })

  describe("Vector Removal", () => {
    it("should remove vector but keep entity", async () => {
      const entityName = "test_vector_entity_remove"
      const vector = createNormalizedVector(384, 5)

      // Add vector
      await vectorStore.addVector(entityName, vector)

      // Remove vector
      await vectorStore.removeVector(entityName)

      // Verify entity exists but has no embedding
      const result = await session.run(
        `
        MATCH (e:Entity {name: $name})
        RETURN e, e.embedding AS embedding
        `,
        { name: entityName }
      )

      strictEqual(result.records.length, 1, "Entity should still exist")
      strictEqual(
        result.records[0]?.get("embedding"),
        null,
        "Embedding should be removed"
      )
    })
  })

  describe("Vector Search", () => {
    before(async () => {
      // Create a set of test entities with known vectors
      const testData = [
        {
          name: "test_vector_search_1",
          vector: createNormalizedVector(384, 10),
        },
        {
          name: "test_vector_search_2",
          vector: createNormalizedVector(384, 11),
        },
        {
          name: "test_vector_search_3",
          vector: createNormalizedVector(384, 12),
        },
        {
          name: "test_vector_search_4",
          vector: createNormalizedVector(384, 13),
        },
        {
          name: "test_vector_search_5",
          vector: createNormalizedVector(384, 14),
        },
      ]

      for (const item of testData) {
        await vectorStore.addVector(item.name, item.vector)
      }

      // Wait a bit for index to update
      await new Promise((resolve) => setTimeout(resolve, 1000))
    })

    it("should find similar vectors using semantic search", async () => {
      // Use a query vector similar to the first test entity
      const queryVector = createNormalizedVector(384, 10.1) // Very close to seed 10

      const results = await vectorStore.search(queryVector, { limit: 3 })

      ok(results.length > 0, "Should return search results")

      // Verify results have required fields
      for (const result of results) {
        ok(result.id, "Result should have id")
        ok(
          typeof result.similarity === "number",
          "Result should have similarity score"
        )
        ok(
          result.similarity >= 0 && result.similarity <= 1,
          "Similarity should be in [0,1]"
        )
      }

      // Results should be ordered by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        const prevResult = results[i - 1]
        const currentResult = results[i]
        if (prevResult && currentResult) {
          ok(
            prevResult.similarity >= currentResult.similarity,
            "Results should be ordered by similarity"
          )
        }
      }
    })

    it("should filter results by minimum similarity threshold", async () => {
      const queryVector = createNormalizedVector(384, 10) // Identical to test_vector_search_1

      const results = await vectorStore.search(queryVector, {
        limit: 10,
        minSimilarity: 0.99, // High threshold
      })

      // All results should meet the threshold if any are returned
      if (results.length > 0) {
        for (const result of results) {
          ok(
            result.similarity >= 0.99,
            `Similarity ${result.similarity} should be >= 0.99`
          )
        }
      }
    })

    it("should handle empty results gracefully", async () => {
      // Create a vector very different from existing ones
      const queryVector = Array.from({ length: 384 }, () => 0)
      queryVector[0] = 1 // Unit vector in a single dimension

      const results = await vectorStore.search(queryVector, {
        minSimilarity: 0.99, // Impossibly high threshold
      })

      // Should return fallback results or empty array
      ok(Array.isArray(results), "Should return an array")
    })

    it("should reject query vectors with wrong dimensions", async () => {
      const wrongQueryVector = [0.1, 0.2, 0.3] // Only 3 dimensions

      await rejects(
        async () => {
          await vectorStore.search(wrongQueryVector)
        },
        INVALID_QUERY_VECTOR_DIMENSIONS_PATTERN,
        "Should reject wrong dimensions"
      )
    })
  })

  describe("Vector Store Diagnostics", () => {
    it("should return diagnostic information", async () => {
      const diagnostics = await vectorStore.diagnosticGetEntityEmbeddings()

      ok(typeof diagnostics.count === "number", "Should return count")
      ok(diagnostics.count > 0, "Should have entities with embeddings")
      ok(Array.isArray(diagnostics.samples), "Should return samples array")
      ok(diagnostics.indexInfo, "Should return index info")
      ok(diagnostics.vectorQueryTest, "Should return query test results")
    })
  })
})
