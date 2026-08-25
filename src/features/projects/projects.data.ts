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
    {
      id: "academic-paper-plugin",
      name: "Academic Paper Plugin",
      description: m.projects_academic_paper_plugin_description(),
      url: "https://github.com/TZ-mx/Academic-Paper-Plugin",
      tags: ["Codex", "Claude Code", "LaTeX"],
      monogram: "AP",
    },
    {
      id: "intelligent-tender-document-generation",
      name: "Intelligent Tender Document Generation",
      description: m.projects_intelligent_tender_description(),
      url: "https://github.com/TZ-mx/Intelligent-tender-document-generation",
      tags: ["React", "Electron", "DOCX"],
      monogram: "TD",
    },
    {
      id: "enterprise-intelligent-recommendation",
      name: "Enterprise Intelligent Recommendation",
      description: m.projects_enterprise_recommendation_description(),
      url: "https://github.com/TZ-mx/Enterprise-Intelligent-Recommendation",
      tags: ["Python", "LangGraph", "FastAPI"],
      monogram: "ER",
    },
    {
      id: "llm-distillation-finetuning-cases",
      name: "LLM Fine-Tuning Cases",
      description: m.projects_llm_finetuning_cases_description(),
      url: "https://github.com/TZ-mx/llm-distillation-finetuning-cases",
      tags: ["Python", "Qwen", "Fine-Tuning"],
      monogram: "FT",
    },
  ];
}
