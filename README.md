# Gitt-Gaff 📊

**Interactive Git Graph Viewer for GitHub Repositories**

Gitt-Gaff is a production-ready web application that provides an interactive visualization of git commit graphs for any GitHub repository. Simply prepend our domain to any GitHub URL to instantly view a beautiful, interactive commit history graph.

## 🌟 Features

- **URL Prepending**: Works by prepending your domain to any GitHub repository URL
- **Interactive Git Graph**: Visual representation of commits, branches, and merges
- **Multiple URL Formats**: Supports various GitHub URL formats
- **Commit Details**: Click any commit to view full details, parents, changes, and more
- **Branch Visualization**: See all branches and their relationships
- **Public & Private Repos**: Supports both public repos (no auth) and private repos (with OAuth/PAT)
- **Fast & Efficient**: Optimized DAG traversal algorithm for quick loading
- **Mobile Responsive**: Works on desktop and mobile devices

## 🎨 Inspired By

This project is inspired by [Le Git Graph](https://github.com/NirmalScaria/le-git-graph) (MIT licensed), a browser extension that adds git graph visualization to GitHub. We've reimplemented the core functionality as a standalone web app with significant improvements:

- Server-side GraphQL API proxy for better security and caching
- Improved DAG traversal algorithm for scalability
- OAuth with PKCE for enhanced security
- Deterministic lane assignment for stable graph rendering
- Comprehensive test suite

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- GitHub account (optional, for private repos)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gitt-gaff.git
cd gitt-gaff
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration (see Configuration section below).

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# GitHub OAuth Application (optional, for private repo access)
# Create at: https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Application URL (used for OAuth callback)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Session secret for encrypting cookies (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_session_secret_here

# Optional: GitHub Personal Access Token for server-side requests
# This allows viewing public repos without user authentication
GITHUB_SERVER_PAT=ghp_your_personal_access_token_here
```

### GitHub OAuth Setup

To enable private repository access via OAuth:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Gitt-Gaff (or your preferred name)
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback`
4. Click "Register application"
5. Copy the **Client ID** to `GITHUB_CLIENT_ID` in your `.env.local`
6. Generate a new **Client Secret** and copy it to `GITHUB_CLIENT_SECRET`

### Personal Access Token (PAT)

For server-side access to public repositories without user authentication:

1. Go to [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Gitt-Gaff Server")
4. Select scopes:
   - For public repos only: `public_repo`
   - For all repos: `repo`
5. Click "Generate token"
6. Copy the token to `GITHUB_SERVER_PAT` in your `.env.local`

## 📖 Usage

### Viewing a Repository

Gitt-Gaff supports multiple URL formats:

#### Prepend Format (Primary)
```
http://localhost:3000/https://github.com/owner/repo
http://localhost:3000/https://github.com/owner/repo/tree/branch
http://localhost:3000/https://github.com/owner/repo/commit/sha
```

#### Convenience Formats
```
http://localhost:3000/github.com/owner/repo
http://localhost:3000/owner/repo
```

### Examples

View the Next.js repository:
```
http://localhost:3000/vercel/next.js
```

View a specific branch:
```
http://localhost:3000/https://github.com/vercel/next.js/tree/canary
```

### Using the Bookmarklet

Gitt-Gaff provides a bookmarklet for quick access while browsing GitHub:

1. Visit the Gitt-Gaff homepage
2. Drag the "📊 View Git Graph" button to your bookmarks bar
3. While viewing any GitHub repository, click the bookmarklet
4. You'll be redirected to Gitt-Gaff with that repository's graph

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: GitHub GraphQL API v4
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Vercel/Cloudflare/Fly.io compatible

### Key Components

1. **URL Parser** (`lib/utils/url-parser.ts`)
   - Parses various GitHub URL formats
   - Extracts owner, repo, branch, and commit information

2. **GitHub GraphQL Client** (`lib/github/client.ts`)
   - Handles authentication and API requests
   - Fetches repository metadata, branches, and commits

3. **DAG Traversal Algorithm** (`lib/github/dag-traversal.ts`)
   - Efficiently fetches commit history from multiple branch heads
   - Deduplicates commits across branches
   - Supports incremental loading

4. **Lane Assignment Algorithm** (`lib/graph/lane-assignment.ts`)
   - Deterministic lane assignment for stable graph layout
   - Handles linear history, branches, merges, and octopus merges
   - Reuses lanes to keep graph compact

5. **Graph Rendering** (`components/graph/CommitGraph.tsx`)
   - SVG-based visualization
   - Interactive hover and click interactions
   - Curved lines for connections

6. **API Proxy** (`app/api/github/`)
   - Server-side proxy for GitHub API requests
   - Handles authentication tokens securely
   - Implements caching and rate limiting

## 🧪 Testing

### Unit Tests

Run unit tests:
```bash
npm test
```

Run specific test file:
```bash
npm test -- url-parser.test.ts
```

Watch mode:
```bash
npm run test:watch
```

### E2E Tests

Run end-to-end tests with Playwright:
```bash
npm run test:e2e
```

## 📚 API Documentation

### `POST /api/github/graph`

Fetches commit graph data for a repository.

**Request Body:**
```json
{
  "owner": "vercel",
  "repo": "next.js",
  "branch": "main",  // optional
  "limit": 35        // optional
}
```

**Response:**
```json
{
  "commits": [
    {
      "oid": "abc123...",
      "messageHeadline": "Commit message",
      "committedDate": "2024-01-01T00:00:00Z",
      "author": { "name": "...", "user": { "login": "...", "avatarUrl": "..." } },
      "parents": [{ "oid": "..." }],
      "branches": ["main", "develop"],
      "lineIndex": 0,
      "color": "#fd7f6f"
    }
  ],
  "branches": [...],
  "heads": [...],
  "hasMore": true
}
```

## 🚢 Deployment

### Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Docker

```bash
# Build
docker build -t gitt-gaff .

# Run
docker run -p 3000:3000 \
  -e GITHUB_CLIENT_ID=your_id \
  -e GITHUB_CLIENT_SECRET=your_secret \
  -e SESSION_SECRET=your_secret \
  gitt-gaff
```

## 🔒 Security & Privacy

- **Token Storage**: OAuth tokens are stored server-side in encrypted session cookies, never in localStorage
- **PKCE**: OAuth flow uses Proof Key for Code Exchange for enhanced security
- **CSP**: Strict Content Security Policy headers
- **No Analytics**: No user tracking or analytics by default
- **Private Repos**: Tokens are never logged or exposed in URLs/errors

See [PRIVACY.md](./PRIVACY.md) for our full privacy policy.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting PRs.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- **Le Git Graph** by [Nirmal Scaria](https://github.com/NirmalScaria) - The original browser extension that inspired this project
- **GitHub GraphQL API** - For providing the data
- **Next.js Team** - For the amazing framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/gitt-gaff/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/gitt-gaff/discussions)

---

**Note**: This is a third-party application and is not affiliated with or endorsed by GitHub, Inc.
