"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { parsePathSegments, isValidRepoInfo } from "@/lib/utils/url-parser";
import { Commit } from "@/lib/types";
import CommitGraph from "@/components/graph/CommitGraph";
import CommitList from "@/components/graph/CommitList";

export default function RepoGraphPage() {
  const params = useParams();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);

  useEffect(() => {
    const loadGraph = async () => {
      // Parse the URL path
      const pathSegments = Array.isArray(params.path)
        ? params.path
        : params.path
          ? [params.path]
          : [];
      const repoInfo = parsePathSegments(pathSegments);

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
            limit: 35,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch commit graph");
        }

        const data = await response.json();
        setCommits(data.commits);
      } catch (err: any) {
        console.error("Error loading commit graph:", err);
        setError(err.message || "Failed to load commit graph");
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [params.path]);

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

      <main className="flex-1 flex">
        <div className="flex-1 flex">
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="flex">
              <CommitGraph commits={commits} onCommitClick={setSelectedCommit} />
              <CommitList commits={commits} onCommitClick={setSelectedCommit} />
            </div>
          </div>

          <div className="w-2/3 overflow-y-auto p-6">
            {selectedCommit ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Commit Details</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Message
                    </h3>
                    <p className="text-lg font-medium">{selectedCommit.messageHeadline}</p>
                    {selectedCommit.messageBody && (
                      <pre className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {selectedCommit.messageBody}
                      </pre>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Commit
                    </h3>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {selectedCommit.oid.substring(0, 7)}
                    </code>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Author
                    </h3>
                    <p className="text-sm">{selectedCommit.author.name}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </h3>
                    <p className="text-sm">{selectedCommit.committedDate.toLocaleString()}</p>
                  </div>

                  {selectedCommit.parents.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Parents
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCommit.parents.map((parent) => (
                          <code
                            key={parent.oid}
                            className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
                          >
                            {parent.oid.substring(0, 7)}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Changes
                    </h3>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">+{selectedCommit.additions}</span>
                      <span className="text-red-600">-{selectedCommit.deletions}</span>
                    </div>
                  </div>

                  {selectedCommit.branches.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Branches
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCommit.branches.map((branch) => (
                          <span
                            key={branch}
                            className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                          >
                            {branch}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                <p>Select a commit to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
