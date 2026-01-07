import { NextRequest, NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { fetchCommitGraph } from "@/lib/github/dag-traversal";
import { assignLanesAndColors } from "@/lib/graph/lane-assignment";

/**
 * POST /api/github/graph
 *
 * Fetches commit graph data for a repository
 *
 * Body:
 * {
 *   owner: string
 *   repo: string
 *   branch?: string (optional, for filtering)
 *   limit?: number (optional, max commits to return)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, limit = 35 } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing owner or repo parameter" },
        { status: 400 }
      );
    }

    // Get token from request
    const token = getTokenFromRequest(request);
    const client = new GitHubClient(token);

    // Fetch all branches
    const branches = await client.getBranches(owner, repo);

    if (branches.length === 0) {
      return NextResponse.json(
        { error: "No branches found in repository" },
        { status: 404 }
      );
    }

    // Filter to specific branch if requested
    const branchesToFetch = branch
      ? branches.filter((b) => b.name === branch)
      : branches;

    if (branchesToFetch.length === 0) {
      return NextResponse.json(
        { error: `Branch "${branch}" not found` },
        { status: 404 }
      );
    }

    // Fetch commit graph
    const graphData = await fetchCommitGraph(client, owner, repo, branchesToFetch, {
      maxCommitsToDisplay: limit,
    });

    // Assign lanes and colors
    const commitsWithLanes = assignLanesAndColors(
      graphData.commits,
      graphData.heads
    );

    return NextResponse.json({
      commits: commitsWithLanes,
      branches: graphData.branches,
      heads: graphData.heads,
      hasMore: graphData.hasMore,
    });
  } catch (error: any) {
    console.error("Failed to fetch commit graph:", error);

    return NextResponse.json(
      { error: error.message || "Failed to fetch commit graph" },
      { status: 500 }
    );
  }
}

function getTokenFromRequest(request: NextRequest): string | undefined {
  // Try to get token from Authorization header (for PAT mode)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try to get token from session cookie (for OAuth mode)
  // TODO: Implement session-based token retrieval

  // Fallback to server PAT for public repos
  return process.env.GITHUB_SERVER_PAT;
}
