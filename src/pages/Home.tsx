import { Button, Spinner } from "@fluentui/react-components";
import { useState } from "react";
import { categories, findCategory, glyphs, recommendedApps } from "../catalog";
import { AppGrid } from "../components/AppCard";
import { EmptyState } from "../components/basics";
import { HeroHeader } from "../components/HeroHeader";
import { SelectorBar } from "../components/SelectorBar";
import { HorizontalScroller, Tile } from "../components/Tile";
import { useApp } from "../state";

type Tab = "recommended" | "installed";

export function HomePage() {
  const { navigate, settings, installed, installedError, refreshInstalled } = useApp();
  const [tab, setTab] = useState<Tab>("recommended");

  const categoryTile = (id: string, description: string) => {
    const c = findCategory(id)!;
    return (
      <Tile
        key={id}
        glyph={c.glyph}
        title={c.name === "Artificial Intelligence" ? "AI tools" : c.name}
        description={description}
        onClick={() => navigate({ name: "apps", category: id })}
      />
    );
  };

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
        <div className="hero-tiles">
          <HorizontalScroller>
            <Tile
              glyph={glyphs.sparkle}
              title="Set up this PC"
              description="Tell us what you use your PC for and get app suggestions."
              onClick={() => navigate({ name: "welcome" })}
            />
            <Tile
              glyph={glyphs.drivers}
              title="Check drivers"
              description="Find missing and newer drivers from Windows Update."
              onClick={() => navigate({ name: "drivers" })}
            />
            {categoryTile("gaming", "Steam, Epic Games, Discord and more.")}
            {categoryTile("work", "Teams, Zoom, Slack, Notion and more.")}
            {categoryTile("ai", "Claude, ChatGPT, Ollama and LM Studio.")}
            {categoryTile("utilities", "7-Zip, PowerToys, Everything and more.")}
          </HorizontalScroller>
        </div>
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
