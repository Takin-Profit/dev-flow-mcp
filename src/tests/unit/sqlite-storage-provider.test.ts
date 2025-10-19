// Copyright 2025 Takin Profit. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, test } from "node:test"
import { ConsoleLogger, LogLevel } from "@takinprofit/sqlite-x"
import { SqliteDb } from "#db/sqlite-db"
import { SqliteSchemaManager } from "#db/sqlite-schema-manager"
import type { Entity, Relation } from "#types"

describe("SqliteDb Unit Tests", () => {
  let storage: SqliteDb
  let logger: ConsoleLogger

  beforeEach(async () => {
    logger = new ConsoleLogger(LogLevel.DEBUG)
    storage = new SqliteDb(":memory:", logger)
    const schemaManager = new SqliteSchemaManager(storage.dbInstance, logger)
    await schemaManager.initializeSchema()
  })

  afterEach(() => {
    storage.dbInstance.close()
  })

  test("Temporal Versioning: create entity sets version 1", async () => {
    const entity: Entity = {
      name: "test",
      entityType: "task",
      observations: [],
    }
    const [created] = await storage.createEntities([entity])
    assert.ok(created, "Entity should be created")
    assert.equal(created.version, 1)
    assert.ok(created.validFrom)
    assert.equal(created.validTo, undefined)
  })

  test("Temporal Versioning: addObservations creates new version", async () => {
    const entity: Entity = {
      name: "test",
      entityType: "task",
      observations: [],
    }
    await storage.createEntities([entity])

    await storage.addObservations([{ entityName: "test", contents: ["obs1"] }])

    const history = await storage.getEntityHistory("test")
    assert.equal(history.length, 2)
    assert.ok(history[0], "First version should exist")
    assert.equal(history[0].version, 1)
    assert.ok(history[0].validTo)
    assert.ok(history[1], "Second version should exist")
    assert.equal(history[1].version, 2)
    assert.equal(history[1].validTo, undefined)
    assert.deepEqual(history[1].observations, ["obs1"])
  })

  test("Temporal Versioning: updateRelation creates new version", async () => {
    const entityA: Entity = { name: "A", entityType: "task", observations: [] }
    const entityB: Entity = { name: "B", entityType: "task", observations: [] }
    await storage.createEntities([entityA, entityB])

    const relation: Relation = {
      from: "A",
      to: "B",
      relationType: "relates_to",
    }
    await storage.createRelations([relation])

    await storage.updateRelation({ ...relation, strength: 0.8 })

    const history = await storage.getRelationHistory("A", "B", "relates_to")
    assert.equal(history.length, 2)
  })

  test("Soft Deletes: deleteEntities sets valid_to", async () => {
    const entity: Entity = {
      name: "test",
      entityType: "task",
      observations: [],
    }
    await storage.createEntities([entity])

    await storage.deleteEntities(["test"])

    const current = await storage.getEntity("test")
    assert.equal(current, null)

    const history = await storage.getEntityHistory("test")
    assert.equal(history.length, 1)
    assert.ok(history[0], "History should have one entry")
    assert.ok(history[0].validTo)
  })

  test("Confidence Decay: getDecayedGraph decreases confidence", async () => {
    const entityA: Entity = { name: "A", entityType: "task", observations: [] }
    const entityB: Entity = { name: "B", entityType: "task", observations: [] }
    await storage.createEntities([entityA, entityB])

    const relation: Relation = {
      from: "A",
      to: "B",
      relationType: "relates_to",
      confidence: 0.9,
    }
    await storage.createRelations([relation])

    // Manually update valid_from to be in the past
    const pastDate = Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 days ago
    storage.dbInstance.exec(`UPDATE relations SET valid_from = ${pastDate}`)

    const decayedGraph = await storage.getDecayedGraph()
    const decayedRelation = decayedGraph.relations[0]

    assert.ok(decayedRelation, "Decayed relation should exist")
    assert.ok(
      decayedRelation.confidence !== undefined,
      "Confidence should be defined"
    )
    assert.ok(decayedRelation.confidence! < 0.9)
  })

  test("Embeddings: update and get entity embedding", async () => {
    const entity: Entity = {
      name: "test",
      entityType: "task",
      observations: [],
    }
    await storage.createEntities([entity])

    const embedding = {
      vector: [1, 2, 3],
      model: "test-model",
      lastUpdated: Date.now(),
    }
    await storage.updateEntityEmbedding("test", embedding)

    const retrieved = await storage.getEntityEmbedding("test")
    assert.deepEqual(retrieved?.vector, [1, 2, 3])
  })

  test("diagnoseVectorSearch provides correct counts", async () => {
    const entity1: Entity = {
      name: "test1",
      entityType: "task",
      observations: [],
    }
    const entity2: Entity = {
      name: "test2",
      entityType: "task",
      observations: [],
    }
    await storage.createEntities([entity1, entity2])

    const embedding = {
      vector: [1, 2, 3],
      model: "test-model",
      lastUpdated: Date.now(),
    }
    await storage.updateEntityEmbedding("test1", embedding)

    const updatedEntity = await storage.getEntity("test1")
    assert.ok(updatedEntity, "Entity should exist")
    assert.deepEqual(updatedEntity.embedding, [1, 2, 3])

    const diagnostics = await storage.diagnoseVectorSearch()
    assert.equal(diagnostics.entitiesWithEmbeddings, 1)
    assert.equal(diagnostics.totalEntities, 2)
  })
})
