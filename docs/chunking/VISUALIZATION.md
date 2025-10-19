# Document Processing Visualization

Visual representations of how the structured document schema works.

## Document Structure Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│  StructuredDocument                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ metadata: {                                               │  │
│  │   documentId: "uuid"                                      │  │
│  │   title: "System Documentation"                           │  │
│  │   version: "1.0.0"                                        │  │
│  │   tags: ["api", "backend"]                                │  │
│  │ }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┤
│  │ Section (Maps to Entity)                  ≤8192 tokens     │
│  │ ┌─────────────────────────────────────────────────────────┐ │
│  │ │ metadata: {                                             │ │
│  │ │   title: "Authentication System"                        │ │
│  │ │   summary: "JWT-based auth"                             │ │
│  │ │   entityType: "component"                               │ │
│  │ │ }                                                       │ │
│  │ └─────────────────────────────────────────────────────────┘ │
│  │                                                             │
│  │  ┌──────────────────────────────────────────────────────┐  │
│  │  │ Subsection (Optional)             ≤4096 tokens       │  │
│  │  │ ┌────────────────────────────────────────────────────┤  │
│  │  │ │ metadata: {                                        │  │
│  │  │ │   title: "JWT Generation"                          │  │
│  │  │ │   summary: "Token creation process"                │  │
│  │  │ │ }                                                  │  │
│  │  │ └────────────────────────────────────────────────────┘  │
│  │  │                                                         │
│  │  │  ┌────────────────────────────────────────────────┐   │
│  │  │  │ ContentBlock (Embedding Unit)  ≤512 tokens     │   │
│  │  │  │ ┌──────────────────────────────────────────────┤   │
│  │  │  │ │ id: "uuid-1"                                 │   │
│  │  │  │ │ type: "text"                                 │   │
│  │  │  │ │ content: "The JWT generation process..."     │   │
│  │  │  │ │ metadata: { language: "en", order: 1 }       │   │
│  │  │  │ └──────────────────────────────────────────────┘   │
│  │  │  │                       ↓                             │
│  │  │  │                   [Embedding]                       │
│  │  │  └─────────────────────────────────────────────────┘   │
│  │  │                                                         │
│  │  │  ┌────────────────────────────────────────────────┐   │
│  │  │  │ ContentBlock                                   │   │
│  │  │  │ ┌──────────────────────────────────────────────┤   │
│  │  │  │ │ id: "uuid-2"                                 │   │
│  │  │  │ │ previousId: "uuid-1"                         │   │
│  │  │  │ │ type: "code"                                 │   │
│  │  │  │ │ content: "function generateJWT()..."         │   │
│  │  │  │ │ metadata: { language: "typescript" }         │   │
│  │  │  │ └──────────────────────────────────────────────┘   │
│  │  │  │                       ↓                             │
│  │  │  │                   [Embedding]                       │
│  │  │  └─────────────────────────────────────────────────┘   │
│  │  └──────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────┘
```

## Token Budget Flow

```
Document (Unlimited Size)
    │
    ├─ Section 1 ──────────────┐
    │   └─ Max 8,192 tokens    │ ← OpenAI API Limit
    │       │                   │
    │       ├─ Subsection 1.1   │
    │       │   └─ Max 4,096    │ ← Batch Unit
    │       │       │           │
    │       │       ├─ Block 1  │ ← 512 tokens (Optimal)
    │       │       ├─ Block 2  │ ← 512 tokens
    │       │       └─ Block 3  │ ← 512 tokens
    │       │                   │
    │       └─ Subsection 1.2   │
    │           └─ Max 4,096    │
    │               │           │
    │               ├─ Block 4  │ ← 512 tokens
    │               └─ Block 5  │ ← 512 tokens
    │                           │
    ├─ Section 2 ──────────────┤
    │   └─ Max 8,192 tokens    │
    │                           │
    └─ Section N ──────────────┘
