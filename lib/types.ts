// Core types for the application

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
  commit?: string;
}

export interface Commit {
  oid: string;
  messageHeadline: string;
  messageBody: string;
  committedDate: Date;
  author: {
    name: string;
    email?: string;
    user?: {
      login: string;
      avatarUrl: string;
    };
  };
  parents: Array<{
    oid: string;
  }>;
  additions: number;
  deletions: number;
  statusCheckRollup?: {
    state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR";
  } | null;
  // Graph-specific properties
  branches: string[];
  color?: string;
  lineIndex?: number;
  isHead?: boolean;
  cx?: number;
  cy?: number;
}

export interface Branch {
  name: string;
  target: {
    oid: string;
  };
}

export interface CommitGraphData {
  commits: Commit[];
  branches: Branch[];
  heads: Array<{
    name: string;
    oid: string;
  }>;
  hasMore: boolean;
  cursor?: string;
}

export interface GraphRenderConfig {
  commitRadius: number;
  laneWidth: number;
  commitSpacing: number;
  colors: string[];
}

export const DEFAULT_GRAPH_CONFIG: GraphRenderConfig = {
  commitRadius: 4,
  laneWidth: 14,
  commitSpacing: 50,
  colors: [
    "#fd7f6f",
    "#beb9db",
    "#7eb0d5",
    "#b2e061",
    "#bd7ebe",
    "#ffb55a",
    "#ffee65",
    "#fdcce5",
    "#8bd3c7",
  ],
};

export interface LaneAssignment {
  commit: Commit;
  lane: number;
  color: string;
}
