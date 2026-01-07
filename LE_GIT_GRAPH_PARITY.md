# Le Git Graph Parity Checklist

This document outlines the features and behaviors to replicate from [Le Git Graph](https://github.com/NirmalScaria/le-git-graph) (MIT licensed) for our standalone web app.

## Attribution
Le Git Graph is an open-source browser extension by Nirmal Scaria, licensed under MIT. We're building a standalone web app inspired by its UX and technical approach, with significant modifications for our use case.

## Core Features to Replicate

### 1. Visual Git Graph ✅
- [ ] SVG-based commit graph with nodes and edges
- [ ] Commits displayed as colored dots
- [ ] Parent relationships shown as curved lines
- [ ] Merge commits clearly visible with multiple parent connections
- [ ] Branch heads indicated with outline circles
- [ ] "Lanes" system for organizing branches horizontally
- [ ] Maximum ~13 lanes visible (horizontal space constraint)
- [ ] Dotted lines when parents aren't shown (pagination boundary)

### 2. Lane Assignment Algorithm ✅
**Le Git Graph approach** (to replicate):
- Uses 2D `indexArray[i][j]` where i = commit row, j = horizontal position
- For each "line index" (lane), finds the range of commits it spans
- Assigns colors from a palette of 9 colors, rotating when exhausted
- Each commit gets a `lineIndex` that persists to its first parent
- Merge commits: first parent continues lane, other parents get new lanes

**Improvements we're making**:
- More robust lane reuse algorithm
- Handle octopus merges (>2 parents)
- Stable lane assignment during incremental loading

### 3. Commit Data Fetching ✅
**Le Git Graph approach**:
- Fetches first 10 commits from each branch (GraphQL)
- Two-phase fetching:
  1. Lightweight fetch: OID, message headline, committed date (for sorting)
  2. Detail fetch: parents, additions, deletions, author, avatar (for display)
- Batches branch fetching (100 branches per GraphQL query)
- Pagination: loads more commits on demand

**Our approach** (improved):
- Multi-head DAG traversal from branch tips
- Single-phase fetch with all necessary data
- More efficient pagination with cursor-based continuation
- Server-side caching by repo + viewer

### 4. Commit Sorting ✅
- [ ] Sort all commits by `committedDate` (newest first)
- [ ] Deduplicate commits across branches
- [ ] Track which branches each commit belongs to
- [ ] Display first 10-35 commits initially (configurable)

### 5. Commit List UI ✅
- [ ] Short SHA (7 chars) with copy functionality
- [ ] Commit message headline (HTML formatted, clickable link to GitHub)
- [ ] Author avatar and username (with hover card link)
- [ ] Relative time ("2 hours ago", "3 days ago", etc.)
- [ ] Commit status indicators (success/failure if available)
- [ ] Link to view commit on GitHub
- [ ] Link to browse tree at commit

### 6. Commit Details Panel/Card ✅
**On hover/click**:
- [ ] Full commit timestamp
- [ ] Parent commit SHAs (clickable)
- [ ] Branches this commit belongs to (with colored branch icons)
- [ ] "Head of" indicator for branch tip commits
- [ ] Additions/deletions count
- [ ] Hover card positioned near commit dot

### 7. Branch Filtering ✅
- [ ] Dropdown to select "All branches" (default) or specific branch
- [ ] Filter updates commit list to show only commits in selected branch(es)
- [ ] Branch list should show all branches with their HEAD commits

### 8. Pagination/Infinite Loading ✅
- [ ] "Load more" or "Older" button at bottom
- [ ] Loads next batch of commits (10-35 more)
- [ ] Graph extends downward smoothly
- [ ] Lane stability maintained across pages

### 9. Authentication ✅
**Le Git Graph approach**:
- GitHub OAuth with `repo` scope (no read-only option available)
- Stores token in browser localStorage
- Custom PAT option for org repos with restricted OAuth

**Our approach** (improved):
- [ ] GitHub OAuth with PKCE (more secure for SPAs)
- [ ] Server-side session storage (httpOnly cookies, encrypted tokens)
- [ ] Custom PAT option (explained as alternative for orgs)
- [ ] Clear explanation of scope limitations in UI
- [ ] Logout functionality with token invalidation

### 10. Public vs Private Repo Access ✅
- [ ] Public repos work without authentication
- [ ] Private repos require OAuth or PAT
- [ ] Clear error messages when access is denied

## Technical Implementation Details

### GraphQL Query Pattern (from Le Git Graph)

**Initial branch fetch**:
```graphql
{
  repository(owner: "...", name: "...") {
    branch1: object(oid: "sha1") {
      ... on Commit {
        history(first: 10) {
          edges {
            node {
              oid
              messageHeadlineHTML
              committedDate
            }
          }
        }
      }
    }
    branch2: object(oid: "sha2") { ... }
  }
}
```

**Detail fetch** (batched, 11 commits at a time):
```graphql
{
  repository(owner: "...", name: "...") {
    commit0: object(oid: "...") {
      ... on Commit {
        additions
        deletions
        parents(first: 100) { ... }
        author { ... }
        statusCheckRollup { state }
      }
    }
    commit1: object(oid: "...") { ... }
  }
}
```

### Color Palette (from Le Git Graph)
```javascript
const colors = [
  "#fd7f6f", "#beb9db", "#7eb0d5", "#b2e061",
  "#bd7ebe", "#ffb55a", "#ffee65", "#fdcce5", "#8bd3c7"
]
```

### Relative Time Formatting
- "just now" (< 10s)
- "X seconds ago" (< 1m)
- "X minutes ago" (< 1h)
- "X hours ago" (< 1d)
- "X days ago" or "yesterday" (< 1 month)
- "on [date]" (> 1 month)

## Differences from Le Git Graph (Our Improvements)

### Architecture
- **Le Git Graph**: Browser extension, runs on GitHub pages
- **Our app**: Standalone web app with URL rewriting

### URL Handling
- **Our innovation**: Prepend domain to GitHub URL
- Support: `https://our-domain/https://github.com/owner/repo`
- Support: `https://our-domain/github.com/owner/repo`
- Support: `https://our-domain/owner/repo`

### Security
- **Le Git Graph**: Tokens in localStorage
- **Our app**: Server-side encrypted session storage, httpOnly cookies

### OAuth
- **Le Git Graph**: Traditional authorization code flow
- **Our app**: PKCE (Proof Key for Code Exchange)

### Caching
- **Le Git Graph**: No explicit caching (browser extension context)
- **Our app**: Aggressive server-side caching with ETags

### Testing
- **Le Git Graph**: No test suite mentioned
- **Our app**: Comprehensive unit, integration, and E2E tests

## Non-Goals (Features We Won't Replicate)

- Browser extension functionality
- Integration with GitHub's native UI
- Popup/settings page for extension
- First-run experience (FRE) flows specific to extensions

## Success Criteria

A user should be able to:
1. Take any GitHub repo URL and view it in our app by prepending our domain
2. See an interactive commit graph that matches Le Git Graph's visual style and behavior
3. Filter by branch, load more commits, view commit details
4. Authenticate with OAuth or PAT to view private repos
5. Experience fast load times (<2s first paint) with proper caching

## References

- Le Git Graph repo: https://github.com/NirmalScaria/le-git-graph
- Le Git Graph license: MIT
- GitHub GraphQL API: https://docs.github.com/en/graphql
- GitHub OAuth PKCE: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#using-pkce
