import assert from "node:assert/strict";
import test from "node:test";
import { ProfileEngine, extractIntro, slugify, statusFromLastCommit } from "../generator/lib.js";
import { categoryFor, fetchReadmeIntro, projectStatus, usefulDescription } from "../site/src/lib/browser-profile.js";
import { classifyProject } from "../site/src/lib/project-category.js";

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
  const repo = { owner: { login: "raincakecat" }, name: "Cat-Tiers-Tier-Tagger", topics: [] };
  const request = async () => ({ ok: true, json: async () => ({ encoding: "base64", content: Buffer.from(markdown).toString("base64") }) });
  const description = await fetchReadmeIntro(repo, request);
  assert.match(description, /displays player combat tiers/);
  assert.equal(categoryFor(repo, description), "Fabric Mod");
  assert.equal(classifyProject({ readme: markdown }), "Fabric Mod");
  assert.equal(usefulDescription("A Java project."), false);
  assert.equal(usefulDescription(description), true);
});

test("project categories identify the purpose shown in repository descriptions", () => {
  const cases = [
    ["decks", "A source-controlled collection of Bible-knowledge flashcards, built into one canonical Anki package.", "Flashcards"],
    ["anachronist-wiki", "Static-first, Git-backed technology tree wiki.", "Wiki"],
    ["diskspice", "the delightful disk space app for mac", "Desktop App"],
    ["mcp-wizzypedia", "A Model Context Protocol (MCP) server for interacting with the Wizzpedia APIs.", "MCP Server"],
    ["dotta-license", "ERC721-based Software Licensing Framework", "Licensing Tool"],
    ["cloudability", "Cloudability API wrapper for node.js", "Library / SDK"],
    ["plain-project", "", "Software Project"],
  ];
  for (const [name, description, expected] of cases) {
    assert.equal(classifyProject({ name, description }), expected, name);
    assert.equal(categoryFor({ name, description, topics: [] }, description), expected, name);
  }
  assert.equal(classifyProject({ treeEntries: ["src/main/resources/fabric.mod.json"], description: "A mod" }), "Fabric Mod");
  assert.equal(classifyProject({ dependencies: { "discord.js": "^14" }, description: "A bot" }), "Discord Bot");
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
