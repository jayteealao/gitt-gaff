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
    const { owner, repo, branch } = body;

    // Validate required parameters
    if (!owner || typeof owner !== "string" || owner.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid owner parameter" },
        { status: 400 }
      );
    }

    if (!repo || typeof repo !== "string" || repo.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid repo parameter" },
        { status: 400 }
      );
    }

    // Validate and sanitize limit parameter to prevent DoS
    const rawLimit = body.limit ?? 35;
    const limit = typeof rawLimit === "number"
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
      : 35;

    if (typeof rawLimit === "number" && (rawLimit < 1 || rawLimit > 100)) {
      console.warn(`Limit out of bounds (${rawLimit}), clamped to ${limit}`);
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

    // Return sanitized error message (don't expose internal details)
    const isNotFound = error.message?.includes("not found") || error.message?.includes("404");
    const isUnauthorized = error.message?.includes("401") || error.message?.includes("unauthorized");

    if (isNotFound) {
      return NextResponse.json(
        { error: "Repository not found or not accessible" },
        { status: 404 }
      );
    }

    if (isUnauthorized) {
      return NextResponse.json(
        { error: "Authentication required to access this repository" },
        { status: 401 }
      );
    }

    // Generic error for all other cases
    return NextResponse.json(
      { error: "Unable to load repository. Please check the URL and try again." },
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
