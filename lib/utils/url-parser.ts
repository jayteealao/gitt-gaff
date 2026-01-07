import { GitHubRepoInfo } from "../types";

/**
 * Parses various GitHub URL formats and extracts repo information
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/commit/sha
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(urlOrPath: string): GitHubRepoInfo | null {
  let normalized = urlOrPath.trim();

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, "");

  // Handle full GitHub URLs
  const fullUrlMatch = normalized.match(
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?(?:\/commit\/([^\/]+))?/
  );
  if (fullUrlMatch) {
    return {
      owner: fullUrlMatch[1],
      repo: fullUrlMatch[2].replace(/\.git$/, ""),
      branch: fullUrlMatch[3],
      commit: fullUrlMatch[4],
    };
  }

  // Handle github.com/owner/repo (without protocol)
  const noProtocolMatch = normalized.match(
    /^github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?(?:\/commit\/([^\/]+))?/
  );
  if (noProtocolMatch) {
    return {
      owner: noProtocolMatch[1],
      repo: noProtocolMatch[2].replace(/\.git$/, ""),
      branch: noProtocolMatch[3],
      commit: noProtocolMatch[4],
    };
  }

  // Handle owner/repo format
  const shortMatch = normalized.match(/^([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2].replace(/\.git$/, ""),
    };
  }

  return null;
}

/**
 * Converts a GitHubRepoInfo object to a canonical GitHub URL
 */
export function toGitHubUrl(info: GitHubRepoInfo): string {
  let url = `https://github.com/${info.owner}/${info.repo}`;

  if (info.branch) {
    url += `/tree/${info.branch}`;
  } else if (info.commit) {
    url += `/commit/${info.commit}`;
  }

  return url;
}

/**
 * Parses a catch-all path segment from Next.js dynamic routes
 * Example: [...path] might be ["https:", "github.com", "owner", "repo"]
 */
export function parsePathSegments(segments: string[]): GitHubRepoInfo | null {
  if (!segments || segments.length === 0) {
    return null;
  }

  // Join segments back into a path, handling protocol correctly
  let path = segments.join("/");

  // Fix protocol double-slash (https:/ -> https://)
  path = path.replace(/^(https?):\/([^\/])/, "$1://$2");

  // Try to parse as a GitHub URL
  return parseGitHubUrl(path);
}

/**
 * Validates if a repo info object is valid
 */
export function isValidRepoInfo(info: GitHubRepoInfo | null): info is GitHubRepoInfo {
  return !!(info?.owner && info?.repo);
}