```

## Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. INPUT                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  User provides raw text or pre-structured JSON           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LLM converts to StructuredDocument (if needed)           │  │
│  │  Using responseSchema (Zod → JSON Schema)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
├─────────────────────────────────────────────────────────────────┤
│  2. VALIDATION                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Zod validates structure and token limits                 │  │
│  │  ✅ Pass → Continue                                        │  │
│  │  ❌ Fail → Return error to LLM for correction             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
├─────────────────────────────────────────────────────────────────┤
│  3. SECTION PROCESSING (Per Section)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Extract all ContentBlocks from Section                   │  │
│  │  │                                                         │  │
│  │  ├─ Block 1: "JWT tokens are..."                          │  │
│  │  ├─ Block 2: "function generateJWT()..."                  │  │
│  │  └─ Block 3: "Token validation..."                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Batch Embedding (Single API Call)                        │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ POST https://api.openai.com/v1/embeddings          │  │  │
│  │  │ {                                                   │  │  │
│  │  │   model: "text-embedding-3-small",                 │  │  │
│  │  │   input: [                                         │  │  │
│  │  │     "JWT tokens are...",                           │  │  │
│  │  │     "function generateJWT()...",                   │  │  │
│  │  │     "Token validation..."                          │  │  │
│  │  │   ]                                                │  │  │
│  │  │ }                                                   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Create Entity                                            │  │
│  │  {                                                        │  │
│  │    name: "Authentication_System",                         │  │
│  │    entityType: "component",                               │  │
│  │    observations: [                                        │  │
│  │      "JWT-based authentication",    // section summary    │  │
│  │      "JWT tokens are...",           // block 1           │  │
│  │      "function generateJWT()...",   // block 2           │  │
│  │      "Token validation..."          // block 3           │  │
│  │    ]                                                      │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
├─────────────────────────────────────────────────────────────────┤
│  4. RELATION CREATION                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Create hierarchical relations                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Subsection → Section: "part_of"                     │  │  │
│  │  │ Section A → Section B: "depends_on" (cross-ref)     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            ↓                                     │
├─────────────────────────────────────────────────────────────────┤
│  5. STORAGE                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SQLite Database                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ entities table                                      │  │  │
│  │  │  - name, type, observations[]                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ embeddings table (sqlite-vec)                       │  │  │
│  │  │  - entity_name, observation_index, vector           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ relations table                                     │  │  │
│  │  │  - from, to, type, metadata                         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Retrieval Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER QUERY: "How does JWT token generation work?"              │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. QUERY EMBEDDING                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Generate embedding for query                             │  │
│  │  query_vector = embed("How does JWT token generation...")  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. VECTOR SEARCH                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Find top-K similar embeddings                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Match 1: "function generateJWT()..." (0.89 sim)     │  │  │
│  │  │  └─ Entity: Authentication_System                   │  │  │
│  │  │  └─ Block ID: uuid-2                                │  │  │
│  │  │                                                      │  │  │
│  │  │ Match 2: "JWT tokens are signed..." (0.85 sim)      │  │  │
│  │  │  └─ Entity: Authentication_System                   │  │  │
│  │  │  └─ Block ID: uuid-1                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. CONTEXT RECONSTRUCTION                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  For each match, retrieve full context                    │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Block uuid-2 (matched content)                      │  │  │
│  │  │   ↓                                                 │  │  │
│  │  │ Subsection: "JWT Generation" (parent)               │  │  │
│  │  │   ↓                                                 │  │  │
│  │  │ Section: "Authentication System" (grandparent)      │  │  │
│  │  │                                                     │  │  │
│  │  │ Context Path: "Authentication System > JWT         │  │  │
│  │  │                Generation > [Matched Content]"      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. RESPONSE GENERATION                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Send to LLM with context                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ System: "Answer using this context:"               │  │  │
│  │  │                                                     │  │  │
│  │  │ Context from Authentication System > JWT Generation:│  │  │
│  │  │ "function generateJWT(userId) {                    │  │  │
│  │  │    const payload = { id: userId, ... };            │  │  │
│  │  │    return jwt.sign(payload, PRIVATE_KEY, {         │  │  │
│  │  │      algorithm: 'RS256',                           │  │  │
│  │  │      expiresIn: '24h'                              │  │  │
│  │  │    });                                             │  │  │
│  │  │  }"                                                 │  │  │
│  │  │                                                     │  │  │
│  │  │ User: "How does JWT token generation work?"        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Linking Structure

```
Document "System Documentation"
    │
    ├─ Section "Authentication"
    │    │   (id: sec-1)
    │    │
    │    ├─ Subsection "JWT Generation"
    │    │    │   (id: subsec-1, parentId: sec-1)
    │    │    │
    │    │    ├─ Block "JWT tokens..."
    │    │    │    (id: block-1, parentId: subsec-1, previousId: null, nextId: block-2)
    │    │    │
    │    │    ├─ Block "function generateJWT()..."
    │    │    │    (id: block-2, parentId: subsec-1, previousId: block-1, nextId: block-3)
    │    │    │
    │    │    └─ Block "Token validation..."
    │    │         (id: block-3, parentId: subsec-1, previousId: block-2, nextId: null)
    │    │
    │    └─ Subsection "OAuth Integration"
    │         │   (id: subsec-2, parentId: sec-1)
    │         └─ ...
    │
    └─ Section "Database"
         │   (id: sec-2)
         └─ ...

