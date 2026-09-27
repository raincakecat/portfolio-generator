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
  "Configuration": "#8ca0ae",
  "Script Collection": "#d2a85e",
  "Survey App": "#5aa9cc",
  "Integration": "#c292ca",
  "Web Service": "#4da9ae",
  "Package / Framework": "#a48cda",
  "Browser Terminal": "#43a6bf",
  "Skills Collection": "#a68ae0",
  "SEO Tool": "#75b763",
  "Data Visualization": "#64a7dc",
  "Binary Package": "#a28bc4",
  "Blog": "#ca9b6b",
  "Package Repository": "#b89a65",
  "Benchmark": "#cd8c69",
  "Agent Tool": "#7895e2",
  "Database Tool": "#66b3ac",
  "Video Project": "#d388a0",
  "Resource Collection": "#bd9b6d",
  "Network Tool": "#6eacbc",
  "GitHub Action": "#8ca6d6",
  "Project Generator": "#aa91dc",
  "Voice Assistant": "#b183c4",
  "Data Export Tool": "#7badb8",
  "Workflow Collection": "#aaa0d1",
  "Learning App": "#c59472",
  "Software Project": "#7f8c8d",
  Other: "#7f8c8d",
};

export function classifyProject({ name = "", description = "", readme = "", topics = [], treeEntries = [], dependencies = {} } = {}) {
  const files = new Set(treeEntries.map((path) => path.split("/").pop()?.toLowerCase()));
  const deps = new Set(Object.keys(dependencies).map((dep) => dep.toLowerCase()));
  const words = name.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[-_.]/g, " ");
  const primary = [name, words, description, ...topics].join(" ").toLowerCase();
  const named = (pattern) => pattern.test(words.toLowerCase());
  const classify = (text) => {
  const has = (pattern) => pattern.test(text);

  if (files.has("fabric.mod.json") || has(/\bfabric(?:\s|-)?mod\b|\bfabric api\b/)) return "Fabric Mod";
  if (files.has("plugin.yml") || has(/\bminecraft(?:\s|-)?plugin\b|\bpaper(?:\s|-)?plugin\b|\bspigot plugin\b/)) return "Minecraft Plugin";
  if (deps.has("discord.js") || deps.has("discordeno") || has(/\bdiscord(?:\s|-)?bot\b|\bdiscord\.js\b/)) return "Discord Bot";
  if (has(/\bmodel context protocol\b|\bmcp(?:\s|-)?server\b|^mcp[-_\s]/)) return "MCP Server";
  if (named(/^homebrew\b/) || has(/\bhomebrew[- ]tap\b|\b(?:apt|yum|brew) package repository\b/)) return "Package Repository";
  if (has(/\bprecompiled (?:os )?packages?\b|\bcompiled binaries\b|\bprebuilt binaries\b/)) return "Binary Package";
  if (has(/\bpython applications? to docker\b|\bdockeriz(?:e|ation)\b/)) return "Developer Tool";
  if (has(/\bgithub action to\b|\bgithub action that\b|\bthis action (?:creates?|deletes?|deploys?|builds?)\b/) || named(/\bgithub actions?\b/) && has(/\baction\b/)) return "GitHub Action";
  if (has(/\b(?:remotion|video editing|promotional videos?|video production)\b/) || named(/\bvideo(?:maker|s)?\b/)) return "Video Project";
  if (named(/^awesome\b/) || has(/\bcollection of (?:[\w-]+ )?(?:best practices|notebooks|resources|links)\b|\bcurated list of\b/)) return "Resource Collection";
  if (has(/\bproxy rotation\b|\banonymous web requests\b|\bnetwork diagnostic\b/)) return "Network Tool";
  if (named(/^create\b.+\bapp\b/) || has(/\bapp scaffolder\b|\bproject scaffolder\b|\bproject generator\b/)) return "Project Generator";
  if (has(/\bvoice[- ]to[- ]voice chatbot\b|\bvoice assistant\b|\bspoken conversation(?:al)? agent\b/)) return "Voice Assistant";
  if (named(/\bexporter\b/) || has(/\bexport (?:git|data|logs?|records?) to (?:excel|csv|json)\b/)) return "Data Export Tool";
  if (named(/\bflows\b/) && has(/\blangflow\b|\bworkflow\b/)) return "Workflow Collection";
  if (has(/\b(?:postgres|postgresql|mysql|sqlite|database)\b/) && has(/\bperformance debugging\b|\bquery profiling\b|\bdatabase (?:diagnostic|monitoring|administration)\b/)) return "Database Tool";
  if (has(/\bai[- ]powered learning (?:platform|app|companion)\b|\badaptive learning (?:platform|app)\b/)) return "Learning App";
  if (has(/\bvisual inspector\b|\binteractive inspector\b/)) return "Data Visualization";
  if (has(/\bterminal in (?:your|the|a) browser\b|\bbrowser[- ]based terminal\b|\bweb[- ]based terminal\b|\bbrowser terminal\b/)) return "Browser Terminal";
  if (has(/\b(?:agent|codex|claude) skills?\b|\bskills collection\b|\bcollection of (?:coding )?agent skills\b/)) return "Skills Collection";
  if (has(/\bself[- ]driving agents?\b|\bagent management (?:ui|app|tool)\b|\bui to (?:build|manage|run) (?:ai )?agents?\b/)) return "Agent Tool";
  if (has(/\bseo(?:[- ]|$)|\bsearch engine optimi[sz]ation\b/)) return "SEO Tool";
  if (has(/\bstar[- ]history chart\b|\b(?:interactive|embeddable|analytics) (?:github )?(?:chart|graph|visualization)\b|\bdata visuali[sz]ation\b/)) return "Data Visualization";
  if (has(/\bbenchmarks?\b|\bbenchmarking suite\b|\bperformance comparisons?\b/)) return "Benchmark";
  if (has(/\b(?:personal|technical|developer) blog\b|\bblog built with\b|^blog\b/)) return "Blog";
  if (has(/\b(?:this is just |this is |an? )?example to show\b|\bexample that shows\b/)) return "Learning Resource";
  if (named(/\bexamples?\b|\bdemo\b/) || has(/\b(?:catalog|collection) of (?:end[- ]to[- ]end )?examples\b/)) return "Learning Resource";
  if (named(/\bplayground\b|\bvalidation tool\b|\bhelpers?\b|\btool\b/)) return "Developer Tool";
  if (named(/\bragstack\b/) || has(/\bretrieval[- ]augmented generation\b/)) return "Data / ML";
  if (has(/\bflashcards?\b|\banki\b|\bspaced repetition\b/)) return "Flashcards";
  if (has(/\bwiki\b|\bknowledge base\b/)) return "Wiki";
  if (has(/\bdotfiles?\b|\bconfiguration files?\b|\bconfig(?:uration)? (?:repo|repository|collection)\b/)) return "Configuration";
  if (has(/\bshell scripts?\b|\bscript collection\b|\bcollection of (?:miscellaneous )?scripts?\b/)) return "Script Collection";
  if (has(/\bsurveys?\b|\bpolls?\b|\bvoting app\b|\bvoting system\b/)) return "Survey App";
  if (has(/\bbrowser extension\b|\bchrome extension\b|\bfirefox add[ -]?on\b/)) return "Browser Extension";
  if (has(/\bdesktop app\b|\bmac(?:os)? app\b|\bapp for mac\b|\bwindows app\b|\belectron app\b|\btauri app\b|\bmenu[- ]bar app\b/)) return "Desktop App";
  if (has(/\bmobile app\b|\bios app\b|\bandroid app\b|\breact native\b|\bflutter app\b/)) return "Mobile App";
  if (has(/\bcommand[ -]?line\b|\bcli(?: tool| app)?\b|\bterminal app\b/)) return "CLI Tool";
  if (has(/\bsoftware licens(?:e|ing)\b|\blicens(?:e|ing) framework\b|\blicense management\b/)) return "Licensing Tool";
  if (has(/\bsdk\b|\bapi wrapper\b|\bwrapper (?:class|for|around)\b|\bclient library\b|\bsoftware library\b|\bruby gem\b|\b(?:javascript|jquery|php|python|ruby|node(?:\.js)?) (?:library|plugin|package|module)\b|\b(?:library|package|module) for (?:javascript|jquery|php|python|ruby|node(?:\.js)?)\b|\b(?:coffeescript|javascript|typescript|java|php|python|ruby) class (?:that|for)\b|\bjquery[. -]/)) return "Library / SDK";
  if (has(/\b(?:framework|microframework) for (?:php|ruby|python|node)\b|\b(?:php|ruby|python|node) (?:framework|microframework)\b/)) return "Package / Framework";
  if (has(/\b(?:php|ruby|python)\b/) && has(/\brouting script\b|\brouting engine\b|\b(?:simple|lightweight) router\b/)) return "Package / Framework";
  if (has(/\bapi server\b|\brest(?:ful)? api\b|\bgraphql api\b|\bbackend(?: service)?\b/)) return "API / Backend";
  if (has(/\b(?:ifttt|zapier)\b|\btrigger(?:s|ed)? (?:an? )?(?:action|event|workflow)\b|\bwebhook automation\b/)) return "Automation";
  if (has(/\b(?:integration|connector) (?:for|with|between)\b|\bintegrat(?:e|es|ing) (?:with|two)\b|\b(?:data|messages?) between [^.!?]{0,80} (?:and|to)\b/)) return "Integration";
  if (has(/\bgame\b|\bunity game\b|\bgodot game\b/)) return "Game";
  if (has(/\bmachine learning\b|\bdata science\b|\bdataset\b|\bdata pipeline\b|\bai model\b/)) return "Data / ML";
  if (has(/\bautomation\b|\bworkflow automation\b|\bautomates?\b/)) return "Automation";
  if (has(/\bkoans\b|\btutorial\b|\blearning resource\b|\bcourse material\b/)) return "Learning Resource";
  if (has(/\bdocumentation\b|\bdocs site\b|\breference guide\b/)) return "Documentation";
  if (has(/\bweb app\b|\bweb application\b|\bweb interface\b|\bwebsite\b|\bportfolio\b|\bdashboard\b|\bstatic site\b|\bweb widget\b/) || ["next", "react", "vue", "svelte", "astro"].some((dep) => deps.has(dep))) return "Web App";
  if (has(/\bdeveloper tool\b|\btool for (?:matching|finding|analyzing|managing|building|testing|generating)\b|\butility\b|\bcode generator\b|\bproject generator\b/)) return "Developer Tool";
  if (has(/\bweb service\b|\bhosted service\b|\bsaas\b/)) return "Web Service";
  return "Software Project";
  };
  const fromMetadata = classify(primary);
  if (fromMetadata !== "Software Project") return fromMetadata;
  return classify(`${primary} ${readme.slice(0, 1500).toLowerCase()}`);
}
