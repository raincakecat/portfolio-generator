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
    .filter((p) => p.split(/\s+/).length >= 8 && !/^(?:install|setup|getting started|download)\b/i.test(p));
  const first = paragraphs[0] || "";
  const intro = first.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, 2).join(" ").trim();
  return intro.length > 320 ? intro.slice(0, 320).replace(/\s+\S*$/, "").trimEnd() + "…" : intro;
}

export function categoryFor(repo, description, existing = "Other") {
  if (existing && existing !== "Other") return existing;
  const text = [repo.name, repo.description, ...(repo.topics || []), description].join(" ").toLowerCase();
  if (/fabric(?:\s|-)?mod|fabric api/.test(text)) return "Fabric Mod";
  if (/minecraft(?:\s|-)?plugin|paper(?:\s|-)?plugin|spigot/.test(text)) return "Minecraft Plugin";
  if (/discord(?:\s|-)?bot|discord\.js/.test(text)) return "Discord Bot";
  if (/web(?:\s|-)?app|website|astro|next\.js/.test(text)) return "Web App";
  return "Other";
}

export function projectStatus(repo, now = Date.now()) {
  if (repo.archived) return "archived";
  const days = (now - new Date(repo.pushed_at).getTime()) / 86400000;
  if (days <= 60) return "active";
  return days <= 365 ? "maintained" : "inactive";
}

export async function fetchReadmeIntro(repo, request = fetch) {
  const owner = encodeURIComponent(repo.owner.login);
  const name = encodeURIComponent(repo.name);
  try {
    const response = await request(`https://api.github.com/repos/${owner}/${name}/readme`);
    if (!response.ok) return "";
    const data = await response.json();
    if (data.encoding !== "base64" || !data.content) return "";
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
    return readmeIntro(new TextDecoder().decode(bytes));
  } catch { return ""; }
}
