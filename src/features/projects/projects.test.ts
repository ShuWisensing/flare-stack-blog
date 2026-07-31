import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getPublicNavOptions } from "@/features/theme/public-navigation";
import { ProjectsPage as DefaultProjectsPage } from "@/features/theme/themes/default/pages/projects/page";
import { ProjectsPage as FuwariProjectsPage } from "@/features/theme/themes/fuwari/pages/projects/page";
import { getProjects } from "./projects.data";
import { getProjectsSeo } from "./projects.seo";

describe("projects", () => {
  it("仅返回当前选定的六个开源项目", () => {
    const projects = getProjects();

    expect(
      projects.map(({ id, name, url, tags }) => ({
        id,
        name,
        url,
        tags,
      })),
    ).toEqual([
      {
        id: "visio-illustrator",
        name: "Visio-Illustrator",
        url: "https://github.com/TZ-mx/Visio-Illustrator",
        tags: ["TypeScript", ".NET", "MCP"],
      },
      {
        id: "enterprise-knowledge-base",
        name: "Enterprise Knowledge Base",
        url: "https://github.com/TZ-mx/Enterprise_Knowledge_Base",
        tags: ["Python", "RAG", "Gradio"],
      },
      {
        id: "chatbi-nanobot",
        name: "ChatBI-nanobot",
        url: "https://github.com/TZ-mx/ChatBI-nanobot",
        tags: ["Python", "Agent", "SQLite"],
      },
      {
        id: "academic-paper-plugin",
        name: "Academic Paper Plugin",
        url: "https://github.com/TZ-mx/Academic-Paper-Plugin",
        tags: ["Codex", "Claude Code", "LaTeX"],
      },
      {
        id: "intelligent-tender-document-generation",
        name: "Intelligent Tender Document Generation",
        url: "https://github.com/TZ-mx/Intelligent-tender-document-generation",
        tags: ["React", "Electron", "DOCX"],
      },
      {
        id: "enterprise-intelligent-recommendation",
        name: "Enterprise Intelligent Recommendation",
        url: "https://github.com/TZ-mx/Enterprise-Intelligent-Recommendation",
        tags: ["Python", "LangGraph", "FastAPI"],
      },
    ]);
    expect(projects.every((project) => project.description.length > 0)).toBe(
      true,
    );
  });

  it.each([
    ["default", DefaultProjectsPage],
    ["fuwari", FuwariProjectsPage],
  ])("%s 主题渲染项目内容与安全的 GitHub 外链", (_themeName, Page) => {
    const projects = getProjects();
    const html = renderToStaticMarkup(createElement(Page, { projects }));

    for (const project of projects) {
      expect(html).toContain(project.name);
      expect(html).toContain(project.url);
      for (const tag of project.tags) {
        expect(html).toContain(tag);
      }
    }
    expect(html.match(/target="_blank"/g)).toHaveLength(projects.length);
    expect(html.match(/rel="noreferrer"/g)).toHaveLength(projects.length);
  });

  it("把项目入口放在文章与友链之间", () => {
    expect(
      getPublicNavOptions().map(({ id, to }) => ({
        id,
        to,
      })),
    ).toEqual([
      { id: "home", to: "/" },
      { id: "posts", to: "/posts" },
      { id: "projects", to: "/projects" },
      { id: "friend-links", to: "/friend-links" },
    ]);
  });

  it("生成项目页标题、描述与 canonical 地址", () => {
    const seo = getProjectsSeo("libresensing.com");

    expect(seo.title.length).toBeGreaterThan(0);
    expect(seo.description.length).toBeGreaterThan(0);
    expect(seo.canonicalHref).toBe("https://libresensing.com/projects");
  });

  it("Fuwari 项目页使用满足正文可读性的文字层级", () => {
    const html = renderToStaticMarkup(
      createElement(FuwariProjectsPage, { projects: getProjects() }),
    );

    expect(html).not.toContain("fuwari-text-50");
    expect(html).toContain("fuwari-text-75");
  });
});
