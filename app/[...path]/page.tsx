"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parsePathSegments, isValidRepoInfo } from "@/lib/utils/url-parser";
import { Commit } from "@/lib/types";
import CommitGraph from "@/components/graph/CommitGraph";
import CommitList from "@/components/graph/CommitList";

export default function RepoGraphPage() {
  const params = useParams();
  const repoInfo = useMemo(() => {
    const pathSegments = Array.isArray(params.path)
      ? params.path
      : params.path
        ? [params.path]
        : [];
    return parsePathSegments(pathSegments);
  }, [params.path]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [heads, setHeads] = useState<Array<{ name: string; oid: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  useEffect(() => {
    const loadGraph = async () => {
      if (!isValidRepoInfo(repoInfo)) {
        setError("Invalid repository URL");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch commit graph from API
        const response = await fetch("/api/github/graph", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            branch: repoInfo.branch,
            loadAll: true,
            commitsPerFetch: 60,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch commit graph");
        }

        const data = await response.json();
        setCommits(data.commits);
        setHeads(Array.isArray(data.heads) ? data.heads : []);
      } catch (err: any) {
        console.error("Error loading commit graph:", err);
        setError(err.message || "Failed to load commit graph");
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [repoInfo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading commit graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Error Loading Graph</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700">
              Gitt-Gaff
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {params.path && Array.isArray(params.path) ? params.path.join("/") : params.path}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {commits.length} commits
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="flex">
          <CommitGraph
            commits={commits}
            expandedCommit={expandedCommit}
            heads={heads}
            repoOwner={repoInfo.owner}
            repoName={repoInfo.repo}
          />
          <CommitList
            commits={commits}
            expandedCommit={expandedCommit}
            setExpandedCommit={setExpandedCommit}
          />
        </div>
      </main>
    </div>
  );
}
