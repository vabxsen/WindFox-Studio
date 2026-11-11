import { load, type Store } from "@tauri-apps/plugin-store";
import { isTauri } from "./api";

export type ThemeSetting = "system" | "light" | "dark";

export interface Settings {
  theme: ThemeSetting;
  simulate: boolean;
  onboarded: boolean;
  interests: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  simulate: false,
  onboarded: false,
  interests: [],
};

const KEY = "settings";
let store: Promise<Store> | null = null;
const getStore = () => (store ??= load("settings.json", { autoSave: true, defaults: {} }));

export async function loadSettings(): Promise<Settings> {
  try {
    if (isTauri) {
      const saved = await (await getStore()).get<Partial<Settings>>(KEY);
      return { ...DEFAULT_SETTINGS, ...saved };
    }
    const raw = localStorage.getItem(`windfox.${KEY}`);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    if (isTauri) await (await getStore()).set(KEY, settings);
    else localStorage.setItem(`windfox.${KEY}`, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; the app keeps working without them.
  }
}
