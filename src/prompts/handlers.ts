/**
 * Prompt Handlers for DevFlow MCP
 *
 * These prompts help AI agents work with the knowledge graph in a
 * cascading workflow: planner → task creator → coder → reviewer
 *
 * Each prompt provides context-aware guidance on how to store and
 * retrieve information at different stages of development.
 */

import type {
  GetContextArgs,
  InitProjectArgs,
  RememberWorkArgs,
  ReviewContextArgs,
} from "#prompts/schemas"
import type { PromptResult } from "#prompts/types"

/**
 * init-project: Helps agents start a new project or feature
 *
 * This prompt guides planners on how to create initial feature entities
 * and structure their planning information in the knowledge graph.
 */
export function handleInitProject(args: InitProjectArgs): PromptResult {
  const { projectName, description, goals } = args

  const guidanceText = `# Starting New Project: ${projectName}

## What You Should Do

1. **Create a Feature Entity** for this project:
   - Use tool: \`create_entities\`
   - Set \`entityType\` to "feature"
   - Set \`name\` to "${projectName}"
   - Add observation with: ${description}${goals ? `\n   - Add observation with goals: ${goals}` : ""}

2. **Document Key Decisions** early:
   - Create "decision" entities for architectural choices
   - Link them to the feature using \`create_relations\` with type "relates_to"

3. **Plan Tasks** (if you're the planner):
   - Create "task" entities for work items
   - Link them to the feature using "part_of" relations
   - Be specific: each task should be implementable by a developer

## Example Usage

\`\`\`
{
  "name": "create_entities",
  "arguments": {
    "entities": [
      {
        "name": "${projectName}",
        "entityType": "feature",
        "observations": [
          "${description}"${goals ? `,\n          "${goals}"` : ""}
        ]
      }
    ]
  }
}
\`\`\`

## What Gets Stored

- **Feature entity**: Represents the high-level project/feature
- **Observations**: Your description and goals
- **Semantic embedding**: Allows future agents to find this via semantic search

## Next Steps

After creating the feature:
1. Break it down into tasks (use "task" entities)
2. Document any early decisions (use "decision" entities)
3. Create relations to show task hierarchy (use "part_of" relation type)

The next agent can use the \`get-context\` prompt to retrieve this information before starting work.`

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: guidanceText,
        },
      },
    ],
  }
}

/**
 * get-context: Helps agents retrieve relevant information before working
 *
 * This prompt guides any agent on how to search the knowledge graph
 * for relevant history, dependencies, and context before starting their work.
 */
export function handleGetContext(args: GetContextArgs): PromptResult {
  const { query, entityTypes, includeHistory } = args

  const entityTypesList = entityTypes?.join(", ") || "all types"

  const guidanceText = `# Getting Context: ${query}

## What You Should Do

1. **Semantic Search** for relevant entities:
   - Use tool: \`semantic_search\`
   - Query: "${query}"
   - Filter by: ${entityTypesList}
   - This finds entities semantically related to your work

2. **Check Dependencies**:
   - Use tool: \`get_relations\` to find what depends on what
   - Look for "depends_on" and "implements" relations
   - This shows you what code/tasks are connected

3. **Review Related Decisions**${entityTypes?.includes("decision") ? "" : ':\n   - Search for entities with type "decision"\n   - These explain why things were built a certain way'}

${
  includeHistory
    ? `4. **Check Version History**:
   - Use tool: \`get_entity_history\`
   - See what changed and why
   - Understand the evolution of the codebase
`
    : ""
}

## Example Search

