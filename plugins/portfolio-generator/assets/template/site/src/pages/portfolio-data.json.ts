import projectsData from "../data/projects.json";

export function GET() {
  const { github_user, generated_at, projects } = projectsData;
  return new Response(JSON.stringify({
    github_user,
    generated_at,
    projects: projects.map(({ name, description, category, tech_stack }) => ({
      name, description, category, tech_stack,
    })),
  }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
