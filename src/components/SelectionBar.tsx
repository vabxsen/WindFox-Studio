import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import { useState } from "react";
import { findApp, glyphs } from "../catalog";
import { useApp } from "../state";
import { AppIcon, Glyph } from "./basics";

/** Floating bar shown while apps are selected, with the review dialog. */
export function SelectionBar() {
  const { selected, setSelected, startInstall, navigate, settings, installRunning } = useApp();
  const [reviewing, setReviewing] = useState(false);
  const apps = selected.map((id) => findApp(id)).filter((a) => a !== undefined);
  if (apps.length === 0) return null;

  const install = async () => {
    setReviewing(false);
    const ids = apps.map((a) => a.id);
    setSelected([]);
    navigate({ name: "install" });
    await startInstall(ids);
  };

  const count = `${apps.length} ${apps.length === 1 ? "app" : "apps"}`;
  const needsAdmin = apps.some((a) => a.elevated);

  return (
    <div className="selection-bar-wrap">
      <div className="selection-bar" role="region" aria-label="Selected apps">
        <div className="selection-bar-text">
          <span className="type-body-strong">{count} selected</span>
          <span className="type-caption text-secondary selection-bar-names">
            {apps.map((a) => a.name).join(", ")}
          </span>
        </div>
        <Button appearance="subtle" onClick={() => setSelected([])}>
          Clear
        </Button>
        <Button
          appearance="primary"
          icon={<Glyph g={glyphs.download} size={16} />}
          onClick={() => setReviewing(true)}
          disabled={installRunning}
        >
          Install
        </Button>
      </div>

      <Dialog open={reviewing} onOpenChange={(_, d) => setReviewing(d.open)}>
        <DialogSurface className="review-dialog">
          <DialogBody>
            <DialogTitle>Install {count}?</DialogTitle>
            <DialogContent>
              <ul className="review-list">
                {apps.map((a) => (
                  <li key={a.id}>
                    <AppIcon name={a.name} id={a.id} size={24} />
                    <span className="type-body">{a.name}</span>
                    <span className="type-caption text-tertiary">
                      {a.source === "msstore" ? "Microsoft Store" : "winget"}
                    </span>
                  </li>
                ))}
              </ul>
              {settings.simulate ? (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    Simulate installs is on, so nothing will actually be installed. You can turn it off in Settings.
                  </MessageBarBody>
                </MessageBar>
              ) : (
                <p className="type-body text-secondary">
                  Apps install one at a time, silently, from their official sources.
                  {needsAdmin && " Windows will ask for permission once."}
                </p>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={install}>
                Install
              </Button>
              <Button appearance="secondary" onClick={() => setReviewing(false)}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
