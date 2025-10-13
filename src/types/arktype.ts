import { type } from "arktype"

export const EntityType = type("'feature' | 'task' | 'decision' | 'component'")

export const RelationType = type(
  "'implements' | 'depends_on' | 'relates_to' | 'part_of'"
)

/**
 * TemporalEntity represents an entity with temporal versioning metadata
 * Used by storage providers to track entity history and changes over time
 */
export const TemporalEntity = type({
  id: "string",
  name: "string",
  entityType: EntityType.infer,
  observations: "string[]",
  version: "number",
  createdAt: "number",
  updatedAt: "number",
  validFrom: "number",
  "validTo?": "number | null",
  "changedBy?": "string | null",
  "embedding?": {
    vector: "number[]",
    model: "string",
    lastUpdated: "number"
  }
})

export type TemporalEntity = typeof TemporalEntity.infer
