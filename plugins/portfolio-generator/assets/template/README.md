# Portfolio Generator

Generate a public project portfolio from a GitHub user's repositories. The generator writes `site/src/data/projects.json`; Astro turns that data into a static homepage and project detail pages. A separate local HTTP server can also build temporary profiles for other GitHub usernames.

## Requirements

- Node.js 22.12 or newer
- A GitHub account with public repositories

## Run locally

1. Set `github_user` in `portfolio.config.json`. Use `include` to show only named repositories, `exclude` to hide named repositories, and `manual_overrides` to replace generated fields by repository name.
2. Run:

```sh
npm ci
cd site && npm ci && cd ..
npm run generate
cd site && npm run dev
```

The site preview opens at the address printed by Astro. The homepage shows the configured user's projects. `/me/` is an alias for the same portfolio.

For an optional GitHub token, copy `.env.example` to `.env` and fill in `GITHUB_TOKEN`. The file is ignored by Git. The generator and local server load it automatically. Without a token, GitHub's unauthenticated API limit applies.

## Build and serve the live lookup

```sh
cd site && npm run build && cd ..
npm run serve
```

Open `http://127.0.0.1:8080/lookup` to look up another public GitHub user. The local server provides `/api/profile` and serves the built site. The live lookup requires this server; GitHub Pages serves the static portfolio only. Set `HOST`, `PORT`, `RATE_FRESH_PER_HOUR`, or `RATE_GLOBAL_PER_HOUR` as environment variables if needed.

## Publish the live lookup

`render.yaml` defines a Render Node web service that installs both projects, regenerates the portfolio, builds the site, and starts the HTTP server. Once this repository is on GitHub, create a **Blueprint** in Render from the repository. Render prompts for `GITHUB_TOKEN`; supply a GitHub token with public repository read access in Render's secret field, not in the repository. The service is available at the URL Render assigns and the live lookup is at `/lookup`.

The Blueprint uses Render's Free plan. A Free service can sleep after inactivity, so its first request after a quiet period can be slow. Its cache and rate counters are in memory and reset when the service restarts. For steady traffic, use a paid service and a persistent rate-limit store.

To link to the live lookup from the GitHub Pages homepage, add a GitHub Actions repository variable named `PUBLIC_LOOKUP_URL` with the full Render lookup URL, such as `https://your-service.onrender.com/lookup`. Then run the **Refresh and deploy portfolio** workflow again. The Render-hosted homepage links to its own `/lookup` automatically.

## Publish with GitHub Pages

The `.github/workflows/refresh.yml` workflow regenerates the portfolio on pushes to `main` or `master`, on a daily schedule, and on manual dispatch. It deploys from the repository's default branch. It sets Astro's base path from the repository name, so project pages work at `https://<owner>.github.io/<repository>/`. For a special `<owner>.github.io` repository, it uses the root path.

To publish:

1. Create an empty public GitHub repository, such as `portfolio-generator`. Do not add another README, license, or `.gitignore` during creation; this folder already has them.
2. Commit and push this folder's `main` branch to that repository. Keep `.env` local; it is ignored by Git.
3. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
4. Check the **Refresh and deploy portfolio** run in the **Actions** tab. After it succeeds, the portfolio appears at the Pages URL shown in the deployment.

The workflow publishes the generated site; it does not commit refreshed data back to the repository. The live username lookup is intentionally excluded from GitHub Pages because it needs the local server and GitHub API access.

GitHub Actions provides `GITHUB_TOKEN` automatically. No personal access token is needed for public repositories. The generator scans up to 300 owned, public, non-fork repositories and fetches details in groups of 12. GitHub API rate limits and repository size limits still apply.

## Data and descriptions

The generator reads repository metadata, file trees, README files, common dependency manifests, and recent commits. For substantial READMEs it extracts an introduction; otherwise it writes a short rule-based description. It does not call an AI service. `generator/summary-cache.json` stores descriptions locally and is ignored by Git.

Manual overrides are applied after generation. Example:

```json
{
  "github_user": "your-username",
  "include": [],
  "exclude": ["repo-to-hide"],
  "manual_overrides": {
    "repo-name": {
      "description": "A description you wrote.",
      "category": "Web App"
    }
  }
}
```

Run `npm test` for generator checks, `cd site && npm run build` for the static build, and `npm audit --omit=dev` in both directories to check installed dependencies.

## License

MIT. See `LICENSE`.

