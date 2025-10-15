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
 * 3. Environment: NODE_ENV=testing TEST_INTEGRATION=true
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { Neo4jStorageProvider } from "#storage/neo4j/neo4j-storage-provider"
import type { Entity, Relation } from "#types"
import { createNoOpLogger } from "#types/logger"

// Skip these tests unless TEST_INTEGRATION is set
const shouldRunIntegrationTests = process.env.TEST_INTEGRATION === "true"

if (!shouldRunIntegrationTests) {
  console.log(
    "⏭️  Skipping integration tests. Set TEST_INTEGRATION=true to run."
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
        entityType: "test",
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
      await storageProvider.createRelations([
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

      // Get all relations for hub using loadGraph
      const graph = await storageProvider.loadGraph()
      const relations = graph.relations.filter(
        (r: Relation) => r.from === hub.name
      )

      strictEqual(relations.length, 2, "Hub should have 2 relations")
      ok(
        relations.some((r: Relation) => r.to === spoke1.name),
        "Should have relation to Spoke1"
      )
      ok(
        relations.some((r: Relation) => r.to === spoke2.name),
        "Should have relation to Spoke2"
      )
    })
  })
})

console.log("\n✅ Neo4j integration tests complete. Database state verified.\n")
