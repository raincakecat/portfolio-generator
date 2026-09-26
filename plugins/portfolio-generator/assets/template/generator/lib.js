import crypto from "node:crypto";
import { Octokit } from "@octokit/rest";

const ACTIVE_DAYS = 60;
const MAINTAINED_DAYS = 365;
const COMMIT_WINDOW_DAYS = 90;
const README_MIN_WORDS = 300;

// Hard limits that bound the work per request (DoS guardrails, audit section 21)
export const LIMITS = {
  MAX_REPO_PAGES: 3, // 3 * 100 repos max scanned
  MAX_REPOS_PER_PAGE: 12,
  MAX_TREE_ENTRIES: 2000,
  MAX_FILE_BYTES: 20000,
  MAX_README_BYTES: 30000,
  MAX_COMMITS_PER_PAGE: 50,
};

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hashContent(parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p || "");
  return h.digest("hex");
}

export function slugify(name) {
  const label = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${label}-${hashContent([name.toLowerCase()]).slice(0, 8)}`;
}

export const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function statusFromLastCommit(lastCommitAt) {
  const days = (Date.now() - new Date(lastCommitAt).getTime()) / 86400000;
  if (days <= ACTIVE_DAYS) return "active";
  if (days <= MAINTAINED_DAYS) return "maintained";
  return "archived";
}

function stripMd(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .trim();
}

export function extractIntro(readme) {
  const paragraphs = [];
  let current = [];
  for (const line of readme.split("\n")) {
    const t = line.trim();
    if (t === "" || /^#/.test(t) || /^[|│├└]/.test(t) || /^[-*+]\s/.test(t) || /^\d+[.)]\s/.test(t) || /^```/.test(t) || /^(---|\*\*\*)$/.test(t)) {
      if (current.length) { paragraphs.push(current.join(" ")); current = []; }
      continue;
    }
    if (/\bhttps?:\/\//.test(t)) continue;
    current.push(stripMd(t));
  }
  if (current.length) paragraphs.push(current.join(" "));

  const good = paragraphs.filter(
    (p) => wordCount(p) >= 8 && !/^\d+[.)]/.test(p) && !/setup|installation|get started/i.test(p.slice(0, 60))
  );
  if (!good.length) return stripMd(readme.split("\n").slice(0, 3).join(" ")).slice(0, 300);

  let intro = good[0];
  for (let i = 1; i < good.length; i++) {
    if (wordCount(intro) >= 45) break;
    intro += " " + good[i];
  }
  intro = intro.split(/\s+-\s+(?=[A-Za-z])/)[0];
  intro = intro.split(/(?<=[.!?])\s+(?=[A-Z├└│])/).slice(0, 2).join(" ");
  if (intro.length <= 320) return intro.trim();
  return intro.slice(0, 320).replace(/\s+\S*$/, "").trimEnd() + "…";
}

export function fallbackDescription(repo, category, tech) {
  const bits = [];
  if (category !== "Other") bits.push(`A ${category.toLowerCase()}`);
  else bits.push(`A ${repo.language || "software"} project`);
  if (tech.length) bits.push(`built with ${tech.slice(0, 4).join(", ")}`);
  return `${bits.join(" ")}.`;
}

export function detectCategory(treeEntries, pkgJson, language) {
  const names = new Set(treeEntries.map((e) => e.split("/").pop()));
  const hasGradlePom = names.has("build.gradle") || names.has("pom.xml") || names.has("build.gradle.kts");
  if (hasGradlePom && names.has("plugin.yml")) return "Minecraft Plugin";
  if (names.has("fabric.mod.json")) return "Fabric Mod";
  if (pkgJson) {
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
    if (deps["discord.js"] || deps["discordeno"]) return "Discord Bot";
    if (deps["next"] || deps["react"]) return "Web App";
  }
  return "Other";
}

