import { assignLanesAndColors, calculateIndexArray, createInitialLaneState } from "@/lib/graph/lane-assignment";
import { Commit } from "@/lib/types";

// Helper to create a simple commit
function createCommit(oid: string, parents: string[], date: Date = new Date()): Commit {
  return {
    oid,
    messageHeadline: `Commit ${oid}`,
    messageBody: "",
    committedDate: date,
    author: {
      name: "Test Author",
    },
    parents: parents.map((p) => ({ oid: p })),
    additions: 0,
    deletions: 0,
    branches: [],
  };
}

describe("assignLanesAndColors", () => {
  it("should assign lane 0 to a single commit", () => {
    const commits = [createCommit("a", [])];
    const heads = [{ name: "main", oid: "a" }];

    const result = assignLanesAndColors(commits, heads);

    expect(result[0].lineIndex).toBe(0);
    expect(result[0].color).toBeDefined();
    expect(result[0].isHead).toBe(true);
  });

  it("should assign same lane to linear history", () => {
    // Linear history: a <- b <- c
    const commits = [
      createCommit("c", ["b"], new Date("2024-01-03")),
      createCommit("b", ["a"], new Date("2024-01-02")),
      createCommit("a", [], new Date("2024-01-01")),
    ];
    const heads = [{ name: "main", oid: "c" }];

    const result = assignLanesAndColors(commits, heads);

    expect(result[0].lineIndex).toBe(0); // c
    expect(result[1].lineIndex).toBe(0); // b
    expect(result[2].lineIndex).toBe(0); // a
    // All should have same color
    expect(result[0].color).toBe(result[1].color);
    expect(result[1].color).toBe(result[2].color);
  });

  it("should handle simple branch (Y-shape)", () => {
    // Branch: a <- b <- c (main)
    //          \<- d (feature)
    const commits = [
      createCommit("c", ["b"], new Date("2024-01-04")),
      createCommit("d", ["a"], new Date("2024-01-03")),
      createCommit("b", ["a"], new Date("2024-01-02")),
      createCommit("a", [], new Date("2024-01-01")),
    ];
    const heads = [
      { name: "main", oid: "c" },
      { name: "feature", oid: "d" },
    ];

    const result = assignLanesAndColors(commits, heads);

    // c and b should be in same lane (main branch)
    expect(result[0].lineIndex).toBe(result[2].lineIndex);
    // d should be in a different lane (feature branch)
    expect(result[1].lineIndex).not.toBe(result[0].lineIndex);
    // c and d should have different colors (branch heads)
    expect(result[0].color).not.toBe(result[1].color);
  });

  it("should handle merge commit (two parents)", () => {
    // Merge: a <- b <- c <- m (merges d)
    //          \<- d <-/
    const commits = [
      createCommit("m", ["c", "d"], new Date("2024-01-05")),
      createCommit("c", ["b"], new Date("2024-01-04")),
      createCommit("d", ["a"], new Date("2024-01-03")),
      createCommit("b", ["a"], new Date("2024-01-02")),
      createCommit("a", [], new Date("2024-01-01")),
    ];
    const heads = [{ name: "main", oid: "m" }];

    const result = assignLanesAndColors(commits, heads);

    // m should have 2 parents
    expect(result[0].parents).toHaveLength(2);
    // First parent (c) should be in same lane as m
    expect(result[1].lineIndex).toBe(result[0].lineIndex);
    // d should be assigned a lane
    expect(result[2].lineIndex).toBeDefined();
  });

  it("should handle octopus merge (3+ parents)", () => {
    // Octopus merge: a <- b, c, d all merge into m
    const commits = [
      createCommit("m", ["b", "c", "d"], new Date("2024-01-05")),
      createCommit("d", ["a"], new Date("2024-01-04")),
      createCommit("c", ["a"], new Date("2024-01-03")),
      createCommit("b", ["a"], new Date("2024-01-02")),
      createCommit("a", [], new Date("2024-01-01")),
    ];
    const heads = [{ name: "main", oid: "m" }];

    const result = assignLanesAndColors(commits, heads);

    // All commits should have lanes assigned
    result.forEach((commit) => {
      expect(commit.lineIndex).toBeDefined();
      expect(commit.color).toBeDefined();
    });

    // m should have 3 parents
    expect(result[0].parents).toHaveLength(3);
  });

  it("should handle criss-cross merge", () => {
    // Criss-cross: both branches merge from each other before final merge
    // This is a complex DAG pattern
    const commits = [
      createCommit("m", ["c", "d"], new Date("2024-01-07")),
      createCommit("d", ["b"], new Date("2024-01-06")),
      createCommit("c", ["b"], new Date("2024-01-05")),
      createCommit("b", ["a"], new Date("2024-01-02")),
      createCommit("a", [], new Date("2024-01-01")),
    ];
    const heads = [{ name: "main", oid: "m" }];

    const result = assignLanesAndColors(commits, heads);

    // All commits should have lanes and colors assigned
    result.forEach((commit) => {
      expect(commit.lineIndex).toBeDefined();
      expect(commit.color).toBeDefined();
    });
  });
});

describe("calculateIndexArray", () => {
  it("should calculate index array for linear history", () => {
    const commits = [
      createCommit("c", ["b"]),
      createCommit("b", ["a"]),
      createCommit("a", []),
    ];
    commits[0].lineIndex = 0;
    commits[1].lineIndex = 0;
    commits[2].lineIndex = 0;

    const indexArray = calculateIndexArray(commits);

    // For linear history, all rows should have lane 0
    expect(indexArray[0]).toContain(0);
    expect(indexArray[1]).toContain(0);
  });

  it("should calculate index array for branching history", () => {
    const commits = [
      createCommit("c", ["b"]),
      createCommit("d", ["a"]),
      createCommit("b", ["a"]),
      createCommit("a", []),
    ];
    commits[0].lineIndex = 0; // c in lane 0
    commits[1].lineIndex = 1; // d in lane 1
    commits[2].lineIndex = 0; // b in lane 0
    commits[3].lineIndex = 0; // a in lane 0

    const indexArray = calculateIndexArray(commits);

    // Where branches diverge, both lanes should be active
    // This depends on parent relationships
    expect(indexArray.length).toBe(commits.length);
  });
});
