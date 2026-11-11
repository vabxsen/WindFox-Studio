import type { ReactNode } from "react";

/**
 * Home header after WinUI Gallery's HomePageHeader: 400px backdrop that fades
 * out between 75% and 85%, title at 36,48, tile row 56px below. The artwork is
 * our own: soft accent-colored light drawn in SVG so it follows the user's
 * Windows accent color.
 */
export function HeroHeader({ children }: { children: ReactNode }) {
  return (
    <div className="hero">
      <div className="hero-art" aria-hidden>
        <svg viewBox="0 0 1400 400" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
          <defs>
            <filter id="hero-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="48" />
            </filter>
            <linearGradient id="hero-ribbon-a" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--accent-light2)", stopOpacity: 0 }} />
              <stop offset="0.5" style={{ stopColor: "var(--accent-light1)", stopOpacity: 0.9 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.2 }} />
            </linearGradient>
            <linearGradient id="hero-ribbon-b" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: "var(--accent-light3)", stopOpacity: 0 }} />
              <stop offset="0.6" style={{ stopColor: "var(--accent-light3)", stopOpacity: 0.8 }} />
              <stop offset="1" style={{ stopColor: "var(--accent-light2)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <g filter="url(#hero-blur)">
            <ellipse cx="1040" cy="110" rx="340" ry="150" style={{ fill: "var(--accent-light1)" }} opacity="0.55" />
            <ellipse cx="1260" cy="270" rx="240" ry="150" style={{ fill: "var(--accent)" }} opacity="0.55" />
            <ellipse cx="780" cy="300" rx="280" ry="110" style={{ fill: "var(--accent-light2)" }} opacity="0.4" />
            <ellipse cx="260" cy="20" rx="320" ry="120" style={{ fill: "var(--accent-light3)" }} opacity="0.3" />
          </g>
          <g fill="none" strokeLinecap="round" className="hero-ribbons">
            <path d="M560 380 C 760 210, 900 360, 1440 110" stroke="url(#hero-ribbon-a)" strokeWidth="44" />
            <path d="M640 430 C 860 280, 1010 400, 1440 230" stroke="url(#hero-ribbon-b)" strokeWidth="16" />
            <path d="M700 330 C 900 200, 1040 300, 1440 40" stroke="url(#hero-ribbon-b)" strokeWidth="6" />
          </g>
        </svg>
      </div>
      {children}
    </div>
  );
}
