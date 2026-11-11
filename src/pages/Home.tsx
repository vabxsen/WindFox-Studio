import { Button, Spinner } from "@fluentui/react-components";
import { useState } from "react";
import { categories, glyphs, recommendedApps } from "../catalog";
import { AppGrid } from "../components/AppCard";
import { EmptyState } from "../components/basics";
import { HeroHeader } from "../components/HeroHeader";
import { QuickActions } from "../components/QuickActions";
import { SelectorBar } from "../components/SelectorBar";
import { useApp } from "../state";

type Tab = "recommended" | "installed";

export function HomePage() {
  const { settings, installed, installedError, refreshInstalled } = useApp();
  const [tab, setTab] = useState<Tab>("recommended");

  const installedApps = categories
    .flatMap((c) => c.apps)
    .filter((a) => installed?.has(a.id.toLowerCase()));

  return (
    <div className="page home-page">
      <HeroHeader>
        <div className="hero-text">
          <div className="hero-subtitle">
            <span className="type-body">Set up your Windows 11 PC</span>
            <span className="hero-badge">v{__APP_VERSION__}</span>
          </div>
          <h1 className="type-title-large">WindFox Studio</h1>
        </div>
        <QuickActions />
      </HeroHeader>

      <SelectorBar<Tab>
        label="Home view"
        value={tab}
        onChange={setTab}
        items={[
          { key: "recommended", label: "Recommended", glyph: glyphs.star },
          { key: "installed", label: "Installed", glyph: glyphs.completed },
        ]}
      />

      <div className="home-content">
        {tab === "recommended" ? (
          <>
            <h2 className="home-section-title type-body-strong">Recommended for you</h2>
            <AppGrid apps={recommendedApps(settings.interests)} />
          </>
        ) : installed === null ? (
          <Spinner size="small" label="Checking which apps are installed…" labelPosition="after" />
        ) : installedApps.length > 0 ? (
          <>
            <h2 className="home-section-title type-body-strong">Installed apps from this catalog</h2>
            <AppGrid apps={installedApps} />
          </>
        ) : (
          <EmptyState glyph={glyphs.apps} title={installedError ? "Couldn't check installed apps" : "None of the catalog apps are installed yet"}>
            <p className="type-body text-secondary">
              {installedError ?? "Apps you install with WindFox Studio will show up here."}
            </p>
            {installedError && <Button onClick={refreshInstalled}>Try again</Button>}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
