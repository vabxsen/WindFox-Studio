/**
 * Fluent UI React v9 themes tuned to WinUI: Segoe UI Variable, WinUI control
 * fills/strokes, and the user's Windows accent ramp used the way WinUI uses it
 * (AccentDark1 for fills in light theme, AccentLight2 in dark theme).
 */
import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";
import type { Accent } from "./api";

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function mix(a: string, b: string, t: number) {
  const ca = parse(a);
  const cb = parse(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

export function alpha(hex: string, a: number) {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** A 16-step Fluent brand ramp anchored on the seven Windows accent shades. */
function brandRamp(a: Accent): BrandVariants {
  return {
    10: mix("#000000", a.dark3, 0.35),
    20: mix("#000000", a.dark3, 0.7),
    30: a.dark3,
    40: mix(a.dark3, a.dark2, 0.5),
    50: a.dark2,
    60: mix(a.dark2, a.dark1, 0.5),
    70: a.dark1,
    80: a.accent,
    90: mix(a.accent, a.light1, 0.5),
    100: a.light1,
    110: mix(a.light1, a.light2, 0.5),
    120: a.light2,
    130: mix(a.light2, a.light3, 0.5),
    140: a.light3,
    150: mix(a.light3, "#ffffff", 0.4),
    160: mix(a.light3, "#ffffff", 0.75),
  };
}

const FONT = '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';

export function buildTheme(mode: "light" | "dark", accent: Accent): Theme {
  const brand = brandRamp(accent);
  if (mode === "light") {
    const fill = accent.dark1;
    return {
      ...createLightTheme(brand),
      fontFamilyBase: FONT,
      colorNeutralForeground1: "rgba(0, 0, 0, 0.894)",
      colorNeutralForeground2: "rgba(0, 0, 0, 0.62)",
      colorNeutralBackground1: "#fdfdfd",
      colorNeutralBackground1Hover: "#f6f6f6",
      colorNeutralBackground1Pressed: "#f2f2f2",
      colorNeutralStroke1: "#e3e3e3",
      colorNeutralStroke1Hover: "#d6d6d6",
      colorNeutralStroke1Pressed: "#d1d1d1",
      colorNeutralStrokeAccessible: "rgba(0, 0, 0, 0.447)",
      colorBrandBackground: fill,
      colorBrandBackgroundHover: alpha(fill, 0.9),
      colorBrandBackgroundPressed: alpha(fill, 0.8),
      colorCompoundBrandBackground: fill,
      colorCompoundBrandBackgroundHover: alpha(fill, 0.9),
      colorCompoundBrandBackgroundPressed: alpha(fill, 0.8),
      colorCompoundBrandStroke: fill,
      colorCompoundBrandStrokeHover: alpha(fill, 0.9),
      colorCompoundBrandStrokePressed: alpha(fill, 0.8),
      colorBrandForeground1: accent.dark2,
      colorBrandForegroundLink: accent.dark2,
      colorBrandForegroundLinkHover: accent.dark3,
      colorNeutralForegroundOnBrand: "#ffffff",
      // InfoBar colors (SystemFillColor*Background / SystemFillColor*)
      colorNeutralBackground3: "#f6f6f6",
      colorStatusSuccessBackground1: "#dff6dd",
      colorStatusSuccessBorder1: "rgba(0, 0, 0, 0.059)",
      colorStatusSuccessForeground1: "#0f7b0f",
      colorStatusWarningBackground1: "#fff4ce",
      colorStatusWarningBorder1: "rgba(0, 0, 0, 0.059)",
      colorStatusWarningForeground3: "#9d5d00",
      colorStatusDangerBackground1: "#fde7e9",
      colorStatusDangerBorder1: "rgba(0, 0, 0, 0.059)",
      colorStatusDangerForeground1: "#c42b1c",
    };
  }
  const fill = accent.light2;
  return {
    ...createDarkTheme(brand),
    fontFamilyBase: FONT,
    colorNeutralForeground2: "rgba(255, 255, 255, 0.773)",
    colorNeutralBackground1: "#2d2d2d",
    colorNeutralBackground1Hover: "#323232",
    colorNeutralBackground1Pressed: "#272727",
    colorNeutralStroke1: "#3d3d3d",
    colorNeutralStroke1Hover: "#454545",
    colorNeutralStroke1Pressed: "#3a3a3a",
    colorNeutralStrokeAccessible: "rgba(255, 255, 255, 0.545)",
    colorBrandBackground: fill,
    colorBrandBackgroundHover: alpha(fill, 0.9),
    colorBrandBackgroundPressed: alpha(fill, 0.8),
    colorCompoundBrandBackground: fill,
    colorCompoundBrandBackgroundHover: alpha(fill, 0.9),
    colorCompoundBrandBackgroundPressed: alpha(fill, 0.8),
    colorCompoundBrandStroke: fill,
    colorCompoundBrandStrokeHover: alpha(fill, 0.9),
    colorCompoundBrandStrokePressed: alpha(fill, 0.8),
    colorBrandForeground1: accent.light3,
    colorBrandForegroundLink: accent.light3,
    colorBrandForegroundLinkHover: accent.light2,
    colorNeutralForegroundOnBrand: "#000000",
    // InfoBar colors (SystemFillColor*Background / SystemFillColor*)
    colorNeutralBackground3: "#2b2b2b",
    colorNeutralStroke2: "#1d1d1d",
    colorStatusSuccessBackground1: "#393d1b",
    colorStatusSuccessBorder1: "rgba(0, 0, 0, 0.1)",
    colorStatusSuccessForeground1: "#6ccb5f",
    colorStatusWarningBackground1: "#433519",
    colorStatusWarningBorder1: "rgba(0, 0, 0, 0.1)",
    colorStatusWarningForeground3: "#fce100",
    colorStatusDangerBackground1: "#442726",
    colorStatusDangerBorder1: "rgba(0, 0, 0, 0.1)",
    colorStatusDangerForeground1: "#ff99a4",
  };
}

/** Exposes the accent ramp to plain CSS (tiles, nav indicator, checkboxes). */
export function applyAccentVariables(a: Accent) {
  const root = document.documentElement.style;
  root.setProperty("--accent", a.accent);
  root.setProperty("--accent-dark1", a.dark1);
  root.setProperty("--accent-dark2", a.dark2);
  root.setProperty("--accent-dark3", a.dark3);
  root.setProperty("--accent-light1", a.light1);
  root.setProperty("--accent-light2", a.light2);
  root.setProperty("--accent-light3", a.light3);
}
