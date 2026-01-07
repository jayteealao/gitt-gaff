# Architecture Decisions

This document explains the key architectural decisions made in building Gitt-Gaff.

## Table of Contents

1. [DAG Traversal Algorithm](#dag-traversal-algorithm)
2. [Lane Assignment Algorithm](#lane-assignment-algorithm)
3. [Token Handling & Authentication](#token-handling--authentication)
4. [Caching Strategy](#caching-strategy)
5. [Technology Choices](#technology-choices)
6. [Limitations & Trade-offs](#limitations--trade-offs)

---

## DAG Traversal Algorithm

### Problem

Fetching commit history for a repository with multiple branches efficiently without:
- Downloading redundant commits (commits that appear in multiple branches)
- Making excessive API calls
- Loading the entire repository history at once

### Solution: Multi-Head Traversal with Deduplication

Our algorithm:

1. **Start from branch heads**: Begin with all branch tip commits
2. **Fetch limited history per branch**: Request only the first N commits from each branch (default: 10)
3. **Deduplicate by OID**: Merge commits from all branches, using commit OID as the unique key
4. **Track branch membership**: Each commit maintains a list of branches it belongs to
5. **Sort by date**: Display commits in chronological order (newest first)
6. **Lazy load more**: Track "frontier" (unexplored parent commits) for pagination

### Code Reference

See `lib/github/dag-traversal.ts`:
- `fetchCommitGraph()`: Main entry point
- `fetchMoreCommits()`: Pagination
- `propagateBranchAssociations()`: Determines branch membership via graph traversal

### Example

For a repository with 3 branches (main, feature-1, feature-2) that diverged from a common ancestor:

```
main:      A - B - C - D - E
feature-1:  \- F - G
feature-2:  \- H - I - J
```

**Traditional approach (inefficient)**:
- Fetch 10 commits from main: [E, D, C, B, A, ...]
- Fetch 10 commits from feature-1: [G, F, A, ...] ← duplicate A
- Fetch 10 commits from feature-2: [J, I, H, A, ...] ← duplicate A
- Total: ~30 commits fetched, many duplicates

**Our approach (efficient)**:
- Fetch from all heads in parallel
- Deduplicate by OID: {E, D, C, B, A, F, G, H, I, J}
- Total: 10 unique commits, sorted by date

### Trade-offs

**Pros**:
- Minimal API calls
- No redundant data transfer
- Scales well with many branches
- Fast initial load

**Cons**:
- Complex branch membership tracking
- Requires careful handling of pagination state
- More complex than simple "fetch entire history"

---

## Lane Assignment Algorithm

### Problem

Assign horizontal positions (lanes) to commits in a git graph such that:
- Parent-child relationships are visually clear
- Lanes are reused to keep the graph compact
- Assignment is deterministic (stable across page loads)
- Handles complex scenarios (merges, octopus merges, criss-cross merges)

### Solution: Incremental Lane Assignment with Coloring

**Algorithm** (see `lib/graph/lane-assignment.ts`):

1. **For each commit** (in chronological order, newest first):
   a. Check if lane already assigned (from previous page load)
   b. If not:
      - Head commits get a new lane
      - Non-head commits try to continue in a parent's lane
      - If no parent lane exists, allocate a new lane
   c. Assign color from palette (9 colors, cycling)

2. **For parents**:
   a. First parent continues in same lane (merge target)
   b. Additional parents get new lanes (merge sources)

3. **Lane reuse**:
   - Track active lanes (currently "in use")
   - Reuse freed lanes before allocating new ones
   - Keeps graph width <= 13 lanes (horizontal constraint)

### Example

```
main:      A - B - M (merges feature)
feature:        \- C - D -/
```

**Lane assignment**:
- M: lane 0, color blue
- C: lane 0 (continues from M's parent B), color blue
- D: lane 1 (merge source), color red
- B: lane 0, color blue
- A: lane 0, color blue

**Visual result**:
```
Lane 0: M --- B --- A
Lane 1:   D - C ---/
```

### Index Array

The `calculateIndexArray()` function builds a 2D array where:
- `indexArray[i][j]` = the lane index occupying position j on row i

This allows efficient rendering of lane continuity lines (lines that span multiple commits).

### Trade-offs

**Pros**:
- Deterministic (same graph every time)
- Handles complex merge patterns
- Compact graph (lane reuse)
- Stateful pagination (preserves lanes across "load more")

**Cons**:
- More complex than naive "branch = lane" approach
- Requires maintaining lane state
- Max width constraint can cause visual crowding with many branches

---

## Token Handling & Authentication

### Problem

GitHub API requires authentication for:
- Private repositories
- Higher rate limits
- Accessing user-specific data

But we must:
- Never expose tokens in URLs, logs, or client-side storage
- Support both OAuth and Personal Access Tokens
- Explain why OAuth requires broad `repo` scope

### Solution: Multi-Mode Authentication

#### Mode 1: Server-Side PAT (Public Repos)

- Store a server-side GitHub PAT in `GITHUB_SERVER_PAT` env var
- Use for all unauthenticated requests to public repos
- Never expose to client

#### Mode 2: OAuth (Private Repos)

- **Flow**: Authorization Code with PKCE (Proof Key for Code Exchange)
- **Why PKCE?** More secure for public clients (no client secret on client side)
- **Scope**: `repo` (full access) - GitHub limitation, no read-only scope exists
- **Token storage**: Server-side encrypted session, httpOnly cookie
- **Never** stored in localStorage or sessionStorage

#### Mode 3: User-Supplied PAT

- Allow users to paste their own fine-grained PAT
- Stored in session (not persisted)
- Useful for org-owned repos where OAuth may be restricted
- Clearly explain security considerations in UI

### Code Reference

- `app/api/github/graph/route.ts`: Token extraction from request
- TODO: OAuth routes (`app/api/auth/login`, `app/api/auth/callback`)
- TODO: Session management with encrypted cookies

### Trade-offs

**Pros**:
- Secure token handling
- Supports multiple auth methods
- Transparent about scope limitations

**Cons**:
- OAuth `repo` scope is broader than ideal (GitHub API limitation)
- Users may need to create PAT for org repos
- More complex than simple API key

---

## Caching Strategy

### Current Implementation

**Status**: Planned, not yet implemented

### Planned Approach

#### 1. In-Memory Cache (Server-Side)

- Cache commit graph data keyed by `{owner, repo, branch, viewer}`
- TTL: 5 minutes for frequently accessed repos
- Eviction: LRU (Least Recently Used)
- Invalidation: Time-based only (no webhook support)

#### 2. HTTP Caching Headers

- Set `Cache-Control: private, max-age=300` for authenticated requests
- Set `Cache-Control: public, max-age=600` for public repo requests
- Use `ETag` based on commit graph hash
- Support `If-None-Match` for 304 responses

#### 3. GitHub API Rate Limiting

- Track rate limit from GraphQL responses
- Return rate limit info to client (for UI display)
- Implement exponential backoff on secondary rate limits
- Warn users when approaching limit

### Trade-offs

**Pros**:
- Reduces API calls
- Faster response times
- Lower rate limit consumption

**Cons**:
- Stale data (5-10 minute lag)
- Memory usage (cache storage)
- No real-time updates

---

## Technology Choices

### Why Next.js?

- **Server-side API routes**: Secure token handling, no CORS issues
- **App Router**: Modern routing with catch-all routes
- **TypeScript**: Type safety for complex data structures
- **Vercel deployment**: Zero-config deployment
- **React Server Components**: Efficient data fetching

### Why SVG over Canvas?

- **Accessibility**: SVG is DOM-based, screen-reader friendly
- **Interaction**: Easy click/hover handling with standard DOM events
- **Styling**: CSS-based styling, easier than Canvas
- **Resolution**: Vector-based, scales cleanly
- **Trade-off**: Canvas would be faster for very large graphs (1000+ commits)

### Why GraphQL over REST?

- **Efficiency**: Fetch exactly what we need in one request
- **Batching**: Query multiple branches in a single request
- **Pagination**: Cursor-based pagination built-in
- **Rate limiting**: More generous limits than REST API

### Why Tailwind CSS?

- **Utility-first**: Rapid prototyping
- **Dark mode**: Built-in support
- **Consistency**: Design system out of the box
- **Performance**: Purges unused styles

---

## Limitations & Trade-offs

### Current Limitations

1. **No OAuth Implementation Yet**
   - Currently relies on server-side PAT for public repos
   - Private repo support requires manual PAT

2. **No Caching**
   - Every page load fetches fresh data
   - Can hit rate limits on frequently accessed repos

3. **No Branch Filtering**
   - Shows all branches (can be overwhelming for large repos)
   - Planned: dropdown to filter to specific branch

4. **No Infinite Scroll**
   - Shows first 35 commits only
   - Planned: "Load more" button

5. **No Offline Support**
   - Requires live GitHub API access
   - No service worker/PWA features

6. **No Commit Search**
   - Can't search commits by message, SHA, author
   - Planned: client-side filtering

### Architectural Constraints

1. **GitHub API Rate Limits**
   - 5000 requests/hour (authenticated)
   - 60 requests/hour (unauthenticated)
   - Mitigated by: caching (planned), efficient queries

2. **GraphQL Query Complexity**
   - GitHub enforces query cost limits
   - Our queries are optimized to stay under limits
   - Batch fetching helps

3. **Client-Side Rendering Performance**
   - SVG can be slow for very large graphs (>500 commits)
   - Mitigated by: pagination, limited initial load

4. **GitHub Scope Limitations**
   - No read-only `repo` scope exists
   - OAuth requests full access
   - Mitigated by: clear UI explanation, PAT alternative

### Future Improvements

1. **WebSocket Real-Time Updates**
   - Show new commits as they're pushed
   - Requires webhook infrastructure

2. **Graph Virtualization**
   - Render only visible portion of graph
   - Would support thousands of commits

3. **Collaborative Features**
   - Comment on commits
   - Share specific graph views
   - Requires database

4. **Advanced Filtering**
   - Filter by author, date range, file path
   - Requires additional GraphQL queries

5. **Export**
   - Download graph as SVG/PNG
   - Generate shareable links

---

## Conclusion

Gitt-Gaff's architecture prioritizes:

1. **Security**: Tokens never exposed client-side
2. **Performance**: Efficient DAG traversal, minimal API calls
3. **Simplicity**: Clear code structure, easy to understand
4. **Extensibility**: Modular design, easy to add features

The key innovation is the **multi-head DAG traversal** algorithm, which efficiently handles repositories with many branches without redundant data fetching.

For questions or suggestions, see [Contributing Guide](./CONTRIBUTING.md).