CrossReferences:
    ├─ from: subsec-2, to: subsec-1, type: "depends_on"
    └─ from: sec-2, to: sec-1, type: "relates_to"
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM generates StructuredDocument                                │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
                     ┌───────────────────────┐
                     │  Zod Validation       │
                     └───────────┬───────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
           ✅ Valid                          ❌ Invalid
                │                                 │
                ↓                                 ↓
    ┌──────────────────────┐        ┌──────────────────────────┐
    │  Process Document    │        │  Parse Error Details     │
    │                      │        │  ┌────────────────────┐  │
    │  ├─ Extract Sections │        │  │ Field: sections[0] │  │
    │  ├─ Batch Embed      │        │  │ .content[2]        │  │
    │  ├─ Create Entities  │        │  │ .content           │  │
    │  ├─ Create Relations │        │  │                    │  │
    │  └─ Store in DB      │        │  │ Error: "Content    │  │
    │                      │        │  │ exceeds 2048 chars"│  │
    └──────────┬───────────┘        │  └────────────────────┘  │
               │                    └────────────┬──────────────┘
               ↓                                 ↓
    ┌──────────────────────┐        ┌──────────────────────────┐
    │  Success Response    │        │  Return Error to LLM     │
    │  {                   │        │  for Self-Correction     │
    │    status: "success",│        │  ┌────────────────────┐  │
    │    entitiesCreated,  │        │  │ "Please shorten    │  │
    │    relationsCreated  │        │  │ the content at     │  │
    │  }                   │        │  │ sections[0]..."    │  │
    └──────────────────────┘        │  └────────────────────┘  │
                                    └────────────┬──────────────┘
                                                 │
                                                 ↓
                                    ┌──────────────────────────┐
                                    │  LLM Regenerates         │
                                    │  (with corrections)      │
                                    └────────────┬─────────────┘
                                                 │
                                                 └─────────┐
                                                           ↓
                                              (Back to Validation)
```

## Batch Processing Efficiency

```
Traditional Approach (Inefficient):
┌─────────────────────────────────────────────────────────────────┐
│  Raw Text (50 pages)                                             │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
                      ┌──────────────────────┐
                      │  Naive Splitting     │ ← Complex algorithm
                      └──────────┬───────────┘
                                 ↓
                        20 chunks (unknown size)
                                 ↓
        ┌────────────────────────┴────────────────────────┐
        │                                                  │
    API Call 1                                         API Call 20
        │                                                  │
        └────────────────────────┬────────────────────────┘
                                 ↓
                         Many API calls
                         High latency
                         Higher cost


Our Approach (Efficient):
┌─────────────────────────────────────────────────────────────────┐
│  StructuredDocument                                              │
│  (Pre-chunked by LLM into optimal 512-token blocks)             │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
              ┌──────────────────────────────────┐
              │  Validation (instant)            │ ← Zod check
              └──────────────┬───────────────────┘
                             ↓
              ┌──────────────────────────────────┐
              │  Section 1: 10 blocks            │
              └──────────────┬───────────────────┘
                             ↓
              ┌──────────────────────────────────┐
              │  Batch API Call                  │ ← Single call
              │  (all 10 blocks at once)         │
              └──────────────┬───────────────────┘
                             ↓
              ┌──────────────────────────────────┐
              │  Section 2: 8 blocks             │
              └──────────────┬───────────────────┘
                             ↓
              ┌──────────────────────────────────┐
              │  Batch API Call                  │ ← Single call
              │  (all 8 blocks at once)          │
              └──────────────────────────────────┘
                             
                         2-3 API calls
                         Low latency
                         Lower cost
```
