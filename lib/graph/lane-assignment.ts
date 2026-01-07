import { Commit, DEFAULT_GRAPH_CONFIG } from "../types";

/**
 * Lane assignment algorithm for git commit graph visualization
 *
 * Inspired by Le Git Graph's approach but with improvements for:
 * - Deterministic lane assignment during incremental loading
 * - Better lane reuse for compact graphs
 * - Support for octopus merges (>2 parents)
 *
 * Algorithm:
 * 1. For each commit, assign a lane (horizontal position)
 * 2. Continue parent commit in same lane when possible
 * 3. Create new lanes for merge sources (non-first parents)
 * 4. Reuse lanes when they become available
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
 * Assigns lanes and colors to a list of commits (sorted by date, newest first)
 */
export function assignLanesAndColors(
  commits: Commit[],
  heads: Array<{ name: string; oid: string }>,
  laneState: LaneState = createInitialLaneState()
): Commit[] {
  const colors = DEFAULT_GRAPH_CONFIG.colors;
  const headOids = new Set(heads.map((h) => h.oid));

  // Build commit lookup
  const commitDict = new Map<string, Commit>();
  commits.forEach((commit) => {
    commitDict.set(commit.oid, commit);
  });

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // Check if this commit already has a lane assigned (from previous page)
    let lane = laneState.commitLanes.get(commit.oid);
    let color = laneState.commitColors.get(commit.oid);

    // If not assigned yet, assign new lane/color
    if (lane === undefined || color === undefined) {
      // Head commits or commits without assigned lanes get a new lane
      if (headOids.has(commit.oid)) {
        lane = findAvailableLane(laneState);
        color = pickNextColor(colors, laneState.usedColors, laneState.nextLaneIndex);
        laneState.usedColors.add(color);
      } else {
        // Try to find a lane that's flowing into this commit from a child
        lane = findIncomingLane(commit, laneState);
        if (lane !== undefined) {
          color = findColorForLane(lane, laneState, commits, commitDict);
        } else {
          lane = findAvailableLane(laneState);
          color = pickNextColor(colors, laneState.usedColors, laneState.nextLaneIndex);
          laneState.usedColors.add(color);
        }
      }

      laneState.commitLanes.set(commit.oid, lane);
      laneState.commitColors.set(commit.oid, color);
    }

    // Assign to commit object
    commit.lineIndex = lane;
    commit.color = color;
    commit.isHead = headOids.has(commit.oid);

    // Update active lanes
    laneState.activeLanes.set(lane, commit.oid);

    // Handle parents
    if (commit.parents.length > 0) {
      // First parent continues in same lane
      const firstParent = commitDict.get(commit.parents[0].oid);
      if (firstParent && !laneState.commitLanes.has(firstParent.oid)) {
        laneState.commitLanes.set(firstParent.oid, lane);
        laneState.commitColors.set(firstParent.oid, color);
      }

      // Additional parents (merge sources) get new lanes
      for (let j = 1; j < commit.parents.length; j++) {
        const parent = commitDict.get(commit.parents[j].oid);
        if (parent && !laneState.commitLanes.has(parent.oid)) {
          const newLane = findAvailableLane(laneState);
          const newColor = pickNextColor(colors, laneState.usedColors, laneState.nextLaneIndex);
          laneState.usedColors.add(newColor);
          laneState.commitLanes.set(parent.oid, newLane);
          laneState.commitColors.set(parent.oid, newColor);
        }
      }
    }
  }

  return commits;
}

/**
 * Finds an available lane index (either reusing a freed lane or creating a new one)
 */
function findAvailableLane(laneState: LaneState): number {
  // Try to reuse a lane that's no longer active
  for (let i = 0; i < laneState.nextLaneIndex; i++) {
    if (!laneState.activeLanes.has(i)) {
      return i;
    }
  }

  // No available lanes, create a new one
  return laneState.nextLaneIndex++;
}

/**
 * Finds if there's already a lane flowing into this commit from a child commit
 */
function findIncomingLane(commit: Commit, laneState: LaneState): number | undefined {
  // Look through active lanes to see if any is pointing to this commit as parent
  for (const [lane, parentOid] of laneState.activeLanes.entries()) {
    if (parentOid === commit.oid) {
      return lane;
    }
  }
  return undefined;
}

/**
 * Finds the color for a given lane by looking at what's currently in that lane
 */
function findColorForLane(
  lane: number,
  laneState: LaneState,
  commits: Commit[],
  commitDict: Map<string, Commit>
): string {
  // Look for the color already assigned to this lane
  for (const [oid, assignedLane] of laneState.commitLanes.entries()) {
    if (assignedLane === lane) {
      const color = laneState.commitColors.get(oid);
      if (color) return color;
    }
  }

  // Fallback: pick next color
  return pickNextColor(DEFAULT_GRAPH_CONFIG.colors, laneState.usedColors, lane);
}

/**
 * Picks the next color from the palette, cycling through if necessary
 */
function pickNextColor(colors: string[], usedColors: Set<string>, index: number): string {
  // Try to find an unused color first
  for (const color of colors) {
    if (!usedColors.has(color)) {
      return color;
    }
  }

  // All colors used, cycle through the palette
  return colors[index % colors.length];
}

/**
 * Calculates the 2D index array for graph rendering
 * indexArray[i][j] = which lane occupies position j on row i
 */
export function calculateIndexArray(commits: Commit[]): number[][] {
  const indexArray: number[][] = Array.from({ length: commits.length }, () => []);

  // Build commit lookup
  const commitDict = new Map<string, Commit>();
  commits.forEach((commit) => {
    commitDict.set(commit.oid, commit);
  });

  // For each lane, find where it starts and ends
  const maxLane = Math.max(...commits.map((c) => c.lineIndex || 0));

  for (let lane = 0; lane <= maxLane; lane++) {
    let start = commits.length;
    let end = 0;

    // Find the range where this lane is active
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];

      // Check if this commit is in this lane
      if (commit.lineIndex === lane) {
        start = Math.min(start, i);
        end = Math.max(end, i);
      }

      // Check if any parent is in this lane
      for (const parent of commit.parents) {
        const parentCommit = commitDict.get(parent.oid);
        if (parentCommit && parentCommit.lineIndex === lane) {
          start = Math.min(start, i);
          end = Math.max(end, i);
        }
      }
    }

    // Add this lane to all rows in its active range
    for (let i = start; i < end; i++) {
      if (!indexArray[i].includes(lane)) {
        indexArray[i].push(lane);
      }
    }
  }

  // Sort each row's lanes for consistent rendering
  indexArray.forEach((row) => row.sort((a, b) => a - b));

  return indexArray;
}
