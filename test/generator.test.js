import assert from "node:assert/strict";
import test from "node:test";
import { ProfileEngine, extractIntro, slugify, statusFromLastCommit } from "../generator/lib.js";
import { categoryFor, fetchPublicRepos, fetchReadmeDetails, fetchReadmeIntro, projectStatus, usefulDescription } from "../site/src/lib/browser-profile.js";
import { classifyProject } from "../site/src/lib/project-category.js";
import { PublicProfileService } from "../public-profile-service.js";

test("repository slugs remain unique across GitHub punctuation", () => {
  const names = ["foo-bar", "foo.bar", "foo_bar"];
  const slugs = names.map(slugify);
  assert.equal(new Set(slugs).size, names.length);
  assert.ok(slugs.every((slug) => /^[a-z0-9-]+$/.test(slug)));
});

test("README introduction keeps version numbers and excludes list items", () => {
  const intro = extractIntro(
    "# Project\n\nA Paper 1.21.11 plugin for tournament events with a complete setup guide.\n" +
    "- Install the first dependency before you run this server.\n" +
    "- Configure the second dependency before you start the app.\n"
  );
  assert.match(intro, /1\.21\.11/);
  assert.doesNotMatch(intro, /Install the first/);
});

test("short READMEs identify a project's purpose and category", async () => {
  const markdown = "# Cat Tiers Tagger\n\nA Fabric mod that displays player combat tiers and gamemode icons on nametags in Minecraft.\n\n## Install\nCopy the JAR into your mods folder.";
  const repo = { owner: { login: "raincakecat" }, name: "Cat-Tiers-Tier-Tagger", default_branch: "main", topics: [] };
  const request = async () => ({ ok: true, text: async () => markdown });
  const description = await fetchReadmeIntro(repo, request);
  assert.match(description, /displays player combat tiers/);
  assert.equal(categoryFor(repo, description), "Fabric Mod");
  assert.equal(classifyProject({ readme: markdown }), "Fabric Mod");
  assert.equal(usefulDescription("A Java project."), false);
  assert.equal(usefulDescription(description), true);
});

test("a short README can classify a repository with no GitHub description", async () => {
  const repo = { owner: { login: "nickyleach" }, name: "OSTSurvey", default_branch: "main", topics: [], description: null };
  const request = async () => ({ ok: true, text: async () => "# OSTSurvey\n\nA tool to create surveys\n\n## Basic Goals\nUsers can vote." });
  const intro = await fetchReadmeIntro(repo, request);
  assert.equal(intro, "A tool to create surveys");
  assert.equal(categoryFor(repo, intro), "Survey App");
});

test("a vague description can use README details for its project type", async () => {
  const repo = { owner: { login: "nickyleach" }, name: "phpnimble", default_branch: "main", topics: [], description: "PHPNimble. Like PHPSpry but more nimble" };
  const request = async () => ({ ok: true, text: async () => "# PHPNimble\n\nPHPNimble. Like PHPSpry but more nimble.\n\nRoute all requests through the routing script in index.php." });
  const details = await fetchReadmeDetails(repo, request);
  assert.equal(categoryFor(repo, repo.description, "Software Project", details.text), "Package / Framework");
});

test("public README files classify projects without using GitHub API quota", async () => {
  const requests = [];
  const repo = { owner: { login: "nicoloboschi" }, name: "tichit", default_branch: "main" };
  const details = await fetchReadmeDetails(repo, async (url) => {
    requests.push(url);
    return { ok: true, text: async () => "# Tichit\n\nA macOS menu-bar app that improves your English." };
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(categoryFor(repo, details.intro, "Software Project", details.text), "Desktop App");
});

test("a missing README never spends a GitHub API request", async () => {
  const urls = [];
  const repo = { owner: { login: "example" }, name: "empty", default_branch: "main" };
  const details = await fetchReadmeDetails(repo, async (url) => { urls.push(url); return { ok: false, status: 404 }; });
  assert.deepEqual(details, { intro: "", text: "" });
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.startsWith("https://raw.githubusercontent.com/")));
});

test("browser repository cache avoids repeat requests and survives a rate limit", async () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const repos = [{ name: "one", fork: false, private: false }];
  let calls = 0;
  const request = async () => { calls++; return { ok: true, json: async () => repos }; };
  const first = await fetchPublicRepos("Example", { request, storage, now: 1000 });
  const second = await fetchPublicRepos("example", { request, storage, now: 2000 });
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  const limited = await fetchPublicRepos("example", {
    request: async () => ({ ok: false, status: 403 }), storage, now: 2 * 60 * 60 * 1000,
  });
  assert.deepEqual(limited.repos, repos);
  assert.equal(limited.fetchedAt, 1000);
});

test("hosted lookup shares one repository request across repeat visitors", async () => {
  const urls = [];
  const repo = {
    name: "browser-terminal", owner: { login: "sample" }, default_branch: "main",
    description: "A terminal in your browser", language: "TypeScript", pushed_at: "2026-09-01T00:00:00Z",
    html_url: "https://github.com/sample/browser-terminal", stargazers_count: 2,
  };
  const service = new PublicProfileService({ token: "", now: () => 1000, request: async (url) => {
    urls.push(url);
    if (url.includes("api.github.com")) return { ok: true, json: async () => [repo] };
    return { ok: false, status: 404 };
  } });
  const first = await service.generateProfile({ username: "sample" });
  const second = await service.generateProfile({ username: "sample" });
  assert.equal(first.projects[0].category, "Browser Terminal");
  assert.deepEqual(second, first);
  assert.equal(urls.filter((url) => url.includes("api.github.com")).length, 1);
  assert.ok(service.isCached("sample", 0));
});

