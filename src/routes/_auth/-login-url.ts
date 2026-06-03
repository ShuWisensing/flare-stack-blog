const SERVER_SAFE_ORIGIN = "http://localhost";

export function createLoginSearchParams(
  href: string,
  origin = SERVER_SAFE_ORIGIN,
) {
  return new URL(href, origin).searchParams;
}
