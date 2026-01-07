import { Commit, Branch, CommitGraphData } from "../types";
import { GitHubClient } from "./client";

/**
 * DAG (Directed Acyclic Graph) Traversal Algorithm
 *
 * Efficiently fetches commit history across multiple branches without
 * downloading redundant data.
 *
 * Algorithm:
 * 1. Start with all branch heads (tips)
 * 2. Fetch commits from each head, limited to first N commits
 * 3. Merge and deduplicate commits by OID
 * 4. Sort by commit date (newest first)
 * 5. Track which branches each commit belongs to
 * 6. For pagination: track frontier (unexplored parent commits)
 */

export interface DAGTraversalState {
  visitedCommits: Set<string>; // OIDs we've already fetched
  frontier: Set<string>; // OIDs we need to explore next
  commits: Map<string, Commit>; // All commits we've collected
  branchCommits: Map<string, Set<string>>; // branch name -> commit OIDs
}

export function createInitialDAGState(): DAGTraversalState {
  return {
    visitedCommits: new Set(),
    frontier: new Set(),
    commits: new Map(),
    branchCommits: new Map(),
  };
}

/**
 * Fetches commits across all branches using multi-head traversal
 */
export async function fetchCommitGraph(
  client: GitHubClient,
  owner: string,
  repo: string,
  branches: Branch[],
  options: {
    initialCommitsPerBranch?: number;
    maxCommitsToDisplay?: number;
    state?: DAGTraversalState;
  } = {}
): Promise<CommitGraphData> {
  const {
    initialCommitsPerBranch = 10,
    maxCommitsToDisplay = 35,
    state = createInitialDAGState(),
  } = options;

  // Phase 1: Fetch initial commits from each branch head
  const heads = branches.map((b) => ({ name: b.name, oid: b.target.oid }));

  for (const branch of branches) {
    // Skip if we've already visited this branch's head
    if (state.visitedCommits.has(branch.target.oid)) {
      continue;
    }

    try {
      const { commits } = await client.getCommitHistory(
        owner,
        repo,
        branch.target.oid,
        initialCommitsPerBranch
      );

      // Process each commit
      for (const commit of commits) {
        if (!state.visitedCommits.has(commit.oid)) {
          state.visitedCommits.add(commit.oid);
          state.commits.set(commit.oid, commit);

          // Track which branch this commit belongs to
          if (!state.branchCommits.has(branch.name)) {
            state.branchCommits.set(branch.name, new Set());
          }
          state.branchCommits.get(branch.name)!.add(commit.oid);

          // Add branch name to commit
          if (!commit.branches.includes(branch.name)) {
            commit.branches.push(branch.name);
          }

          // Add parents to frontier
          for (const parent of commit.parents) {
            if (!state.visitedCommits.has(parent.oid)) {
              state.frontier.add(parent.oid);
            }
          }
        } else {
          // Commit already exists, just add branch association
          const existingCommit = state.commits.get(commit.oid);
          if (existingCommit && !existingCommit.branches.includes(branch.name)) {
            existingCommit.branches.push(branch.name);
          }

          if (!state.branchCommits.has(branch.name)) {
            state.branchCommits.set(branch.name, new Set());
          }
          state.branchCommits.get(branch.name)!.add(commit.oid);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch commits for branch ${branch.name}:`, error);
      // Continue with other branches even if one fails
    }
  }

  // Phase 2: Propagate branch associations
  // A commit belongs to a branch if it's reachable from that branch's head
  propagateBranchAssociations(state, branches);

  // Convert to array and sort by date
  const allCommits = Array.from(state.commits.values()).sort(
    (a, b) => b.committedDate.getTime() - a.committedDate.getTime()
  );

  // Take only the commits we want to display
  const commitsToDisplay = allCommits.slice(0, maxCommitsToDisplay);

  return {
    commits: commitsToDisplay,
    branches,
    heads,
    hasMore: allCommits.length > maxCommitsToDisplay || state.frontier.size > 0,
    cursor: state.frontier.size > 0 ? Array.from(state.frontier)[0] : undefined,
  };
}

/**
 * Loads more commits from the frontier
 */
export async function fetchMoreCommits(
  client: GitHubClient,
  owner: string,
  repo: string,
  state: DAGTraversalState,
  options: {
    commitsPerFetch?: number;
    maxCommitsToDisplay?: number;
  } = {}
): Promise<Commit[]> {
  const { commitsPerFetch = 20, maxCommitsToDisplay = 35 } = options;

  // Take up to N OIDs from the frontier
  const oidsToFetch = Array.from(state.frontier).slice(0, commitsPerFetch);

  for (const oid of oidsToFetch) {
    state.frontier.delete(oid);

    if (state.visitedCommits.has(oid)) {
      continue;
    }

    try {
      const { commits } = await client.getCommitHistory(owner, repo, oid, 1);

      if (commits.length > 0) {
        const commit = commits[0];
        state.visitedCommits.add(commit.oid);
        state.commits.set(commit.oid, commit);

        // Add parents to frontier
        for (const parent of commit.parents) {
          if (!state.visitedCommits.has(parent.oid)) {
            state.frontier.add(parent.oid);
          }
        }

        // Determine which branches this commit belongs to
        // by checking which branches reference its children
        for (const [branchName, branchCommitSet] of state.branchCommits.entries()) {
          // If any commit in this branch has this commit as a parent,
          // then this commit belongs to this branch
          const hasChildInBranch = Array.from(branchCommitSet).some((childOid) => {
            const childCommit = state.commits.get(childOid);
            return childCommit?.parents.some((p) => p.oid === commit.oid);
          });

          if (hasChildInBranch) {
            branchCommitSet.add(commit.oid);
            if (!commit.branches.includes(branchName)) {
              commit.branches.push(branchName);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch commit ${oid}:`, error);
    }
  }

  // Return all commits sorted by date
  return Array.from(state.commits.values())
    .sort((a, b) => b.committedDate.getTime() - a.committedDate.getTime())
    .slice(0, maxCommitsToDisplay);
}

/**
 * Propagates branch associations by walking the commit graph
 * A commit belongs to a branch if it's reachable from that branch's head
 */
function propagateBranchAssociations(
  state: DAGTraversalState,
  branches: Branch[]
): void {
  for (const branch of branches) {
    const visited = new Set<string>();
    const queue: string[] = [branch.target.oid];

    while (queue.length > 0) {
      const oid = queue.shift()!;

      if (visited.has(oid)) {
        continue;
      }
      visited.add(oid);

      const commit = state.commits.get(oid);
      if (!commit) {
        continue;
      }

      // Add this commit to the branch
      if (!state.branchCommits.has(branch.name)) {
        state.branchCommits.set(branch.name, new Set());
      }
      state.branchCommits.get(branch.name)!.add(oid);

      if (!commit.branches.includes(branch.name)) {
        commit.branches.push(branch.name);
      }

      // Queue parents
      for (const parent of commit.parents) {
        if (state.commits.has(parent.oid) && !visited.has(parent.oid)) {
          queue.push(parent.oid);
        }
      }
    }
  }
}

/**
 * Filters commits to only those reachable from a specific branch
 */
export function filterCommitsByBranch(
  commits: Commit[],
  branchName: string
): Commit[] {
  return commits.filter((commit) => commit.branches.includes(branchName));
}