test("project categories identify the purpose shown in repository descriptions", () => {
  const cases = [
    ["decks", "A source-controlled collection of Bible-knowledge flashcards, built into one canonical Anki package.", "Flashcards"],
    ["anachronist-wiki", "Static-first, Git-backed technology tree wiki.", "Wiki"],
    ["diskspice", "the delightful disk space app for mac", "Desktop App"],
    ["mcp-wizzypedia", "A Model Context Protocol (MCP) server for interacting with the Wizzpedia APIs.", "MCP Server"],
    ["dotta-license", "ERC721-based Software Licensing Framework", "Licensing Tool"],
    ["cloudability", "Cloudability API wrapper for node.js", "Library / SDK"],
    ["fifttt", "A fake IFTTT service", "Automation"],
    ["dotfiles", "Configuration files for a happy developer", "Configuration"],
    ["OSTSurvey", "The system should handle multiple users and associate surveys and votes with a logged in user.", "Survey App"],
    ["OSS-Match", "Tool for matching developers to open source projects based on coding styles", "Developer Tool"],
    ["shell-scripts", "Collection of miscellaneous shell scripts", "Script Collection"],
    ["jQuery.bindLast", "Binds events to be triggered after other events", "Library / SDK"],
    ["yql-php", "YQL wrapper class for PHP", "Library / SDK"],
    ["Linkify", "Coffeescript class that detects URLs in a string and wraps them in hrefs.", "Library / SDK"],
    ["sheepit", "Your machine, anywhere. A full-featured terminal in your browser.", "Browser Terminal"],
    ["my-skills", "Agent skills for software engineering work", "Skills Collection"],
    ["tichit", "macOS menu bar app that rewrites your English natively", "Desktop App"],
    ["seo-booster", "", "SEO Tool"],
    ["gh-stars", "A repository-owned, embeddable GitHub star-history chart.", "Data Visualization"],
    ["pgvector_compiled", "Precompiled OS packages for pgvector", "Binary Package"],
    ["blog", "A personal blog built with Hugo", "Blog"],
    ["localmaxxing", "Benchmark modern open-source LLMs on the MLX backend", "Benchmark"],
    ["homebrew-tap", "Homebrew tap for Hindsight", "Package Repository"],
    ["hindsight-desktop", "A macOS/Windows/Linux menu-bar app", "Desktop App"],
    ["sda-factory", "A local UI to build and run a fleet of Self-Driving Agents", "Agent Tool"],
    ["pgdoctor", "A pre-configured Postgres-in-docker for performance debugging", "Database Tool"],
    ["dockerpyze", "Python applications to Docker, automatically", "Developer Tool"],
    ["mentor", "An interactive AI-powered learning platform", "Learning App"],
    ["pulsar-io-google-pubsub", "A connector for copying data between Pub/Sub and Pulsar", "Integration"],
    ["plain-project", "", "Software Project"],
  ];
  for (const [name, description, expected] of cases) {
    assert.equal(classifyProject({ name, description }), expected, name);
    assert.equal(categoryFor({ name, description, topics: [] }, description), expected, name);
  }
  assert.equal(classifyProject({ treeEntries: ["src/main/resources/fabric.mod.json"], description: "A mod" }), "Fabric Mod");
  assert.equal(classifyProject({ dependencies: { "discord.js": "^14" }, description: "A bot" }), "Discord Bot");
  assert.equal(categoryFor({ name: "vague", description: "A PHP project", topics: [] }, "A PHP project", "Software Project", "A framework for PHP projects."), "Package / Framework");
  assert.equal(classifyProject({ name: "maven-npm", description: "A simple Maven Web Application", readme: "Configuration files are explained later in the guide." }), "Web App");
  assert.equal(classifyProject({ name: "mentor", readme: "An AI-powered learning platform. Later it can also create surveys." }), "Learning App");
});

test("old repositories remain readable without being labeled GitHub archived", () => {
  const oldDate = "2020-01-01T00:00:00Z";
  assert.equal(statusFromLastCommit(oldDate, false), "inactive");
  assert.equal(statusFromLastCommit(oldDate, true), "archived");
  assert.equal(projectStatus({ pushed_at: oldDate, archived: false }), "inactive");
  assert.equal(projectStatus({ pushed_at: oldDate, archived: true }), "archived");
});

test("profile cache normalizes username and keeps filter choices separate", async () => {
  const engine = new ProfileEngine();
  let scans = 0;
  engine.listRepos = async ({ include }) => {
    scans++;
    const repos = [{ name: "one" }, { name: "two" }];
    return { selected: include?.size ? repos.filter((repo) => include.has(repo.name)) : repos, totalRepos: 2 };
  };
  engine.repoDetail = async (repo) => ({
    name: repo.name, status: "active", last_commit_at: "2026-01-01T00:00:00Z",
  });

  await engine.generateProfile({ username: "Example" });
  await engine.generateProfile({ username: "example" });
  assert.equal(scans, 1);
  const filtered = await engine.generateProfile({ username: "example", include: new Set(["one"]) });
  assert.equal(scans, 2);
  assert.deepEqual(filtered.projects.map((p) => p.name), ["one"]);
});
