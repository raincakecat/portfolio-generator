import { classifyProject } from "./project-category.js";

export function usefulDescription(value) {
  const text = String(value || "").trim();
  return text.length >= 24 && !/^a (?:.+ project|.+ built with .+)\.$/i.test(text);
}

export function readmeIntro(markdown) {
  const clean = String(markdown || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_]/g, "");
  const paragraphs = clean.split(/\n\s*\n/)
    .map((p) => p.split("\n").map((line) => line.trim()).filter((line) =>
      line && !/^(?:#|\||[-*+]\s|\d+[.)]\s|---)/.test(line)
    ).join(" ").replace(/\s+/g, " ").trim())
    .filter((p) => p.split(/\s+/).length >= 4 && p.length >= 18 && !/^(?:install|setup|getting started|download)\b/i.test(p));
  const first = paragraphs[0] || "";
  const intro = first.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, 2).join(" ").trim();
  return intro.length > 320 ? intro.slice(0, 320).replace(/\s+\S*$/, "").trimEnd() + "…" : intro;
}

export function categoryFor(repo, description, existing = "Other", readme = "") {
  if (existing && existing !== "Other" && existing !== "Software Project") return existing;
  return classifyProject({ name: repo.name, description: [repo.description, description].filter(Boolean).join(" "), readme, topics: repo.topics || [] });
}

export function projectStatus(repo, now = Date.now()) {
  if (repo.archived) return "archived";
  const days = (now - new Date(repo.pushed_at).getTime()) / 86400000;
  if (days <= 60) return "active";
  return days <= 365 ? "maintained" : "inactive";
}

const REPO_CACHE_PREFIX = "portfolio-generator:repos:v1:";
const REPO_CACHE_FRESH_MS = 30 * 60 * 1000;
const REPO_CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchPublicRepos(username, { request = fetch, storage, now = Date.now() } = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const key = REPO_CACHE_PREFIX + username.toLowerCase();
  let cached = null;
  try {
    const data = JSON.parse(storage?.getItem(key) || "null");
    if (data && Number.isFinite(data.savedAt) && Array.isArray(data.repos) && now - data.savedAt < REPO_CACHE_STALE_MS) cached = data;
  } catch { /* Storage may be disabled or full. */ }
  if (cached && now - cached.savedAt < REPO_CACHE_FRESH_MS) {
    return { repos: cached.repos, fetchedAt: cached.savedAt };
  }

  try {
    const all = [];
    for (let page = 1; page <= 3; page++) {
      const response = await request(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
      if (!response.ok) {
        const error = new Error("GitHub request failed");
        error.status = response.status;
        throw error;
      }
      const repos = await response.json();
      all.push(...repos.filter((repo) => !repo.fork && !repo.private));
      if (repos.length < 100) break;
    }
    try { storage?.setItem(key, JSON.stringify({ savedAt: now, repos: all })); } catch { /* Caching is optional. */ }
    return { repos: all, fetchedAt: now };
  } catch (error) {
    if (cached && (error.status === 403 || error.status === 429 || !error.status)) {
      return { repos: cached.repos, fetchedAt: cached.savedAt };
    }
    throw error;
  }
}

export async function fetchReadmeDetails(repo, request = fetch) {
  const owner = encodeURIComponent(repo.owner.login);
  const name = encodeURIComponent(repo.name);
  const details = (text) => {
    const sample = text.slice(0, 4000);
    return { intro: readmeIntro(sample), text: sample };
  };
  if (repo.default_branch) {
    const branch = encodeURIComponent(repo.default_branch);
    for (const filename of ["README.md", "readme.md", "Readme.md", "README.MD", "README.markdown", "README.rst", "README.txt", "README"]) {
      try {
        const response = await request(`https://raw.githubusercontent.com/${owner}/${name}/${branch}/${filename}`);
        if (response.ok) return details(await response.text());
      } catch { /* Try another common README name. */ }
    }
  }
  return { intro: "", text: "" };
}

export async function fetchReadmeIntro(repo, request = fetch) {
  return (await fetchReadmeDetails(repo, request)).intro;
}
