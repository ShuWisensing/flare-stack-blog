import { ExternalLink, Github, PanelsTopLeft } from "lucide-react";
import type { ProjectsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function ProjectsPage({ projects }: ProjectsPageProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <header
        className="fuwari-card-base fuwari-onload-animation relative flex min-h-56 flex-col justify-center overflow-hidden p-6 md:p-8"
        style={{ animationDelay: "150ms" }}
      >
        <PanelsTopLeft
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -bottom-8 h-44 w-44 rotate-6 text-(--fuwari-primary) opacity-8"
          strokeWidth={1}
        />
        <span className="mb-3 w-fit rounded-full bg-(--fuwari-btn-regular-bg) px-3 py-1 text-xs font-bold tracking-wider text-(--fuwari-primary) uppercase">
          {m.projects_kicker()}
        </span>
        <h1 className="fuwari-text-90 relative z-10 text-3xl font-bold transition-colors md:text-4xl">
          {m.projects_title()}
        </h1>
        <p className="fuwari-text-75 relative z-10 mt-4 max-w-2xl leading-relaxed transition-colors">
          {m.projects_description()}
        </p>
      </header>

      <section
        className="fuwari-card-base fuwari-onload-animation p-4 md:p-6"
        style={{ animationDelay: "300ms" }}
        aria-label={m.projects_title()}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="group fuwari-onload-animation flex min-h-72 flex-col rounded-2xl border border-black/5 bg-black/2.5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-(--fuwari-primary)/25 hover:bg-(--fuwari-primary)/5 hover:shadow-lg dark:border-white/8 dark:bg-white/3"
              style={{ animationDelay: `${400 + index * 70}ms` }}
              aria-label={`${project.name} · ${m.projects_view_github()}`}
            >
              <div className="mb-10 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--fuwari-primary) font-mono text-xs font-bold text-white shadow-md shadow-black/10">
                  {project.monogram}
                </span>
                <ExternalLink
                  aria-hidden="true"
                  className="fuwari-text-30 h-4 w-4 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--fuwari-primary)"
                  strokeWidth={1.5}
                />
              </div>

              <h2 className="fuwari-text-90 text-lg font-bold break-words transition-colors group-hover:text-(--fuwari-primary)">
                {project.name}
              </h2>
              <p className="fuwari-text-75 mt-3 flex-1 text-sm leading-6 transition-colors">
                {project.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-(--fuwari-btn-regular-bg) px-2.5 py-1 text-xs font-medium text-(--fuwari-primary)"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="fuwari-text-75 mt-6 flex items-center gap-2 border-t border-black/5 pt-4 text-xs font-medium transition-colors group-hover:text-(--fuwari-primary) dark:border-white/8">
                <Github
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={1.5}
                />
                <span>{m.projects_view_github()}</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
