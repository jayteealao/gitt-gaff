import { NextRequest, NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";

/**
 * GET /api/github/repo?owner=<owner>&name=<name>
 *
 * Fetches repository metadata
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const name = searchParams.get("name");

  if (!owner || !name) {
    return NextResponse.json(
      { error: "Missing owner or name parameter" },
      { status: 400 }
    );
  }

  try {
    // Get token from session or use server PAT for public repos
    const token = getTokenFromRequest(request);
    const client = new GitHubClient(token);

    const repo = await client.getRepository(owner, name);

    return NextResponse.json(repo);
  } catch (error: any) {
    console.error("Failed to fetch repository:", error);

    if (error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch repository" },
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
