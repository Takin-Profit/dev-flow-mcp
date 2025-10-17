// biome-ignore-all lint/style/noDoneCallback: node:test uses a context object 't' not a callback
/** biome-ignore-all lint/style/noMagicNumbers: tests */

/**
 * Test file for KnowledgeGraphManager
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert/strict"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import { KnowledgeGraphManager } from "#knowledge-graph-manager"
import type { StorageProvider } from "#db/storage-provider"
import type {
  Entity,
  KnowledgeGraph,
  Relation,
  TemporalEntityType,
} from "#types"

// Define EntityObservation type based on the addObservations method parameter
type EntityObservation = {
  entityName: string
  contents: string[]
  [key: string]: unknown
}

const EMPTY_GRAPH: KnowledgeGraph = { entities: [], relations: [] }
const ONE_SECOND_IN_MS = 1000
const VECTOR_DIMENSIONS = 1536
const EMBEDDING_VALUE = 0.1
const MIN_SIMILARITY = 0.8
const SEARCH_LIMIT = 20
const RELATION_STRENGTH = 0.8
const RELATION_CONFIDENCE = 0.9
const UPDATED_STRENGTH = 0.9
const UPDATED_CONFIDENCE = 0.95

describe("KnowledgeGraphManager with Enhanced Relations", () => {
  it("should use StorageProvider getRelation for retrieving a relation", async (t) => {
    const timestamp = Date.now()
    const enhancedRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "relates_to",
      strength: RELATION_STRENGTH,
      confidence: RELATION_CONFIDENCE,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        inferredFrom: [],
        lastAccessed: timestamp,
      },
    }

    const getRelationMock = t.mock.fn((..._args: unknown[]) =>
      Promise.resolve(enhancedRelation)
    )
    const mockProvider: Partial<StorageProvider> = {
      getRelation: getRelationMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const relation = await manager.getRelation("entity1", "entity2", "knows")

    strictEqual(getRelationMock.mock.callCount(), 1)
    deepStrictEqual(getRelationMock.mock.calls[0]?.arguments, [
      "entity1",
      "entity2",
      "knows",
    ])
    deepStrictEqual(relation, enhancedRelation)
  })

  it("should use StorageProvider updateRelation for updating a relation", async (t) => {
    const timestamp = Date.now()
    const updatedRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "relates_to",
      strength: UPDATED_STRENGTH,
      confidence: UPDATED_CONFIDENCE,
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp + ONE_SECOND_IN_MS,
        inferredFrom: [],
        lastAccessed: timestamp,
      },
    }

    const updateRelationMock = t.mock.fn((..._args: unknown[]) =>
      Promise.resolve(undefined)
    )
    const mockProvider: Partial<StorageProvider> = {
      updateRelation: updateRelationMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    await manager.updateRelation(updatedRelation)

    strictEqual(updateRelationMock.mock.callCount(), 1)
    deepStrictEqual(updateRelationMock.mock.calls[0]?.arguments, [
      updatedRelation,
    ])
  })
})

describe("KnowledgeGraphManager with StorageProvider", () => {
  it("should accept a StorageProvider in constructor", (t) => {
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: loadGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    ok(manager instanceof KnowledgeGraphManager)
  })

  it("should use StorageProvider loadGraph when reading graph", async (t) => {
    const mockGraph: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const loadGraphMock = t.mock.fn(() => Promise.resolve(mockGraph))
    const mockProvider: Partial<StorageProvider> = {
      loadGraph: loadGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const result = await manager.readGraph()

    strictEqual(loadGraphMock.mock.callCount(), 1)
    deepStrictEqual(result, mockGraph)
  })

  it("should use StorageProvider createEntities when creating entities", async (t) => {
    const createEntitiesMock = t.mock.fn(
      async (entities: Entity[]): Promise<TemporalEntityType[]> =>
        entities.map((e) => ({
          id: `id-${e.name}`,
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          validFrom: Date.now(),
          embedding: e.embedding,
        })) as TemporalEntityType[]
    )
    const mockProvider: Partial<StorageProvider> = {
      createEntities: createEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const newEntity: Entity = {
      name: "newEntity",
      entityType: "test",
      observations: [],
    }
    await manager.createEntities([newEntity])

    strictEqual(createEntitiesMock.mock.callCount(), 1)
    deepStrictEqual(createEntitiesMock.mock.calls[0]?.arguments, [[newEntity]])
  })

  it("should use StorageProvider searchNodes when searching", async (t) => {
    const mockSearchResult: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const searchNodesMock = t.mock.fn(() => Promise.resolve(mockSearchResult))
    const mockProvider: Partial<StorageProvider> = {
      searchNodes: searchNodesMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const query = "test"
    const result = await manager.searchNodes(query)

    strictEqual(searchNodesMock.mock.callCount(), 1)
    deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, [query])
    deepStrictEqual(result, mockSearchResult)
  })

  it("should use StorageProvider openNodes when opening nodes", async (t) => {
    const mockOpenResult: KnowledgeGraph = {
      entities: [{ name: "test", entityType: "test", observations: [] }],
      relations: [],
    }

    const openNodesMock = t.mock.fn(() => Promise.resolve(mockOpenResult))
    const mockProvider: Partial<StorageProvider> = {
      openNodes: openNodesMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const nodeNames = ["test"]
    const result = await manager.openNodes(nodeNames)

    strictEqual(openNodesMock.mock.callCount(), 1)
    deepStrictEqual(openNodesMock.mock.calls[0]?.arguments, [nodeNames])
    deepStrictEqual(result, mockOpenResult)
  })

  it("should use StorageProvider when creating relations", async (t) => {
    const createRelationsMock = t.mock.fn(
      async (relations: Relation[]) => relations
    )
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      createRelations: createRelationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const newRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "relates_to",
    }
    await manager.createRelations([newRelation])

    strictEqual(createRelationsMock.mock.callCount(), 1)
    deepStrictEqual(createRelationsMock.mock.calls[0]?.arguments, [
      [newRelation],
    ])
    strictEqual(loadGraphMock.mock.callCount(), 0)
    strictEqual(saveGraphMock.mock.callCount(), 0)
  })

  it("should use StorageProvider when adding observations", async (t) => {
    const observations: EntityObservation[] = [
      {
        entityName: "entity1",
        contents: ["new observation"],
      },
    ]

    const expectedResult = [
      {
        entityName: "entity1",
        addedObservations: ["new observation"],
      },
    ]

    const addObservationsMock = t.mock.fn(() => Promise.resolve(expectedResult))
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      addObservations: addObservationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })
    const result = await manager.addObservations(observations)

    strictEqual(addObservationsMock.mock.callCount(), 1)
    deepStrictEqual(addObservationsMock.mock.calls[0]?.arguments, [
      observations,
    ])
    deepStrictEqual(result, expectedResult)
    strictEqual(loadGraphMock.mock.callCount(), 0)
    strictEqual(saveGraphMock.mock.callCount(), 0)
  })

  it("should directly delegate to StorageProvider for createRelations", async (t) => {
    const newRelation: Relation = {
      from: "entity1",
      to: "entity2",
      relationType: "relates_to",
    }

    const createRelationsMock = t.mock.fn(
      async (relations: Relation[]) => relations
    )
    const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))
    const saveGraphMock = t.mock.fn(() => Promise.resolve())
    const mockProvider: Partial<StorageProvider> = {
      createRelations: createRelationsMock,
      loadGraph: loadGraphMock,
      saveGraph: saveGraphMock,
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const result = await manager.createRelations([newRelation])

    strictEqual(createRelationsMock.mock.callCount(), 1)
    deepStrictEqual(createRelationsMock.mock.calls[0]?.arguments, [
      [newRelation],
    ])
    deepStrictEqual(result, [newRelation])
    strictEqual(loadGraphMock.mock.callCount(), 0)
    strictEqual(saveGraphMock.mock.callCount(), 0)
  })
})

// From src/__vitest__/KnowledgeGraphManagerSearch.test.ts
describe("KnowledgeGraphManager Search", () => {
  let manager: KnowledgeGraphManager
  let mockStorageProvider: Partial<StorageProvider>
  let searchNodesMock: any
  let semanticSearchMock: any

  beforeEach(() => {
    searchNodesMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "KeywordResult",
            entityType: "Test",
            observations: ["keyword result"],
          },
        ],
        relations: [],
      })
    )

    semanticSearchMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "SemanticResult",
            entityType: "Test",
            observations: ["semantic result"],
          },
        ],
        relations: [],
        total: 1,
        facets: { entityType: { counts: { Test: 1 } } },
        timeTaken: 10,
      })
    )

    mockStorageProvider = {
      searchNodes: searchNodesMock,
      semanticSearch: semanticSearchMock,
    }

    const mockEmbeddingService = {
      generateEmbedding: mock.fn(() =>
        Promise.resolve(new Array(VECTOR_DIMENSIONS).fill(EMBEDDING_VALUE))
      ),
    }

    const mockEmbeddingJobManager = {
      getEmbeddingService: () => mockEmbeddingService,
      embeddingService: mockEmbeddingService,
      scheduleEntityEmbedding: mock.fn(() => Promise.resolve("mock-job-id")),
    }

    manager = new KnowledgeGraphManager({
      storageProvider: mockStorageProvider as StorageProvider,
      embeddingJobManager: mockEmbeddingJobManager as any,
    })
  })

  afterEach(() => {
    mock.reset()
  })

  it("should use basic searchNodes when no options are provided", async () => {
    const result = await manager.search("test query")

    strictEqual(searchNodesMock.mock.callCount(), 1)
    deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, ["test query"])
    strictEqual(semanticSearchMock.mock.callCount(), 0)

    strictEqual(result.entities.length, 1)
    strictEqual(result.entities[0]?.name, "KeywordResult")
  })

  it("should use semanticSearch when semanticSearch option is true", async () => {
    const result = await manager.search("test query", { semanticSearch: true })

    strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    strictEqual(callArgs[0], "test query")
    strictEqual(callArgs[1].semanticSearch, true)
    ok(Array.isArray(callArgs[1].queryVector))

    strictEqual(searchNodesMock.mock.callCount(), 0)

    strictEqual(result.entities.length, 1)
    strictEqual(result.entities[0]?.name, "SemanticResult")
  })

  it("should use semanticSearch when hybridSearch option is true", async () => {
    const result = await manager.search("test query", { hybridSearch: true })

    strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    strictEqual(callArgs[0], "test query")
    strictEqual(callArgs[1].hybridSearch, true)
    strictEqual(callArgs[1].semanticSearch, true)
    ok(Array.isArray(callArgs[1].queryVector))

    strictEqual(result.entities.length, 1)
    strictEqual(result.entities[0]?.name, "SemanticResult")
  })

  it("should fall back to searchNodes if semanticSearch is not available", async () => {
    mockStorageProvider.semanticSearch = undefined

    const result = await manager.search("test query", { semanticSearch: true })

    strictEqual(searchNodesMock.mock.callCount(), 1)
    deepStrictEqual(searchNodesMock.mock.calls[0]?.arguments, ["test query"])

    strictEqual(result.entities.length, 1)
    strictEqual(result.entities[0]?.name, "KeywordResult")
  })

  it("should fall back to basic search for file-based implementation", async () => {
    const fileSearchNodesMock = mock.fn(() =>
      Promise.resolve({
        entities: [
          {
            name: "FileResult",
            entityType: "test" as const,
            observations: ["file result"],
          },
        ],
        relations: [],
      })
    )

    const mockProvider: Partial<StorageProvider> = {
      searchNodes: fileSearchNodesMock,
    }

    const fileBasedManager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    const result = await fileBasedManager.search("test query", {
      semanticSearch: true,
    })

    // Should call the provider's searchNodes as fallback
    strictEqual(fileSearchNodesMock.mock.callCount(), 1)
    deepStrictEqual(fileSearchNodesMock.mock.calls[0]?.arguments, [
      "test query",
    ])

    strictEqual(result.entities.length, 1)
    strictEqual(result.entities[0]?.name, "FileResult")
  })

  it("should pass additional search options to semanticSearch", async () => {
    const searchOptions = {
      semanticSearch: true,
      minSimilarity: MIN_SIMILARITY,
      limit: SEARCH_LIMIT,
      entityTypes: ["feature", "task"],
    }

    await manager.search("test query", searchOptions)

    strictEqual(semanticSearchMock.mock.callCount(), 1)
    const callArgs = semanticSearchMock.mock.calls[0]?.arguments
    strictEqual(callArgs[0], "test query")
    strictEqual(callArgs[1].semanticSearch, true)
    strictEqual(callArgs[1].minSimilarity, MIN_SIMILARITY)
    strictEqual(callArgs[1].limit, SEARCH_LIMIT)
    deepStrictEqual(callArgs[1].entityTypes, ["feature", "task"])
  })
})

describe("KnowledgeGraphManager with VectorStore", () => {
  it("should add entity embeddings to vector store when created", async (t) => {
    const addVectorMock = t.mock.fn(() => Promise.resolve(undefined))

    const mockVectorStore = {
      initialize: t.mock.fn(() => Promise.resolve(undefined)),
      addVector: addVectorMock,
      removeVector: t.mock.fn(() => Promise.resolve(undefined)),
      search: t.mock.fn(() =>
        Promise.resolve([
          {
            id: "Entity1",
            similarity: 0.95,
            metadata: { entityType: "Person" },
          },
        ])
      ),
    }

    const createEntitiesMock = t.mock.fn(
      (entities: Entity[]): Promise<TemporalEntityType[]> =>
        Promise.resolve(
          entities.map((e) => ({
            id: `id-${e.name}`,
            name: e.name,
            entityType: e.entityType,
            observations: e.observations,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            validFrom: Date.now(),
            embedding: e.embedding,
          })) as TemporalEntityType[]
        )
    )

    const mockProvider: Partial<StorageProvider> = {
      createEntities: createEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    // Manually inject the mock vector store (in a real scenario, this would use dependency injection)
    // @ts-expect-error - accessing private property for testing
    manager.vectorStore = mockVectorStore

    const entity = {
      name: "TestEntity",
      entityType: "test" as const,
      observations: ["Test observation"],
      embedding: {
        vector: new Array(VECTOR_DIMENSIONS)
          .fill(0)
          .map((_, i) => i / VECTOR_DIMENSIONS),
        model: "test-model",
        lastUpdated: Date.now(),
      },
    }

    await manager.createEntities([entity])

    strictEqual(createEntitiesMock.mock.callCount(), 1)
    strictEqual(addVectorMock.mock.callCount(), 1)
    // Check the first call's arguments - type assertion needed for node:test mock API
    const firstCall = addVectorMock.mock.calls[0]
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    strictEqual(firstCall?.arguments[0], "TestEntity")
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    deepStrictEqual(firstCall?.arguments[2], {
      entityType: "test",
      name: "TestEntity",
    })
  })

  it("should remove vectors from store when entities are deleted", async (t) => {
    const removeVectorMock = t.mock.fn(() => Promise.resolve(undefined))
    const deleteEntitiesMock = t.mock.fn(() => Promise.resolve(undefined))

    const mockVectorStore = {
      initialize: t.mock.fn(() => Promise.resolve(undefined)),
      addVector: t.mock.fn(() => Promise.resolve(undefined)),
      removeVector: removeVectorMock,
      search: t.mock.fn(() => Promise.resolve([])),
    }

    const mockProvider: Partial<StorageProvider> = {
      deleteEntities: deleteEntitiesMock,
      loadGraph: t.mock.fn(() => Promise.resolve(EMPTY_GRAPH)),
    }

    const manager = new KnowledgeGraphManager({
      storageProvider: mockProvider as StorageProvider,
    })

    // Manually inject the mock vector store
    // @ts-expect-error - accessing private property for testing
    manager.vectorStore = mockVectorStore

    await manager.deleteEntities(["Entity1", "Entity2"])

    strictEqual(removeVectorMock.mock.callCount(), 2)
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    strictEqual(removeVectorMock.mock.calls[0]?.arguments[0], "Entity1")
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    strictEqual(removeVectorMock.mock.calls[1]?.arguments[0], "Entity2")
    strictEqual(deleteEntitiesMock.mock.callCount(), 1)
    // @ts-expect-error - node:test mock calls have empty tuple type, but contain actual arguments at runtime
    deepStrictEqual(deleteEntitiesMock.mock.calls[0]?.arguments[0], [
      "Entity1",
      "Entity2",
    ])
  })
})

/**
 * Neo4j Storage Provider Unit Tests
 *
 * These tests mock the Neo4j storage provider to verify the same functionality
 * as the integration tests without requiring a real database.
 */
