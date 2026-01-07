"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Normalize the URL - accept various GitHub URL formats
    let normalizedUrl = url.trim();

    // If it already starts with https://github.com, prepend it
    if (normalizedUrl.startsWith("https://github.com/")) {
      router.push(`/${normalizedUrl}`);
    }
    // If it starts with github.com (without https://), add the protocol
    else if (normalizedUrl.startsWith("github.com/")) {
      router.push(`/https://${normalizedUrl}`);
    }
    // If it's just owner/repo format
    else if (normalizedUrl.match(/^[\w-]+\/[\w-]+/)) {
      router.push(`/${normalizedUrl}`);
    }
    else {
      alert("Please enter a valid GitHub repository URL");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <main className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Gitt-Gaff
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Interactive Git Graph Viewer for GitHub
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="repo-url" className="block text-sm font-medium mb-2">
                Enter GitHub Repository URL
              </label>
              <input
                id="repo-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              View Git Graph
            </button>
          </form>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Supported URL Formats</h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
                  https://github.com/owner/repo
                </code>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
                  github.com/owner/repo
                </code>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
                  owner/repo
                </code>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1">
                  https://github.com/owner/repo/tree/branch
                </code>
              </li>
            </ul>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-lg font-semibold mb-2">Bookmarklet</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Drag this bookmarklet to your bookmarks bar to quickly view any GitHub repo:
            </p>
            <a
              href={`javascript:(function(){window.location.href='${typeof window !== 'undefined' ? window.location.origin : ''}/'+window.location.href;})()`}
              className="inline-block bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded transition-colors cursor-move"
              onClick={(e) => e.preventDefault()}
            >
              📊 View Git Graph
            </a>
          </div>
        </div>

        <footer className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Inspired by{" "}
            <a
              href="https://github.com/NirmalScaria/le-git-graph"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Le Git Graph
            </a>{" "}
            (MIT licensed)
          </p>
        </footer>
      </main>
    </div>
  );
}