export function extractTechStack(treeEntries, pkgJson, fileContents, language) {
  const stack = new Set();
  if (language) stack.add(language);
  const names = new Set(treeEntries.map((e) => e.split("/").pop()));
  if (names.has("plugin.yml")) stack.add("Paper API");
  if (names.has("fabric.mod.json")) stack.add("Fabric API");
  if (pkgJson) {
    const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
    for (const dep of ["next", "react", "vue", "svelte", "express", "typescript", "discord.js", "discordeno", "tailwindcss", "vite"]) {
      if (deps[dep]) stack.add(dep === "tailwindcss" ? "Tailwind CSS" : dep);
    }
    if (deps["sqlite3"] || deps["better-sqlite3"]) stack.add("SQLite");
    if (deps["pg"] || deps["@supabase/supabase-js"]) stack.add("Supabase");
  }
  const gradle = fileContents["build.gradle"] || fileContents["build.gradle.kts"] || "";
  for (const m of gradle.matchAll(/(?:implementation|compileOnly|api)\s+(?:["']([^"']+)["']|["']([^"']+)["'])/g)) {
    const dep = m[1] || m[2] || "";
    if (/paper/i.test(dep)) stack.add("Paper API");
    else if (/spigot/i.test(dep)) stack.add("Spigot API");
    else if (/fabric/i.test(dep)) stack.add("Fabric API");
    else if (/sqlite/i.test(dep)) stack.add("SQLite");
    else if (/discord/i.test(dep)) stack.add("Discord");
  }
  const pom = fileContents["pom.xml"] || "";
  if (/<artifactId>paper-api<\/artifactId>/.test(pom)) stack.add("Paper API");
  if (/<artifactId>spigot-api<\/artifactId>/.test(pom)) stack.add("Spigot API");
  const cargo = fileContents["Cargo.toml"] || "";
  if (/sqlx|rusqlite/.test(cargo)) stack.add("SQLite");
  const reqs = fileContents["requirements.txt"] || "";
  for (const line of reqs.split("\n")) {
    const pkgName = line.trim().toLowerCase().replace(/[=<>~!].*/, "");
    if (pkgName && pkgName.length < 25) stack.add(pkgName);
  }
  return [...stack].slice(0, 10);
}

export function extractHighlights(readme) {
  if (!readme) return [];
  const bullets = readme
    .split("\n")
    .filter((l) => /^\s*[-*]\s+\S/.test(l))
    .map((l) => stripMd(l.replace(/^\s*[-*]\s+/, "")))
    .filter((l) => {
      const wc = wordCount(l);
      return wc >= 4 && wc <= 30 && !/http/i.test(l);
    });
  return bullets.slice(0, 3);
}

function parseJsonSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export class ProfileEngine {
  constructor({ token = process.env.GITHUB_TOKEN || "", cacheTtlMs = 6 * 3600_000 } = {}) {
    this.octokit = new Octokit(token ? { auth: token } : {});
    this.cacheTtlMs = cacheTtlMs;
    // Two cache layers: whole-profile responses and per-repo descriptions
    this.profileCache = new Map(); // key: user|offset -> {at, data}
    this.summaryCache = new Map(); // key: content-hash -> {at, description}
    this.inFlight = new Map(); // key: user|offset -> Promise (stampede de-dupe)
    this.warnedLowRate = false;
    this.octokit.hook.after("request", (response) => {
      const remaining = Number(response.headers["x-ratelimit-remaining"]);
      if (Number.isFinite(remaining) && remaining <= 5 && !this.warnedLowRate) {
        this.warnedLowRate = true;
        console.error(`[rate] GitHub quota nearly exhausted (${remaining} left). GITHUB_TOKEN raises limits to 5000/hr.`);
        setTimeout(() => { this.warnedLowRate = false; }, 60_000).unref();
      }
    });
  }

  async listRepos({ username, include, exclude }) {
    const all = [];
    for (let page = 1; page <= LIMITS.MAX_REPO_PAGES; page++) {
      const { data } = await this.octokit.repos.listForUser({
        username, type: "owner", sort: "pushed", per_page: 100, page,
      });
      all.push(...data);
      if (data.length < 100) break;
    }
    let selected = all.filter((r) => !r.fork && !r.private);
    if (exclude?.size) selected = selected.filter((r) => !exclude.has(r.name));
    if (include?.size) selected = selected.filter((r) => include.has(r.name));
    // already sorted by pushed desc from the API
    return { selected, totalRepos: all.length };
  }

  async repoDetail(repo) {
    const owner = repo.owner.login;
    const name = repo.name;
    const defaultBranch = repo.default_branch || "main";

    let treeEntries = [];
    try {
      const { data: tree } = await this.octokit.git.getTree({ owner, repo: name, tree_sha: defaultBranch, recursive: "true" });
      treeEntries = tree.tree.filter((t) => t.type === "blob").map((t) => t.path).slice(0, LIMITS.MAX_TREE_ENTRIES);
    } catch { /* tree fetch failure is non-fatal */ }

    let readme = "";
    try {
      const { data: readmeData } = await this.octokit.repos.getReadme({ owner, repo: name });
      readme = Buffer.from(readmeData.content, "base64").toString("utf8").slice(0, LIMITS.MAX_README_BYTES);
    } catch { /* 404 = no readme, non-fatal */ }

    const rootFiles = new Set(treeEntries);
    const fileContents = {};
    let pkgJson = null;

    const fetchFile = async (fname) => {
      try {
        const { data } = await this.octokit.repos.getContent({ owner, repo: name, path: fname });
        const raw = Buffer.from(data.content, "base64").toString("utf8").slice(0, LIMITS.MAX_FILE_BYTES);
        return raw;
      } catch {
        return null;
      }
    };

    const depFiles = ["build.gradle", "build.gradle.kts", "pom.xml", "Cargo.toml", "requirements.txt"];
    if (rootFiles.has("package.json")) {
      const raw = await fetchFile("package.json");
      if (raw !== null) { fileContents["package.json"] = raw; pkgJson = parseJsonSafe(raw); }
    }
    await Promise.all(depFiles.map(async (fname) => {
      if (!rootFiles.has(fname)) return;
      const raw = await fetchFile(fname);
      if (raw !== null) fileContents[fname] = raw;
    }));

    const category = detectCategory(treeEntries, pkgJson, repo.language);
    const techStack = extractTechStack(treeEntries, pkgJson, fileContents, repo.language);

    let commitCount90 = 0;
    let lastCommitAt = repo.pushed_at || repo.updated_at;
    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner, repo: name, sha: defaultBranch, since: new Date(Date.now() - COMMIT_WINDOW_DAYS * 86400000).toISOString(),
        per_page: LIMITS.MAX_COMMITS_PER_PAGE, page: 1,
      });
      commitCount90 = commits.length;
      if (commits.length) lastCommitAt = commits[0].commit.author.date;
    } catch { /* non-fatal */ }

    const descriptionKey = hashContent(["description-v4", repo.full_name || `${owner}/${name}`, readme, treeEntries.join("\n"), JSON.stringify(fileContents)]);
    let description;
    const cached = this.summaryCache.get(descriptionKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      description = cached.description;
    } else if (readme && wordCount(readme) > README_MIN_WORDS) {
      description = extractIntro(readme);
    } else {
      description = fallbackDescription(repo, category, techStack);
    }
    this.summaryCache.set(descriptionKey, { at: Date.now(), description });

    return {
      slug: slugify(name),
      name,
      repo_url: repo.html_url,
      category,
      tech_stack: techStack,
      description,
      status: statusFromLastCommit(lastCommitAt),
      last_commit_at: lastCommitAt,
      commit_count_90d: commitCount90,
      stars: repo.stargazers_count || 0,
      highlights: extractHighlights(readme),
      live_stats: null,
      manual_override: false,
    };
  }

  async generateProfile({ username, offset = 0, limit = LIMITS.MAX_REPOS_PER_PAGE, include, exclude }) {
    const key = `${username.toLowerCase()}|${offset}|${limit}|${[...(include || [])].sort().join(",")}|${[...(exclude || [])].sort().join(",")}`;
    const cached = this.profileCache.get(key);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) return cached.data;

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const work = (async () => {
      const { selected, totalRepos } = await this.listRepos({ username, include, exclude });
      const visible = selected.slice(offset, offset + limit);
      const projects = await Promise.all(visible.map((r) => this.repoDetail(r)));
      const statusOrder = { active: 0, maintained: 1, archived: 2 };
      projects.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return new Date(b.last_commit_at) - new Date(a.last_commit_at);
      });
      const data = {
        username,
        total_repos: selected.length,
        scanned_repos: totalRepos,
        offset,
        shown: projects.length,
        has_more: offset + limit < selected.length,
        next_offset: offset + limit < selected.length ? offset + limit : null,
        generated_at: new Date().toISOString(),
        projects,
      };
      this.profileCache.set(key, { at: Date.now(), data });
      return data;
    })();

    this.inFlight.set(key, work);
    try {
      return await work;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