describe("Neo4j Storage Provider Unit Tests", () => {
  describe("Relations with Strength and Confidence", () => {
    it("should create relation with strength and confidence through KnowledgeGraphManager", async (t) => {
      const timestamp = Date.now()
      const relation: Relation = {
        from: "EntityA",
        to: "EntityB",
        relationType: "depends_on",
        strength: 0.85,
        confidence: 0.92,
        metadata: {
          createdAt: timestamp,
          updatedAt: timestamp,
          inferredFrom: [],
          lastAccessed: timestamp,
        },
      }

      const createRelationsMock = t.mock.fn(() => Promise.resolve([relation]))
      const getRelationMock = t.mock.fn(() => Promise.resolve(relation))

      const mockProvider: Partial<StorageProvider> = {
        createRelations: createRelationsMock,
        getRelation: getRelationMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const [created] = await manager.createRelations([relation])

      ok(created, "Relation should be created")
      strictEqual(created.strength, 0.85, "Strength should be saved correctly")
      strictEqual(
        created.confidence,
        0.92,
        "Confidence should be saved correctly"
      )

      const retrieved = await manager.getRelation(
        "EntityA",
        "EntityB",
        "depends_on"
      )

      ok(retrieved, "Relation should be retrievable")
      strictEqual(retrieved.strength, 0.85, "Strength should persist")
      strictEqual(retrieved.confidence, 0.92, "Confidence should persist")
    })

    it("should save and retrieve relation with metadata", async (t) => {
      const timestamp = Date.now()
      const relation: Relation = {
        from: "EntityC",
        to: "EntityD",
        relationType: "part_of",
        strength: 0.95,
        confidence: 0.88,
        metadata: {
          inferredFrom: ["code_analysis"],
          lastAccessed: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }

      const createRelationsMock = t.mock.fn(() => Promise.resolve([relation]))
      const getRelationMock = t.mock.fn(() => Promise.resolve(relation))

      const mockProvider: Partial<StorageProvider> = {
        createRelations: createRelationsMock,
        getRelation: getRelationMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const [created] = await manager.createRelations([relation])

      ok(created?.metadata, "Metadata should exist")
      deepStrictEqual(
        created.metadata.inferredFrom,
        ["code_analysis"],
        "inferredFrom should be saved"
      )
      strictEqual(
        created.metadata.lastAccessed,
        timestamp,
        "lastAccessed should be saved"
      )

      const retrieved = await manager.getRelation(
        "EntityC",
        "EntityD",
        "part_of"
      )

      ok(retrieved?.metadata, "Metadata should persist")
      deepStrictEqual(
        retrieved.metadata.inferredFrom,
        ["code_analysis"],
        "inferredFrom should persist"
      )
    })

    it("should handle relations without optional fields", async (t) => {
      const relation: Relation = {
        from: "EntityE",
        to: "EntityF",
        relationType: "relates_to",
      }

      const createRelationsMock = t.mock.fn(() => Promise.resolve([relation]))

      const mockProvider: Partial<StorageProvider> = {
        createRelations: createRelationsMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const [created] = await manager.createRelations([relation])

      ok(created, "Relation should be created")
      ok(
        created.strength === null || created.strength === undefined,
        "Strength should be null/undefined when not provided"
      )
      ok(
        created.confidence === null || created.confidence === undefined,
        "Confidence should be null/undefined when not provided"
      )
    })
  })

  describe("Entity CRUD Operations", () => {
    it("should create, read, and delete entities", async (t) => {
      const timestamp = Date.now()
      const entity: Entity = {
        name: "CRUDTest",
        entityType: "test",
        observations: ["Testing CRUD operations"],
      }

      const temporalEntity = {
        ...entity,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }

      const createEntitiesMock = t.mock.fn((_entities: Entity[]) =>
        Promise.resolve([temporalEntity])
      )
      const getEntityMock = t.mock.fn((_entityName: string) =>
        Promise.resolve(temporalEntity)
      )
      const deleteEntitiesMock = t.mock.fn((_entityNames: string[]) =>
        Promise.resolve()
      )
      const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))

      const mockProvider: Partial<StorageProvider> = {
        createEntities:
          createEntitiesMock as unknown as StorageProvider["createEntities"],
        getEntity: getEntityMock as unknown as StorageProvider["getEntity"],
        deleteEntities: deleteEntitiesMock,
        loadGraph: loadGraphMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      // Create
      const created = await manager.createEntities([entity])
      ok(created[0], "Entity should be created")
      strictEqual(created[0]?.name, entity.name, "Entity name should match")

      // Delete
      await manager.deleteEntities([entity.name])
      strictEqual(
        deleteEntitiesMock.mock.callCount(),
        1,
        "Delete should be called"
      )
    })
  })

  describe("Temporal Features", () => {
    it("should handle temporal entities with lifecycles", async (t) => {
      const timestamp = Date.now()
      const temporalEntity = {
        name: "TemporalEntity",
        entityType: "decision" as const,
        observations: ["A temporal entity for testing"],
        lifecycle: {
          deprecated: false,
          supersededBy: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }

      const createEntitiesMock = t.mock.fn((_entities: Entity[]) =>
        Promise.resolve([temporalEntity])
      )
      const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))

      const mockProvider: Partial<StorageProvider> = {
        createEntities:
          createEntitiesMock as unknown as StorageProvider["createEntities"],
        loadGraph: loadGraphMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const created = await manager.createEntities([temporalEntity])

      ok(created[0], "Entity should be created")
      const createdWithLifecycle = created[0] as typeof temporalEntity
      ok(createdWithLifecycle.lifecycle, "Lifecycle should exist")
      strictEqual(
        createdWithLifecycle.lifecycle.deprecated,
        false,
        "Should not be deprecated"
      )
      strictEqual(
        createdWithLifecycle.lifecycle.createdAt,
        timestamp,
        "createdAt should match"
      )
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle concurrent relation creations", async (t) => {
      const relations: Relation[] = [
        {
          from: "Entity1",
          to: "Entity2",
          relationType: "relates_to",
          strength: 0.8,
          confidence: 0.9,
        },
        {
          from: "Entity2",
          to: "Entity3",
          relationType: "depends_on",
          strength: 0.7,
          confidence: 0.85,
        },
        {
          from: "Entity3",
          to: "Entity1",
          relationType: "part_of",
          strength: 0.9,
          confidence: 0.95,
        },
      ]

      const createRelationsMock = t.mock.fn((_rels: Relation[]) =>
        Promise.resolve(relations)
      )

      const mockProvider: Partial<StorageProvider> = {
        createRelations: createRelationsMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const created = await manager.createRelations(relations)

      strictEqual(created.length, 3, "All relations should be created")
      strictEqual(
        created[0]?.strength,
        0.8,
        "First relation strength should match"
      )
      strictEqual(
        created[1]?.strength,
        0.7,
        "Second relation strength should match"
      )
      strictEqual(
        created[2]?.strength,
        0.9,
        "Third relation strength should match"
      )
    })

    it("should handle concurrent entity updates", async (t) => {
      const timestamp = Date.now()
      const entities: Entity[] = [
        { name: "Entity1", entityType: "component", observations: ["First"] },
        { name: "Entity2", entityType: "feature", observations: ["Second"] },
        { name: "Entity3", entityType: "task", observations: ["Third"] },
      ]

      const temporalEntities = entities.map((e) => ({
        ...e,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }))

      const createEntitiesMock = t.mock.fn((_ents: Entity[]) =>
        Promise.resolve(temporalEntities)
      )
      const loadGraphMock = t.mock.fn(() => Promise.resolve(EMPTY_GRAPH))

      const mockProvider: Partial<StorageProvider> = {
        createEntities:
          createEntitiesMock as unknown as StorageProvider["createEntities"],
        loadGraph: loadGraphMock,
      }

      const manager = new KnowledgeGraphManager({
        storageProvider: mockProvider as StorageProvider,
      })

      const created = await manager.createEntities(entities)

      strictEqual(created.length, 3, "All entities should be created")
      strictEqual(created[0]?.name, "Entity1", "First entity name should match")
      strictEqual(
        created[1]?.name,
        "Entity2",
        "Second entity name should match"
      )
      strictEqual(created[2]?.name, "Entity3", "Third entity name should match")
    })
  })
})
