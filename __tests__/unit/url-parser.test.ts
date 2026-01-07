import { parseGitHubUrl, toGitHubUrl, parsePathSegments, isValidRepoInfo } from "@/lib/utils/url-parser";

describe("parseGitHubUrl", () => {
  it("should parse full GitHub URLs", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should parse GitHub URLs with branch", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/tree/main");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      commit: undefined,
    });
  });

  it("should parse GitHub URLs with commit", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/commit/abc123");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: "abc123",
    });
  });

  it("should parse URLs without protocol", () => {
    const result = parseGitHubUrl("github.com/owner/repo");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should parse short owner/repo format", () => {
    const result = parseGitHubUrl("owner/repo");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should remove .git suffix", () => {
    const result = parseGitHubUrl("owner/repo.git");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should handle trailing slashes", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/");
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should return null for invalid URLs", () => {
    expect(parseGitHubUrl("")).toBeNull();
    expect(parseGitHubUrl("invalid")).toBeNull();
    expect(parseGitHubUrl("https://example.com")).toBeNull();
  });
});

describe("toGitHubUrl", () => {
  it("should convert repo info to URL", () => {
    const url = toGitHubUrl({ owner: "owner", repo: "repo" });
    expect(url).toBe("https://github.com/owner/repo");
  });

  it("should include branch in URL", () => {
    const url = toGitHubUrl({ owner: "owner", repo: "repo", branch: "main" });
    expect(url).toBe("https://github.com/owner/repo/tree/main");
  });

  it("should include commit in URL", () => {
    const url = toGitHubUrl({ owner: "owner", repo: "repo", commit: "abc123" });
    expect(url).toBe("https://github.com/owner/repo/commit/abc123");
  });
});

describe("parsePathSegments", () => {
  it("should parse path segments from catch-all route", () => {
    const segments = ["https:", "github.com", "owner", "repo"];
    const result = parsePathSegments(segments);
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      commit: undefined,
    });
  });

  it("should handle empty segments", () => {
    expect(parsePathSegments([])).toBeNull();
  });
});

describe("isValidRepoInfo", () => {
  it("should validate correct repo info", () => {
    expect(isValidRepoInfo({ owner: "owner", repo: "repo" })).toBe(true);
  });

  it("should reject invalid repo info", () => {
    expect(isValidRepoInfo(null)).toBe(false);
    expect(isValidRepoInfo({ owner: "", repo: "repo" })).toBe(false);
    expect(isValidRepoInfo({ owner: "owner", repo: "" })).toBe(false);
  });
});
