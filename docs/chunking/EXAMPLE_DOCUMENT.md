# Example Structured Document

This document shows a complete example of the `StructuredDocument` schema in action.

## Complete Example: Authentication System Documentation

```json
{
  "@context": "https://schema.org/",
  "@type": "StructuredDocument",
  
  "metadata": {
    "documentId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Authentication System Architecture",
    "description": "Complete documentation of the JWT-based authentication system",
    "version": "1.0.0",
    "createdAt": 1710000000000,
    "author": "dev_team",
    "language": "en",
    "tags": ["authentication", "security", "architecture"]
  },
  
  "sections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "type": "section",
      "metadata": {
        "title": "Authentication Flow",
        "summary": "Overview of the authentication process from login to token validation",
        "entityType": "component",
        "tags": ["authentication", "jwt", "oauth"],
        "order": 1,
        "estimatedTokens": 1200
      },
      "subsections": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440010",
          "parentId": "550e8400-e29b-41d4-a716-446655440001",
          "type": "subsection",
          "metadata": {
            "title": "Login Process",
            "summary": "User submits credentials and receives JWT token",
            "tags": ["login", "credentials"],
            "order": 1,
            "estimatedTokens": 600
          },
          "content": [
            {
              "id": "550e8400-e29b-41d4-a716-446655440011",
              "parentId": "550e8400-e29b-41d4-a716-446655440010",
              "previousId": null,
              "nextId": "550e8400-e29b-41d4-a716-446655440012",
              "type": "text",
              "content": "The authentication process begins when a user submits their credentials (username and password) to the /auth/login endpoint. The system validates these credentials against the user database using bcrypt for password hashing comparison.",
              "metadata": {
                "language": "en",
                "tags": ["login", "validation"],
                "tokenCount": 52,
                "order": 1
              }
            },
            {
              "id": "550e8400-e29b-41d4-a716-446655440012",
              "parentId": "550e8400-e29b-41d4-a716-446655440010",
              "previousId": "550e8400-e29b-41d4-a716-446655440011",
              "nextId": "550e8400-e29b-41d4-a716-446655440013",
              "type": "code",
              "content": "async function login(username: string, password: string): Promise<AuthToken> {\n  const user = await db.users.findOne({ username });\n  if (!user) throw new UnauthorizedError();\n  \n  const valid = await bcrypt.compare(password, user.passwordHash);\n  if (!valid) throw new UnauthorizedError();\n  \n  return generateJWT(user.id);\n}",
              "metadata": {
                "language": "typescript",
                "tags": ["code", "implementation"],
                "tokenCount": 89,
                "order": 2
              }
            },
            {
              "id": "550e8400-e29b-41d4-a716-446655440013",
              "parentId": "550e8400-e29b-41d4-a716-446655440010",
              "previousId": "550e8400-e29b-41d4-a716-446655440012",
              "nextId": null,
              "type": "text",
              "content": "Upon successful validation, the system generates a JWT token containing the user's ID and role information. The token is signed using RS256 algorithm with a private key stored in environment variables. Token expiration is set to 24 hours by default.",
              "metadata": {
                "language": "en",
                "tags": ["jwt", "token-generation"],
                "tokenCount": 58,
                "order": 3
              }
            }
          ]
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440020",
          "parentId": "550e8400-e29b-41d4-a716-446655440001",
          "type": "subsection",
          "metadata": {
            "title": "Token Validation",
            "summary": "Middleware validates JWT tokens on protected routes",
            "tags": ["validation", "middleware"],
            "order": 2,
            "estimatedTokens": 600
          },
          "content": [
            {
              "id": "550e8400-e29b-41d4-a716-446655440021",
              "parentId": "550e8400-e29b-41d4-a716-446655440020",
              "previousId": null,
              "nextId": "550e8400-e29b-41d4-a716-446655440022",
              "type": "text",
              "content": "Protected API routes use authentication middleware that extracts the JWT token from the Authorization header. The middleware validates the token's signature using the public key, checks expiration, and verifies the token hasn't been revoked.",
              "metadata": {
                "language": "en",
                "tags": ["validation", "middleware"],
                "tokenCount": 51,
                "order": 1
              }
            },
            {
              "id": "550e8400-e29b-41d4-a716-446655440022",
              "parentId": "550e8400-e29b-41d4-a716-446655440020",
              "previousId": "550e8400-e29b-41d4-a716-446655440021",
              "nextId": null,
              "type": "code",
              "content": "async function validateToken(token: string): Promise<UserPayload> {\n  try {\n    const payload = jwt.verify(token, PUBLIC_KEY, {\n      algorithms: ['RS256']\n    });\n    \n    // Check revocation list\n    const revoked = await redis.get(`revoked:${payload.jti}`);\n    if (revoked) throw new UnauthorizedError('Token revoked');\n    \n    return payload as UserPayload;\n  } catch (error) {\n    throw new UnauthorizedError('Invalid token');\n  }\n}",
              "metadata": {
                "language": "typescript",
                "tags": ["code", "validation"],
                "tokenCount": 112,
                "order": 2
              }
            }
          ]
        }
      ]
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "type": "section",
      "metadata": {
        "title": "Security Considerations",
        "summary": "Security best practices and threat mitigation strategies",
        "entityType": "decision",
        "tags": ["security", "best-practices"],
        "order": 2,
        "estimatedTokens": 800
      },
      "content": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440030",
          "parentId": "550e8400-e29b-41d4-a716-446655440002",
          "previousId": null,
          "nextId": "550e8400-e29b-41d4-a716-446655440031",
          "type": "text",
          "content": "The authentication system implements several security measures to prevent common attacks. Rate limiting is enforced at 5 login attempts per minute per IP address to prevent brute force attacks. All passwords are hashed using bcrypt with a cost factor of 12.",
          "metadata": {
            "language": "en",
            "tags": ["security", "rate-limiting"],
            "tokenCount": 55,
            "order": 1
          }
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440031",
          "parentId": "550e8400-e29b-41d4-a716-446655440002",
          "previousId": "550e8400-e29b-41d4-a716-446655440030",
          "nextId": "550e8400-e29b-41d4-a716-446655440032",
          "type": "text",
          "content": "JWT tokens include a unique JTI (JWT ID) claim that enables token revocation. When a user logs out or changes their password, their tokens are added to a Redis-based revocation list checked during validation. Tokens expire after 24 hours regardless of revocation status.",
          "metadata": {
            "language": "en",
            "tags": ["security", "jwt", "revocation"],
            "tokenCount": 62,
            "order": 2
          }
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440032",
          "parentId": "550e8400-e29b-41d4-a716-446655440002",
          "previousId": "550e8400-e29b-41d4-a716-446655440031",
          "nextId": null,
          "type": "diagram",
          "content": "sequenceDiagram\n    User->>API: POST /auth/login\n    API->>DB: Validate credentials\n    DB-->>API: User found\n    API->>API: Generate JWT\n    API-->>User: Return token\n    User->>API: GET /protected (with token)\n    API->>Redis: Check revocation\n    Redis-->>API: Not revoked\n    API-->>User: Protected resource",
          "metadata": {
            "language": "mermaid",
            "tags": ["diagram", "sequence"],
            "tokenCount": 78,
            "order": 3
          }
        }
      ]
    }
  ],
  
  "crossReferences": [
    {
      "from": "550e8400-e29b-41d4-a716-446655440020",
      "to": "550e8400-e29b-41d4-a716-446655440010",
      "relationType": "depends_on",
      "description": "Token validation depends on the login process generating valid tokens"
    },
    {
      "from": "550e8400-e29b-41d4-a716-446655440002",
      "to": "550e8400-e29b-41d4-a716-446655440001",
      "relationType": "relates_to",
      "description": "Security considerations inform authentication flow design"
    }
  ]
}
```

