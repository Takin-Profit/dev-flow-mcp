import { type } from "arktype"

export const EntityType = type("'feature' | 'task' | 'decision' | 'component'")

export const RelationType = type(
  "'implements' | 'depends_on' | 'relates_to' | 'part_of'"
)
