import {
  Button,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  ProgressBar,
  Spinner,
} from "@fluentui/react-components";
import type { InstallProgress } from "../api";
import { findApp, glyphs } from "../catalog";
import { AppIcon, EmptyState, Glyph, PageHeader, SectionHeader } from "../components/basics";
import { SettingsCard } from "../components/SettingsCard";
import { useApp } from "../state";

function StatusIndicator({ job }: { job: InstallProgress }) {
  switch (job.state) {
    case "installing":
      return <Spinner size="tiny" aria-label="Installing" />;
    case "installed":
    case "alreadyInstalled":
      return <Glyph g={glyphs.completed} size={16} className="status-success" />;
    case "rebootRequired":
      return <Glyph g={glyphs.restart} size={16} className="status-caution" />;
    case "failed":
      return <Glyph g={glyphs.error} size={16} className="status-critical" />;
    default:
      return <span className="type-caption text-tertiary">Waiting</span>;
  }
}

export function InstallPage() {
  const { jobs, jobOrder, installRunning, installSummary, startInstall, navigate } = useApp();

  if (jobOrder.length === 0) {
    return (
      <div className="page padded-page">
        <PageHeader title="Install" description="Apps install one at a time with Windows Package Manager (winget)." />
        <EmptyState glyph={glyphs.download} title="Nothing to install yet">
          <p className="type-body text-secondary">Select apps on the Apps page, then select Install.</p>
          <Button appearance="primary" onClick={() => navigate({ name: "apps" })}>
            Browse apps
          </Button>
        </EmptyState>
      </div>
    );
  }

  const list = jobOrder.map((id) => jobs.get(id)).filter((j) => j !== undefined);
  const finished = list.filter((j) => !["queued", "installing"].includes(j.state)).length;
  const failed = list.filter((j) => j.state === "failed").map((j) => j.id);
  const current = list.find((j) => j.state === "installing");

  return (
    <div className="page padded-page settings-like">
      <PageHeader title="Install" description="Apps install one at a time with Windows Package Manager (winget)." />

      {installRunning ? (
        <div className="install-progress-card">
          <div className="install-progress-text">
            <span className="type-body-strong">
              Installing {Math.min(finished + 1, list.length)} of {list.length}
            </span>
            {current && <span className="type-caption text-secondary">{findApp(current.id)?.name ?? current.id}</span>}
          </div>
          <ProgressBar value={list.length ? finished / list.length : 0} thickness="large" />
        </div>
      ) : installSummary ? (
        <MessageBar intent={installSummary.failed ? "warning" : "success"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>
              {installSummary.failed ? "Finished with problems" : installSummary.simulated ? "Simulation finished" : "All done"}
            </MessageBarTitle>
            {[
              installSummary.installed && `${installSummary.installed} installed`,
              installSummary.alreadyInstalled && `${installSummary.alreadyInstalled} already installed`,
              installSummary.failed && `${installSummary.failed} failed`,
            ]
              .filter(Boolean)
              .join(", ")}
            .{installSummary.rebootRequired && " Restart your PC to finish setting up some apps."}
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <SectionHeader>Apps</SectionHeader>
      <div className="card-stack">
        {list.map((job) => {
          const app = findApp(job.id);
          return (
            <SettingsCard
              key={job.id}
              icon={<AppIcon name={app?.name ?? job.id} id={job.id} size={24} />}
              header={app?.name ?? job.id}
              description={job.message}
              className={`install-row state-${job.state}`}
            >
              <StatusIndicator job={job} />
            </SettingsCard>
          );
        })}
      </div>

      {!installRunning && failed.length > 0 && (
        <div className="page-actions">
          <Button appearance="primary" icon={<Glyph g={glyphs.refresh} size={16} />} onClick={() => startInstall(failed)}>
            Retry failed
          </Button>
        </div>
      )}
    </div>
  );
}