## Key Features Demonstrated

### 1. Hierarchical Structure
- Document → Sections → Subsections → ContentBlocks
- Each level has clear parent-child relationships via `parentId`

### 2. Sequential Linking
- ContentBlocks have `previousId` and `nextId`
- Preserves reading order for context reconstruction

### 3. Mixed Content Types
- Text blocks: Natural language descriptions
- Code blocks: Implementation examples
- Diagram blocks: Visual representations

### 4. Token Awareness
- Each element has `estimatedTokens`
- Content blocks are kept under 512 tokens
- Sections stay under 8192 tokens (API limit)

### 5. Rich Metadata
- Semantic tags at every level
- Entity types for knowledge graph mapping
- Language specifications for specialized processing

### 6. Cross-References
- Explicit `depends_on` relationship between subsections
- `relates_to` relationship between sections
- These become graph relations automatically

## How This Maps to Knowledge Graph

### Entities Created

```typescript
// Section 1 → Entity
{
  name: "Authentication_Flow",
  entityType: "component",
  observations: [
    "Overview of the authentication process from login to token validation",
    "The authentication process begins when a user submits...",
    "async function login(username: string, password: string)...",
    "Upon successful validation, the system generates a JWT token...",
    "Protected API routes use authentication middleware...",
    "async function validateToken(token: string)..."
  ]
}

// Section 2 → Entity
{
  name: "Security_Considerations",
  entityType: "decision",
  observations: [
    "Security best practices and threat mitigation strategies",
    "The authentication system implements several security measures...",
    "JWT tokens include a unique JTI claim...",
    "sequenceDiagram..." // diagram content
  ]
}

// Subsection 1.1 → Entity (if substantial enough)
{
  name: "Login_Process",
  entityType: "component",
  observations: [
    "User submits credentials and receives JWT token",
    "The authentication process begins...",
    "async function login...",
    "Upon successful validation..."
  ]
}
```

### Relations Created

```typescript
// Hierarchical relations
{ from: "Login_Process", to: "Authentication_Flow", relationType: "part_of" }
{ from: "Token_Validation", to: "Authentication_Flow", relationType: "part_of" }

// Cross-references
{ from: "Token_Validation", to: "Login_Process", relationType: "depends_on" }
{ from: "Security_Considerations", to: "Authentication_Flow", relationType: "relates_to" }

// Sequential relations (optional)
{ from: "ContentBlock_011", to: "ContentBlock_012", relationType: "precedes" }
{ from: "ContentBlock_012", to: "ContentBlock_013", relationType: "precedes" }
```

## Processing Flow

1. **Validate**: Zod validates entire structure
2. **Extract Sections**: Process each section independently
3. **Create Entities**: Section metadata → Entity metadata
4. **Extract Observations**: ContentBlocks → Observations
5. **Batch Embed**: Send all content blocks in section to OpenAI once
6. **Create Relations**: Process cross-references + hierarchy
7. **Store**: Save entities + embeddings + relations to knowledge graph

## Benefits of This Format

✅ **No API Failures**: Token limits enforced before expensive operations
✅ **Optimal Chunks**: Each ContentBlock is perfect size for embeddings
✅ **Context Preserved**: Hierarchy + metadata enables context reconstruction
✅ **Flexible Size**: Unlimited document size via proper sectioning
✅ **Type Safe**: Full TypeScript support via Zod inference
✅ **LLM Friendly**: LLM generates this via structured output
✅ **Graph Ready**: Clean mapping to entity-relation model
