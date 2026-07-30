import { ArrowUpRight, Github } from "lucide-react";
import type { ProjectsPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";

export function ProjectsPage({ projects }: ProjectsPageProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-8">
      <header className="space-y-6 py-12 md:py-20">
        <span className="font-mono text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {m.projects_kicker()}
        </span>
        <h1 className="text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          {m.projects_title()}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed font-light text-muted-foreground md:text-lg">
          {m.projects_description()}
        </p>
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label={m.projects_title()}
      >
        {projects.map((project) => (
          <a
            key={project.id}
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-72 flex-col rounded-2xl border border-border/60 bg-background/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg"
            aria-label={`${project.name} · ${m.projects_view_github()}`}
          >
            <div className="mb-10 flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground font-mono text-xs font-bold text-background">
                {project.monogram}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </div>

            <h2 className="text-lg font-medium break-words text-foreground">
              {project.name}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-6 font-light text-muted-foreground">
              {project.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 border-t border-border/50 pt-4 font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              <Github
                aria-hidden="true"
                className="h-4 w-4"
                strokeWidth={1.5}
              />
              <span>{m.projects_view_github()}</span>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
