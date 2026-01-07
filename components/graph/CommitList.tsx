"use client";

import { Commit } from "@/lib/types";

interface CommitListProps {
  commits: Commit[];
  onCommitClick?: (commit: Commit) => void;
}

export default function CommitList({ commits, onCommitClick }: CommitListProps) {
  return (
    <div className="flex-1 min-w-0">
      {commits.map((commit) => (
        <div
          key={commit.oid}
          className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
          style={{ minHeight: "50px" }}
          onClick={() => onCommitClick?.(commit)}
        >
          <div className="p-3 flex items-start gap-3">
            {/* Author avatar (if available) */}
            {commit.author.user?.avatarUrl ? (
              <img
                src={commit.author.user.avatarUrl}
                alt={commit.author.user.login}
                className="w-6 h-6 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              {/* Commit message */}
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {commit.messageHeadline}
              </p>

              {/* Metadata */}
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate">
                  {commit.author.user?.login || commit.author.name}
                </span>
                <span>•</span>
                <span>{formatRelativeTime(commit.committedDate)}</span>
              </div>

              {/* Branches (if any) */}
              {commit.branches.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {commit.branches.slice(0, 3).map((branch) => (
                    <span
                      key={branch}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                    >
                      {branch}
                    </span>
                  ))}
                  {commit.branches.length > 3 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      +{commit.branches.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Commit SHA */}
            <code className="text-xs font-mono text-gray-500 dark:text-gray-400 flex-shrink-0">
              {commit.oid.substring(0, 7)}
            </code>
          </div>
        </div>
      ))}

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
function formatRelativeTime(date: Date): string {
  const now = new Date().getTime();
  const difference = (now - date.getTime()) / 1000;

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
    return `on ${date.toLocaleDateString()}`;
  }
}
