import { m } from "@/paraglide/messages";

export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  tags: string[];
  monogram: string;
}

export function getProjects(): Project[] {
  return [
    {
      id: "visio-illustrator",
      name: "Visio-Illustrator",
      description: m.projects_visio_description(),
      url: "https://github.com/TZ-mx/Visio-Illustrator",
      tags: ["TypeScript", ".NET", "MCP"],
      monogram: "VI",
    },
    {
      id: "enterprise-knowledge-base",
      name: "Enterprise Knowledge Base",
      description: m.projects_enterprise_knowledge_base_description(),
      url: "https://github.com/TZ-mx/Enterprise_Knowledge_Base",
      tags: ["Python", "RAG", "Gradio"],
      monogram: "KB",
    },
    {
      id: "chatbi-nanobot",
      name: "ChatBI-nanobot",
      description: m.projects_chatbi_description(),
      url: "https://github.com/TZ-mx/ChatBI-nanobot",
      tags: ["Python", "Agent", "SQLite"],
      monogram: "BI",
    },
  ];
}
