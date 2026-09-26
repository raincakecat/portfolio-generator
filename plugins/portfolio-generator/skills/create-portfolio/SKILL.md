---
name: create-portfolio
description: Create and customize a portfolio website from a GitHub account's public repositories using the bundled Portfolio Generator template. Use when the user asks to build or update a generated project portfolio.
---

# Create a portfolio

The template is in `assets/template/` at the plugin root. Resolve that path relative to this skill's directory. It contains a Node generator, an Astro site, an optional live lookup server, and deployment configuration.

1. Ask for a GitHub username only if it is not available from the conversation or an existing project configuration. Confirm a destination only if the user has not named one and there is no suitable workspace. Do not overwrite unrelated files in an existing destination.
2. Copy the template into the chosen project directory, including dotfiles. Never copy a local `.env`, `node_modules`, `.git`, `dist`, or `.astro` directory from elsewhere.
3. Replace `github_user` in `portfolio.config.json` with the requested account. Apply requested include, exclude, and manual override choices.
4. Install dependencies with `npm ci` in the project root and `npm ci` in `site/`. Run `npm run generate`, `npm test`, and `npm run build --prefix site`. Fix errors and inspect the generated project data before handing over the site.
5. For a local live lookup, run `npm run serve` after the build and use `/lookup`. Do not expose a token in source files or logs; use the ignored `.env` file locally.
6. If the user requests publication, use the project's README and `render.yaml`. GitHub Pages hosts the portfolio and a basic browser-based public lookup. Render can host the richer server lookup and portfolio together. Connect accounts and publish with authorization already supplied by the user.

Keep the original MIT notice in copied code. Explain which parts are hosted, the verified URL if deployed, and any remaining account setup.
