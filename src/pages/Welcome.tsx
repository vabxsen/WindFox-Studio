import { Button } from "@fluentui/react-components";
import { useState } from "react";
import { categories } from "../catalog";
import { PageHeader } from "../components/basics";
import { Tile } from "../components/Tile";
import { useApp } from "../state";

/** First-run screen: pick interests, then see suggested apps pre-selected. */
export function WelcomePage() {
  const { settings, updateSettings, navigate, installed, setSelected } = useApp();
  const [picked, setPicked] = useState<string[]>(settings.interests);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const finish = () => {
    updateSettings({ onboarded: true, interests: picked });
    const suggestions = categories
      .filter((c) => picked.includes(c.id))
      .flatMap((c) => c.apps)
      .filter((a) => a.recommended && !installed?.has(a.id.toLowerCase()))
      .map((a) => a.id);
    setSelected(suggestions);
    navigate({ name: "apps", suggested: true }, { replace: true });
  };

  const skip = () => {
    updateSettings({ onboarded: true });
    navigate({ name: "home" }, { replace: true });
  };

  return (
    <div className="page padded-page welcome-page">
      <PageHeader
        title="Welcome! What do you use this PC for?"
        description="Pick as many as you like. We'll suggest popular apps for each, and you choose what to install."
      />
      <div className="tile-grid">
        {categories.map((c) => (
          <Tile
            key={c.id}
            glyph={c.glyph}
            title={c.name}
            description={c.description}
            selected={picked.includes(c.id)}
            onClick={() => toggle(c.id)}
          />
        ))}
      </div>
      <div className="welcome-actions">
        <Button appearance="primary" disabled={picked.length === 0} onClick={finish}>
          Show suggestions
        </Button>
        <Button appearance="subtle" onClick={skip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