\`\`\`
{
  "name": "semantic_search",
  "arguments": {
    "query": "${query}",
    ${entityTypes ? `"entity_types": [${entityTypes.map((t) => `"${t}"`).join(", ")}],` : ""}
    "limit": 10,
    "min_similarity": 0.7
  }
}
\`\`\`

## What You'll Find

- **Feature entities**: High-level goals and requirements
- **Task entities**: Specific work items to implement
- **Component entities**: Existing code/modules
- **Decision entities**: Why things were done a certain way
- **Test entities**: Test coverage and requirements

## How to Use the Results

1. **Read the observations** - They contain the actual content
2. **Follow the relations** - They show connections and dependencies
3. **Check timestamps** - See what's recent vs historical${includeHistory ? "\n4. **Review version history** - Understand changes over time" : ""}

## Next Steps

After gathering context:
- If you're implementing: Use \`remember-work\` to store your work
- If you're reviewing: Use \`review-context\` to get full review context
- If you're planning: Use \`init-project\` to start a new feature

The knowledge graph preserves context across the entire development workflow.`

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: guidanceText,
        },
      },
    ],
  }
}

/**
 * remember-work: Helps agents store their work in the knowledge graph
 *
 * This prompt guides any agent on how to save their completed work
 * with appropriate entity types and relations.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: refactor later
export function handleRememberWork(args: RememberWorkArgs): PromptResult {
  const {
    workType,
    name,
    description,
    implementsTask,
    partOfFeature,
    dependsOn,
    keyDecisions,
  } = args

  const relationsText =
    implementsTask || partOfFeature || dependsOn
      ? `

## Relations to Create

${implementsTask ? `- **Implements Task**: Link "${name}" to task "${implementsTask}" (type: "implements")` : ""}
${partOfFeature ? `- **Part of Feature**: Link "${name}" to feature "${partOfFeature}" (type: "part_of")` : ""}
${dependsOn ? `- **Dependencies**: Link "${name}" to:\n${dependsOn.map((dep) => `  - "${dep}" (type: "depends_on")`).join("\n")}` : ""}`
      : ""

  const decisionsText = keyDecisions
    ? `

## Key Decisions to Document

Create a separate "decision" entity:
\`\`\`
{
  "name": "create_entities",
  "arguments": {
    "entities": [
      {
        "name": "${name}-design-decisions",
        "entityType": "decision",
        "observations": ["${keyDecisions}"]
      }
    ]
  }
}
\`\`\`

Then link it to your work using \`create_relations\` with type "relates_to".`
    : ""

  const guidanceText = `# Remembering Work: ${name}

## What You Should Do

1. **Create Entity** for your work:
   - Use tool: \`create_entities\`
   - Set \`entityType\` to "${workType}"
   - Set \`name\` to "${name}"
   - Add observation: ${description}

2. **Create Relations** to show connections:
   - Use tool: \`create_relations\`
   - Link to related entities (tasks, features, dependencies)
${relationsText}${decisionsText}

## Example Entity Creation

\`\`\`
{
  "name": "create_entities",
  "arguments": {
    "entities": [
      {
        "name": "${name}",
        "entityType": "${workType}",
        "observations": [
          "${description}"
        ]
      }
    ]
  }
}
\`\`\`

${
  relationsText || decisionsText
    ? `## Example Relations Creation

\`\`\`
{
  "name": "create_relations",
  "arguments": {
    "relations": [${
      implementsTask
        ? `
      {
        "from": "${name}",
        "to": "${implementsTask}",
        "relationType": "implements"
      }`
        : ""
    }${
      partOfFeature
        ? `${implementsTask ? "," : ""}
      {
        "from": "${name}",
        "to": "${partOfFeature}",
        "relationType": "part_of"
      }`
        : ""
    }${
      dependsOn
        ? `${implementsTask || partOfFeature ? "," : ""}
      ${dependsOn
        .map(
          (dep, i) => `${i > 0 ? "," : ""}{
        "from": "${name}",
        "to": "${dep}",
        "relationType": "depends_on"
      }`
        )
        .join("")}`
        : ""
    }
    ]
  }
}
\`\`\`
`
    : ""
}

## What Gets Stored

- **${workType} entity**: Your completed work
- **Observations**: Description of what you did
- **Relations**: Connections to tasks, features, dependencies
- **Semantic embedding**: Allows future search/retrieval${keyDecisions ? "\n- **Decision entity**: Important design choices" : ""}

## Why This Matters

This structured information allows:
1. **Reviewers** to understand your work in context
2. **Future developers** to find relevant code via semantic search
3. **Project managers** to track progress against tasks
4. **AI agents** to maintain context across the development workflow

The knowledge graph becomes a living memory of your development process.`

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: guidanceText,
        },
      },
    ],
  }
}

/**
 * review-context: Helps reviewers get full context before reviewing
 *
 * This prompt guides review agents on how to gather all relevant
 * information about a piece of work before providing feedback.
 */
