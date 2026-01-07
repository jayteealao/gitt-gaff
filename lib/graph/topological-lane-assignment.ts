import { Commit, DEFAULT_GRAPH_CONFIG } from "../types";

/**
 * Lane assignment algorithm for git commit graph visualization
 *
 * This algorithm ensures:
 * 1. Commits are displayed newest first (by date)
 * 2. First parent always continues in the same lane (visual continuity)
 * 3. Branch heads start new lanes
 * 4. Merge sources (non-first parents) get separate lanes
 * 5. Lines connect all parent-child relationships
 */

export interface LaneState {
  activeLanes: Map<number, string>; // lane index -> current commit OID
  commitLanes: Map<string, number>; // commit OID -> assigned lane
  commitColors: Map<string, string>; // commit OID -> assigned color
  nextLaneIndex: number;
  usedColors: Set<string>;
}

export function createInitialLaneState(): LaneState {
  return {
    activeLanes: new Map(),
    commitLanes: new Map(),
    commitColors: new Map(),
    nextLaneIndex: 0,
    usedColors: new Set(),
  };
}

/**
 * Assigns lanes and colors to commits
 *
 * The algorithm:
 * 1. Sort commits by date (newest first) - this is display order
 * 2. Build a children map (parent -> list of children)
 * 3. Process each commit:
 *    - If it's a head, give it lane 0 (or next available if lane 0 is taken by another head)
 *    - If not a head, inherit lane from its FIRST child (the child that has this as first parent)
 *    - If no child claims this as first parent, give it a new lane
 * 4. Colors are assigned per lane for visual consistency
 */
export function assignLanesAndColors(
  commits: Commit[],
  heads: Array<{ name: string; oid: string }>,
  laneState: LaneState = createInitialLaneState()
): Commit[] {
  if (commits.length === 0) return commits;

  const colors = DEFAULT_GRAPH_CONFIG.colors;
  const headOids = new Set(heads.map((h) => h.oid));

  // Sort commits by date (newest first) - this is the display order
  const sortedCommits = [...commits].sort((a, b) => {
    const dateA = typeof a.committedDate === "string" ? new Date(a.committedDate) : a.committedDate;
    const dateB = typeof b.committedDate === "string" ? new Date(b.committedDate) : b.committedDate;
    return dateB.getTime() - dateA.getTime();
  });

  // Build commit dictionary
  const commitDict = new Map<string, Commit>();
  sortedCommits.forEach((commit) => {
    commitDict.set(commit.oid, commit);
  });

  // Build children map: for each commit, who are its children?
  const childrenMap = new Map<string, string[]>();
  sortedCommits.forEach((commit) => {
    commit.parents.forEach((parent) => {
      if (!childrenMap.has(parent.oid)) {
        childrenMap.set(parent.oid, []);
      }
      childrenMap.get(parent.oid)!.push(commit.oid);
    });
  });

  // Track which lanes are "owned" by which commit chain
  // When a commit gets a lane, its first parent should continue in that lane
  const laneOwners = new Map<number, string>(); // lane -> OID of commit that should continue it

  // Process commits in display order (newest first)
  for (const commit of sortedCommits) {
    let lane: number | undefined = laneState.commitLanes.get(commit.oid);
    let color: string | undefined = laneState.commitColors.get(commit.oid);

    if (lane === undefined) {
      // Check if this commit should continue a lane from one of its children
      const children = childrenMap.get(commit.oid) || [];

      // Find a child that has this commit as its FIRST parent
      for (const childOid of children) {
        const child = commitDict.get(childOid);
        if (child && child.parents.length > 0 && child.parents[0].oid === commit.oid) {
          // This commit is the first parent of this child - continue the child's lane
          const childLane = laneState.commitLanes.get(childOid);
          if (childLane !== undefined) {
            lane = childLane;
            color = laneState.commitColors.get(childOid);
            break;
          }
        }
      }
    }

    if (lane === undefined) {
      // No lane inherited - this is either a head or a merge source
      if (headOids.has(commit.oid)) {
        // Head commit - assign lane starting from 0
        lane = laneState.nextLaneIndex++;
        color = colors[lane % colors.length];
        laneState.usedColors.add(color);
      } else {
        // Non-head without a child claiming it as first parent
        // This is likely a merge source (second+ parent of some commit)
        lane = laneState.nextLaneIndex++;
        color = colors[lane % colors.length];
        laneState.usedColors.add(color);
      }
    }

    // Ensure color is set
    if (!color) {
      color = colors[lane % colors.length];
    }

    // Store assignments
    laneState.commitLanes.set(commit.oid, lane);
    laneState.commitColors.set(commit.oid, color);

    // Assign to commit object
    commit.lineIndex = lane;
    commit.color = color;
    commit.isHead = headOids.has(commit.oid);

    // Pre-assign lane for first parent (if it exists in our commit list)
    if (commit.parents.length > 0) {
      const firstParentOid = commit.parents[0].oid;
      if (commitDict.has(firstParentOid) && !laneState.commitLanes.has(firstParentOid)) {
        // First parent continues in same lane
        laneState.commitLanes.set(firstParentOid, lane);
        laneState.commitColors.set(firstParentOid, color);
      }
    }
  }

  return sortedCommits;
}

/**
 * Calculates the 2D index array for graph rendering
 * indexArray[i] = array of lanes that are "active" at row i
 *
 * A lane is active between a commit and its parent (both in the list)
 */
export function calculateIndexArray(commits: Commit[]): number[][] {
  const indexArray: number[][] = Array.from({ length: commits.length }, () => []);

  // Build commit lookup
  const commitDict = new Map<string, Commit>();
  const commitIndex = new Map<string, number>();
  commits.forEach((commit, i) => {
    commitDict.set(commit.oid, commit);
    commitIndex.set(commit.oid, i);
  });

  // For each commit, add its lane to the indexArray
  // Also, for each parent relationship, fill in the lanes between child and parent
  commits.forEach((commit, i) => {
    const lane = commit.lineIndex || 0;

    // Add this commit's lane to its row
    if (!indexArray[i].includes(lane)) {
      indexArray[i].push(lane);
    }

    // For each parent, fill lanes between this commit and the parent
    commit.parents.forEach((parent) => {
      const parentCommit = commitDict.get(parent.oid);
      const parentIdx = commitIndex.get(parent.oid);

      if (parentCommit && parentIdx !== undefined) {
        const parentLane = parentCommit.lineIndex || 0;

        // Fill the parent's lane from this commit's row to the parent's row
        for (let row = i; row <= parentIdx; row++) {
          if (!indexArray[row].includes(parentLane)) {
            indexArray[row].push(parentLane);
          }
        }

        // Also fill this commit's lane between the rows (for merges where lanes differ)
        if (lane !== parentLane) {
          for (let row = i; row <= parentIdx; row++) {
            if (!indexArray[row].includes(lane)) {
              indexArray[row].push(lane);
            }
          }
        }
      }
    });
  });

  // Sort each row's lanes for consistent rendering
  indexArray.forEach((row) => row.sort((a, b) => a - b));

  return indexArray;
}
