"use client";

import { Commit } from "@/lib/types";

const COLLAPSED_HEIGHT = 50; // px - must match CommitGraph
const EXPANDED_HEIGHT = 200; // px - must match CommitGraph

interface CommitListProps {
  commits: Commit[];
  expandedCommit: string | null;
  setExpandedCommit: (oid: string | null) => void;
}

export default function CommitList({
  commits,
  expandedCommit,
  setExpandedCommit,
}: CommitListProps) {
  const handleCommitClick = (commit: Commit) => {
    setExpandedCommit(expandedCommit === commit.oid ? null : commit.oid);
  };

  return (
    <div className="flex-1 min-w-0">
      {commits.map((commit) => {
        const isExpanded = expandedCommit === commit.oid;

        return (
          <div
            key={commit.oid}
            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all overflow-hidden"
            style={{ height: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT }}
            onClick={() => handleCommitClick(commit)}
          >
            {/* Collapsed view - always visible at top of row */}
            <div
              className="flex items-center gap-3 px-3"
              style={{ height: COLLAPSED_HEIGHT }}
            >
              {/* Commit message */}
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0">
                {commit.messageHeadline}
              </p>

              {/* Commit SHA */}
              <code className="text-xs font-mono text-gray-500 dark:text-gray-400 flex-shrink-0">
                {commit.oid.substring(0, 7)}
              </code>
            </div>

            {/* Expanded view - only visible when expanded */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
                {/* Author info */}
                <div className="pt-3 flex items-center gap-3">
                  {commit.author.user?.avatarUrl ? (
                    <img
                      src={commit.author.user.avatarUrl}
                      alt={commit.author.user.login}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {commit.author.user?.login || commit.author.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(commit.committedDate)}
                    </p>
                  </div>
                </div>

                {/* Branches */}
                {commit.branches.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {commit.branches.map((branch) => (
                      <span
                        key={branch}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      >
                        {branch}
                      </span>
                    ))}
                  </div>
                )}

                {/* Parents and Changes */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {commit.parents.length > 0 && (
                    <span>
                      Parents:{" "}
                      {commit.parents.map((p) => p.oid.substring(0, 7)).join(", ")}
                    </span>
                  )}
                  <span className="text-green-600">+{commit.additions}</span>
                  <span className="text-red-600">-{commit.deletions}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {commits.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No commits found
        </div>
      )}
    </div>
  );
}

/**
 * Formats a date as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date().getTime();
  const dateTime = dateObj.getTime();
  const difference = (now - dateTime) / 1000;

  if (difference < 10) {
    return "just now";
  } else if (difference < 60) {
    return `${Math.floor(difference)} seconds ago`;
  } else if (difference < 3600) {
    const minutes = Math.floor(difference / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (difference < 86400) {
    const hours = Math.floor(difference / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (difference < 2620800) {
    const days = Math.floor(difference / 86400);
    return days > 1 ? `${days} days ago` : "yesterday";
  } else {
    return `on ${dateObj.toLocaleDateString()}`;
  }
}