export function handleReviewContext(args: ReviewContextArgs): PromptResult {
  const { entityName, includeRelated, includeDecisions } = args

  const guidanceText = `# Review Context: ${entityName}

## What You Should Do

1. **Get the Entity** you're reviewing:
   - Use tool: \`search_nodes\`
   - Search for: "${entityName}"
   - Read all observations to understand what was done

2. **Find Related Work**:
   - Use tool: \`get_relations\`
   - Entity: "${entityName}"
   - This shows what it implements, depends on, or is part of${
     includeRelated
       ? `

   **Check Related Entities**:
   - Get entities this implements (find "implements" relations)
   - Get entities this depends on (find "depends_on" relations)  
   - Get the feature it's part of (find "part_of" relations)
   - Read their observations for context`
       : ""
   }${
     includeDecisions
       ? `

3. **Review Design Decisions**:
   - Search for "decision" entities related to "${entityName}"
   - Use \`semantic_search\` with query about the work
   - Filter by \`entity_types: ["decision"]\`
   - Understand WHY things were built this way`
       : ""
   }

4. **Check for Tests**:
   - Search for "test" entities
   - Look for tests related to "${entityName}"
   - Verify test coverage

## Example: Get Entity and Relations

\`\`\`
// First, get the entity
{
  "name": "search_nodes",
  "arguments": {
    "query": "${entityName}"
  }
}

// Then, get its relations
{
  "name": "get_relations",
  "arguments": {
    "entityName": "${entityName}"
  }
}
\`\`\`${
    includeDecisions
      ? `

## Example: Find Related Decisions

\`\`\`
{
  "name": "semantic_search",
  "arguments": {
    "query": "${entityName} design decisions architecture",
    "entity_types": ["decision"],
    "limit": 5
  }
}
\`\`\``
      : ""
  }

## What to Review

### Code Quality
- Does the implementation match the task requirements?
- Are there any obvious bugs or issues?
- Is the code maintainable and well-structured?

### Design Decisions
- Do the decisions make sense given the context?
- Are there better alternatives?
- Are trade-offs clearly documented?

### Test Coverage
- Are there tests for this work?
- Do tests cover edge cases?
- Are tests meaningful and maintainable?

### Documentation
- Are observations clear and complete?
- Are relations properly set up?
- Would future developers understand this?

## After Review

1. **Add Observations** with your feedback:
   - Use tool: \`add_observations\`
   - Entity: "${entityName}"
   - Add your review comments

2. **Create Test Entities** if missing:
   - Document test requirements
   - Link to the component being tested

3. **Update Relations** if needed:
   - Fix incorrect connections
   - Add missing dependencies

## Example: Add Review Feedback

\`\`\`
{
  "name": "add_observations",
  "arguments": {
    "observations": [
      {
        "entityName": "${entityName}",
        "contents": [
          "Code review: Looks good overall",
          "Suggestion: Consider adding error handling for edge case X",
          "Test coverage: Adequate, but could add integration test"
        ]
      }
    ]
  }
}
\`\`\`

## Why Full Context Matters

A good review requires understanding:
- **What** was built (the entity itself)
- **Why** it was built (related tasks and features)
- **How** it fits (dependencies and implementations)
- **Design reasoning** (decision entities)${includeRelated ? "\n- **The bigger picture** (related components)" : ""}

The knowledge graph provides all this context in a structured, queryable way.`

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: guidanceText,
        },
      },
    ],
  }
}
