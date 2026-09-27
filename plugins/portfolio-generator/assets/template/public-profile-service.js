import { categoryFor, fetchPublicRepos, fetchReadmeDetails, projectStatus, usefulDescription } from "./site/src/lib/browser-profile.js";

const PAGE_SIZE = 12;
const PAGE_TTL_MS = 60 * 60 * 1000;

export class PublicProfileService {
  constructor({ token = process.env.GITHUB_TOKEN || "", request = fetch, now = () => Date.now() } = {}) {
    this.token = token;
    this.request = request;
    this.now = now;
    this.repoCache = new Map();
    this.pageCache = new Map();
    this.inFlight = new Map();
    this.storage = {
      getItem: (key) => this.repoCache.get(key),
      setItem: (key, value) => {
        this.repoCache.set(key, value);
        if (this.repoCache.size > 500) this.repoCache.delete(this.repoCache.keys().next().value);
      },
    };
  }

  isCached(username, offset) {
    const hit = this.pageCache.get(`${username.toLowerCase()}|${offset}`);
    return !!(hit && this.now() - hit.at < PAGE_TTL_MS);
  }

  async githubRequest(url) {
    const headers = { "User-Agent": "portfolio-generator", Accept: "application/vnd.github+json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return this.request(url, { headers });
  }

  async generateProfile({ username, offset = 0 }) {
    const key = `${username.toLowerCase()}|${offset}`;
    const hit = this.pageCache.get(key);
    if (hit && this.now() - hit.at < PAGE_TTL_MS) return hit.data;
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const work = (async () => {
      const { repos, fetchedAt } = await fetchPublicRepos(username, {
        request: (url) => this.githubRequest(url), storage: this.storage, now: this.now(),
      });
      const visible = repos.slice(offset, offset + PAGE_SIZE);
      const projects = await Promise.all(visible.map(async (repo) => {
        let description = usefulDescription(repo.description) ? repo.description.trim() : "";
        let readme = "";
        if (!description) {
          const details = await fetchReadmeDetails(repo, this.request);
          readme = details.text;
          description = details.intro;
        }
        if (!description) description = "No project description is available.";
        let category = categoryFor(repo, description, "Software Project", readme);
        if (category === "Software Project" && !readme) {
          readme = (await fetchReadmeDetails(repo, this.request)).text;
          category = categoryFor(repo, description, "Software Project", readme);
        }
        return {
          name: repo.name,
          repo_url: repo.html_url,
          category,
          tech_stack: repo.language ? [repo.language] : [],
          description,
          status: projectStatus(repo),
          last_commit_at: repo.pushed_at,
          stars: repo.stargazers_count || 0,
        };
      }));
      const next = offset + visible.length;
      const data = {
        username, total_repos: repos.length, shown: visible.length,
        has_more: next < repos.length, next_offset: next < repos.length ? next : null,
        generated_at: new Date(fetchedAt).toISOString(), projects,
      };
      this.pageCache.set(key, { at: this.now(), data });
      if (this.pageCache.size > 1000) this.pageCache.clear();
      return data;
    })();
    this.inFlight.set(key, work);
    try { return await work; }
    finally { this.inFlight.delete(key); }
  }
}
