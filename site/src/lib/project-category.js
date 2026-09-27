// Shared by the Node generator and the browser lookup. Rules use evidence about
// the project's purpose before falling back to framework or language clues.
export const CATEGORY_COLORS = {
  "Minecraft Plugin": "#44bd32",
  "Fabric Mod": "#c0392b",
  "Discord Bot": "#5865f2",
  "MCP Server": "#ad72e8",
  "Flashcards": "#e7a03c",
  "Wiki": "#49a2df",
  "Desktop App": "#23a6a6",
  "Mobile App": "#23b59b",
  "Browser Extension": "#c985d9",
  "CLI Tool": "#e3a63d",
  "Library / SDK": "#9a8be0",
  "Licensing Tool": "#b68d62",
  "API / Backend": "#2c9eb8",
  "Web App": "#2980b9",
  "Developer Tool": "#738fee",
  "Game": "#dc7180",
  "Learning Resource": "#c69c63",
  "Data / ML": "#c87bb2",
  "Automation": "#a784d5",
  "Documentation": "#94a3b8",
  "Software Project": "#7f8c8d",
  Other: "#7f8c8d",
};

export function classifyProject({ name = "", description = "", readme = "", topics = [], treeEntries = [], dependencies = {} } = {}) {
  const files = new Set(treeEntries.map((path) => path.split("/").pop()?.toLowerCase()));
  const deps = new Set(Object.keys(dependencies).map((dep) => dep.toLowerCase()));
  const text = [name.replace(/[-_]/g, " "), description, readme, ...topics].join(" ").toLowerCase();
  const has = (pattern) => pattern.test(text);

  if (files.has("fabric.mod.json") || has(/\bfabric(?:\s|-)?mod\b|\bfabric api\b/)) return "Fabric Mod";
  if (files.has("plugin.yml") || has(/\bminecraft(?:\s|-)?plugin\b|\bpaper(?:\s|-)?plugin\b|\bspigot plugin\b/)) return "Minecraft Plugin";
  if (deps.has("discord.js") || deps.has("discordeno") || has(/\bdiscord(?:\s|-)?bot\b|\bdiscord\.js\b/)) return "Discord Bot";
  if (has(/\bmodel context protocol\b|\bmcp(?:\s|-)?server\b|^mcp\s/)) return "MCP Server";
  if (has(/\bflashcards?\b|\banki\b|\bspaced repetition\b/)) return "Flashcards";
  if (has(/\bwiki\b|\bknowledge base\b/)) return "Wiki";
  if (has(/\bbrowser extension\b|\bchrome extension\b|\bfirefox add[ -]?on\b/)) return "Browser Extension";
  if (has(/\bdesktop app\b|\bmac(?:os)? app\b|\bapp for mac\b|\bwindows app\b|\belectron app\b|\btauri app\b/)) return "Desktop App";
  if (has(/\bmobile app\b|\bios app\b|\bandroid app\b|\breact native\b|\bflutter app\b/)) return "Mobile App";
  if (has(/\bcommand[ -]?line\b|\bcli(?: tool| app)?\b|\bterminal app\b/)) return "CLI Tool";
  if (has(/\bsoftware licens(?:e|ing)\b|\blicens(?:e|ing) framework\b|\blicense management\b/)) return "Licensing Tool";
  if (has(/\bsdk\b|\bapi wrapper\b|\bclient library\b|\bsoftware library\b|\bruby gem\b/)) return "Library / SDK";
  if (has(/\bapi server\b|\brest(?:ful)? api\b|\bgraphql api\b|\bbackend(?: service)?\b/)) return "API / Backend";
  if (has(/\bgame\b|\bunity game\b|\bgodot game\b/)) return "Game";
  if (has(/\bmachine learning\b|\bdata science\b|\bdataset\b|\bdata pipeline\b|\bai model\b/)) return "Data / ML";
  if (has(/\bautomation\b|\bworkflow automation\b|\bautomates?\b/)) return "Automation";
  if (has(/\bkoans\b|\btutorial\b|\blearning resource\b|\bcourse material\b/)) return "Learning Resource";
  if (has(/\bdocumentation\b|\bdocs site\b|\breference guide\b/)) return "Documentation";
  if (has(/\bweb app\b|\bweb application\b|\bwebsite\b|\bportfolio\b|\bdashboard\b|\bstatic site\b|\bweb widget\b/) || ["next", "react", "vue", "svelte", "astro"].some((dep) => deps.has(dep))) return "Web App";
  if (has(/\bdeveloper tool\b|\butility\b|\bcode generator\b|\bproject generator\b/)) return "Developer Tool";
  return "Software Project";
}
