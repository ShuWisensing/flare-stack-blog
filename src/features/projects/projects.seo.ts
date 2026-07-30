import { buildCanonicalUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";

export function getProjectsSeo(domain: string) {
  return {
    title: m.projects_title(),
    description: m.projects_meta_description(),
    canonicalHref: buildCanonicalUrl(domain, "/projects"),
  };
}
