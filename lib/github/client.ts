import { Commit, Branch } from "../types";

export interface GitHubGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    type?: string;
    path?: string[];
  }>;
}

export interface RateLimitInfo {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface RepositoryInfo {
  name: string;
  owner: {
    login: string;
  };
  defaultBranchRef?: {
    name: string;
  };
  isPrivate: boolean;
  viewerPermission?: string;
}

/**
 * GitHub GraphQL API client
 * Handles authentication, rate limiting, and error handling
 */
export class GitHubClient {
  private baseUrl = "https://api.github.com/graphql";
  private token: string | null;

  constructor(token?: string) {
    this.token = token || null;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<GitHubGraphQLResponse<T>> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetches repository metadata
   */
  async getRepository(owner: string, name: string): Promise<RepositoryInfo> {
    const query = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          name
          owner {
            login
          }
          defaultBranchRef {
            name
          }
          isPrivate
          viewerPermission
        }
        rateLimit {
          limit
          cost
          remaining
          resetAt
        }
      }
    `;

    const result = await this.request<{
      repository: RepositoryInfo;
      rateLimit: RateLimitInfo;
    }>(query, { owner, name });

    if (result.errors) {
      throw new Error(`Failed to fetch repository: ${result.errors[0].message}`);
    }

    if (!result.data?.repository) {
      throw new Error("Repository not found");
    }

    return result.data.repository;
  }

  /**
   * Fetches all branches for a repository
   * Handles pagination automatically
   */
  async getBranches(
    owner: string,
    name: string,
    limit: number = 100
  ): Promise<Branch[]> {
    type BranchesResponse = {
      repository: {
        refs: {
          edges: Array<{
            cursor: string;
            node: {
              name: string;
              target: {
                oid: string;
              };
            };
          }>;
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string;
          };
        };
      };
    };

    const branches: Branch[] = [];
    let hasNextPage = true;
    let afterCursor: string | null = null;

    while (hasNextPage) {
      const query = `
        query($owner: String!, $name: String!, $limit: Int!, $cursor: String) {
          repository(owner: $owner, name: $name) {
            refs(
              refPrefix: "refs/heads/",
              first: $limit,
              after: $cursor,
              orderBy: { field: TAG_COMMIT_DATE, direction: DESC }
            ) {
              edges {
                cursor
                node {
                  name
                  target {
                    ... on Commit {
                      oid
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;

      const result: GitHubGraphQLResponse<BranchesResponse> = await this.request<BranchesResponse>(
        query,
        {
          owner,
          name,
          limit,
          cursor: afterCursor,
        }
      );

      if (result.errors || !result.data?.repository.refs) {
        throw new Error("Failed to fetch branches");
      }

      const refs = result.data.repository.refs;
      branches.push(
        ...refs.edges.map((edge) => ({
          name: edge.node.name,
          target: {
            oid: edge.node.target.oid,
          },
        }))
      );

      hasNextPage = refs.pageInfo.hasNextPage;
      afterCursor = refs.pageInfo.endCursor;
    }

    return branches;
  }

  /**
   * Fetches commit history from a specific commit OID
   * Returns commits in chronological order (oldest first in the response)
   */
  async getCommitHistory(
    owner: string,
    name: string,
    oid: string,
    limit: number = 100
  ): Promise<{ commits: Commit[]; hasMore: boolean; cursor?: string }> {
    const query = `
      query($owner: String!, $name: String!, $oid: GitObjectID!, $limit: Int!) {
        repository(owner: $owner, name: $name) {
          object(oid: $oid) {
            ... on Commit {
              history(first: $limit) {
                edges {
                  cursor
                  node {
                    oid
                    messageHeadline
                    message
                    committedDate
                    author {
                      name
                      email
                      user {
                        login
                        avatarUrl
                      }
                    }
                    parents(first: 100) {
                      edges {
                        node {
                          oid
                        }
                      }
                    }
                    additions
                    deletions
                    statusCheckRollup {
                      state
                    }
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.request<{
      repository: {
        object: {
          history: {
            edges: Array<{
              cursor: string;
              node: any;
            }>;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string;
            };
          };
        };
      };
    }>(query, { owner, name, oid, limit });

    if (result.errors || !result.data?.repository.object) {
      throw new Error("Failed to fetch commit history");
    }

    const history = result.data.repository.object.history;

    const commits: Commit[] = history.edges.map((edge) => {
      const node = edge.node;
      return {
        oid: node.oid,
        messageHeadline: node.messageHeadline,
        messageBody: node.message,
        committedDate: new Date(node.committedDate),
        author: {
          name: node.author.name,
          email: node.author.email,
          user: node.author.user
            ? {
                login: node.author.user.login,
                avatarUrl: node.author.user.avatarUrl,
              }
            : undefined,
        },
        parents: node.parents.edges.map((p: any) => ({ oid: p.node.oid })),
        additions: node.additions,
        deletions: node.deletions,
        statusCheckRollup: node.statusCheckRollup,
        branches: [],
      };
    });

    return {
      commits,
      hasMore: history.pageInfo.hasNextPage,
      cursor: history.pageInfo.endCursor,
    };
  }

  /**
   * Fetches commits from multiple branch heads in a single request
   * More efficient than calling getCommitHistory multiple times
   */
  async getCommitsFromBranches(
    owner: string,
    name: string,
    branchOids: string[],
    limit: number = 10
  ): Promise<Map<string, Commit[]>> {
    // Build a dynamic query with aliases for each branch
    const branchQueries = branchOids
      .map((oid, index) => {
        const alias = `branch${index}`;
        return `
          ${alias}: object(oid: "${oid}") {
            ... on Commit {
              history(first: ${limit}) {
                edges {
                  node {
                    oid
                    messageHeadline
                    message
                    committedDate
                  }
                }
              }
            }
          }
        `;
      })
      .join("\n");

    const query = `
      query {
        repository(owner: "${owner}", name: "${name}") {
          ${branchQueries}
        }
      }
    `;

    const result = await this.request<{
      repository: Record<string, any>;
    }>(query);

    if (result.errors) {
      throw new Error("Failed to fetch commits from branches");
    }

    const commitsMap = new Map<string, Commit[]>();

    branchOids.forEach((oid, index) => {
      const alias = `branch${index}`;
      const branchData = result.data?.repository[alias];

      if (branchData?.history?.edges) {
        const commits = branchData.history.edges.map((edge: any) => ({
          oid: edge.node.oid,
          messageHeadline: edge.node.messageHeadline,
          messageBody: edge.node.message,
          committedDate: new Date(edge.node.committedDate),
          author: { name: "Unknown" }, // Basic data, will be enriched later
          parents: [],
          additions: 0,
          deletions: 0,
          branches: [],
        }));

        commitsMap.set(oid, commits);
      }
    });

    return commitsMap;
  }
}
