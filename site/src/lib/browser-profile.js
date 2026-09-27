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

export async function fetchReadmeDetails(repo, request = fetch) {
  const owner = encodeURIComponent(repo.owner.login);
  const name = encodeURIComponent(repo.name);
  try {
    const response = await request(`https://api.github.com/repos/${owner}/${name}/readme`);
    if (!response.ok) return { intro: "", text: "" };
    const data = await response.json();
    if (data.encoding !== "base64" || !data.content) return { intro: "", text: "" };
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes).slice(0, 4000);
    return { intro: readmeIntro(text), text };
  } catch { return { intro: "", text: "" }; }
}

export async function fetchReadmeIntro(repo, request = fetch) {
  return (await fetchReadmeDetails(repo, request)).intro;
}
