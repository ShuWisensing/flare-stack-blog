import type { NavOption } from "@/features/theme/contract/layouts";
import { m } from "@/paraglide/messages";

export function getPublicNavOptions(): NavOption[] {
  return [
    { label: m.nav_home(), to: "/", id: "home" },
    { label: m.nav_posts(), to: "/posts", id: "posts" },
    { label: m.nav_projects(), to: "/projects", id: "projects" },
    {
      label: m.nav_friend_links(),
      to: "/friend-links",
      id: "friend-links",
    },
  ];
}
