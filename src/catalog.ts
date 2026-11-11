import data from "../src-tauri/catalog.json";

export interface CatalogApp {
  id: string;
  source: "winget" | "msstore";
  name: string;
  description: string;
  recommended: boolean;
  elevated: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  glyph: string;
  hidden?: boolean;
  apps: CatalogApp[];
}

const all = (data as { categories: Category[] }).categories;

/** Categories shown in the UI (the GPU tools category is only used by Drivers). */
export const categories: Category[] = all.filter((c) => !c.hidden);

export const allApps: CatalogApp[] = all.flatMap((c) => c.apps);

const byId = new Map(allApps.map((a) => [a.id.toLowerCase(), a]));
const categoryOfApp = new Map(all.flatMap((c) => c.apps.map((a) => [a.id.toLowerCase(), c])));

export const findApp = (id: string) => byId.get(id.toLowerCase());
export const findCategory = (id: string) => all.find((c) => c.id === id);
export const categoryOf = (appId: string) => categoryOfApp.get(appId.toLowerCase());

export function searchApps(query: string): CatalogApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return categories
    .flatMap((c) => c.apps.map((a) => ({ a, c })))
    .filter(({ a, c }) =>
      [a.name, a.description, a.id, c.name].some((field) => field.toLowerCase().includes(q)),
    )
    .map(({ a }) => a);
}

/** Recommended apps, with the user's interests first. */
export function recommendedApps(interests: string[]): CatalogApp[] {
  const ordered = [
    ...categories.filter((c) => interests.includes(c.id)),
    ...categories.filter((c) => !interests.includes(c.id)),
  ];
  return ordered.flatMap((c) => c.apps.filter((a) => a.recommended));
}

export const glyphs = {
  home: "",
  apps: "",
  drivers: "",
  download: "",
  settings: "",
  back: "",
  menu: "",
  search: "",
  chevronDown: "",
  chevronUp: "",
  chevronRight: "",
  chevronLeft: "",
  openLink: "",
  info: "",
  check: "",
  completed: "",
  warning: "",
  error: "",
  refresh: "",
  display: "",
  star: "",
  shield: "",
  restart: "",
  folder: "",
  color: "",
  bug: "",
  sparkle: "",
  minimize: "",
  maximize: "",
  restore: "",
  close: "",
  clear: "",
};
