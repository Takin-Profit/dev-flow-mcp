import type { EntityEmbedding } from "#types/entity-embedding.ts"
import { EntityType } from "#types/arktype.ts"

// We are storing our memory using entities, relations, and observations in a graph structure
export interface Entity {
  name: string
  entityType: EntityType
  observations: string[]
  embedding?: EntityEmbedding
}
