import assert from "node:assert/strict";
import test from "node:test";
import { ProfileEngine, extractIntro, slugify } from "../generator/lib.js";

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
