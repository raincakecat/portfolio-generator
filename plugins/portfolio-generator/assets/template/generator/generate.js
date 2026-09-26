import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { ProfileEngine, LIMITS } from "./lib.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
try { loadEnvFile(path.join(ROOT, ".env")); } catch (err) { if (err.code !== "ENOENT") throw err; }
const CONFIG_PATH = path.join(ROOT, "portfolio.config.json");
const CACHE_PATH = path.join(__dirname, "summary-cache.json");
const OUT_PATH = path.join(ROOT, "site", "src", "data", "projects.json");

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const user = config.github_user;
if (!user || typeof user !== "string") throw new Error("portfolio.config.json needs a github_user");

const engine = new ProfileEngine({ token: process.env.GITHUB_TOKEN });
// Seed the in-memory summary cache from disk so the CLI/CI runs stay cheap
try {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")))) {
    engine.summaryCache.set(k, { at: Date.now(), description: v.description });
  }
} catch { /* first run, no cache yet */ }

const { selected, totalRepos } = await engine.listRepos({
  username: user,
  include: new Set(config.include || []),
  exclude: new Set(config.exclude || []),
});
console.log(`${totalRepos} repos found, ${selected.length} included (limit ${LIMITS.MAX_REPO_PAGES * 100}).`);

const projects = [];
for (let i = 0; i < selected.length; i += LIMITS.MAX_REPOS_PER_PAGE) {
  const batch = selected.slice(i, i + LIMITS.MAX_REPOS_PER_PAGE);
  const batchProjects = await Promise.all(batch.map((r) => engine.repoDetail(r)));
  const manual = config.manual_overrides || {};
  for (const p of batchProjects) {
    const ov = manual[p.name] || {};
    for (const [k, v] of Object.entries(ov)) p[k] = v;
    p.manual_override = Object.keys(ov).length > 0;
    p.description = p.description.trim();
    projects.push(p);
  }
  console.log(`  ${Math.min(i + batch.length, selected.length)}/${selected.length}`);
}

projects.sort((a, b) => {
  const statusOrder = { active: 0, maintained: 1, inactive: 2, archived: 3 };
  if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
  return new Date(b.last_commit_at) - new Date(a.last_commit_at);
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({ generated_at: new Date().toISOString(), github_user: user, projects }, null, 2) + "\n");
fs.writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries([...engine.summaryCache].map(([k, v]) => [k, { v: 2, description: v.description, source: "cli" }])), null, 2));
console.log(`Wrote ${projects.length} projects to ${path.relative(ROOT, OUT_PATH)}`);
