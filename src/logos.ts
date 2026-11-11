/**
 * Official app logos bundled with the app (see assets/logos/SOURCES.md).
 * Files are named after the winget ID: lower-case, non-alphanumerics → "-".
 */
const files = import.meta.glob<string>("./assets/logos/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const byKey = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".png".length), url]),
);

export const logoKey = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** URL of the app's logo, or undefined when there is none (a letter tile is shown). */
export const logoFor = (id: string) => byKey.get(logoKey(id));
