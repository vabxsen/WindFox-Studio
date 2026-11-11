import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { api, logError, type DriverProgress, type Gpu } from "../api";
import { glyphs } from "../catalog";
import { Glyph, PageHeader, SectionHeader } from "../components/basics";
import { SettingsCard } from "../components/SettingsCard";
import { useApp } from "../state";

type Confirm = null | "install" | { restoreFailed: string } | "restart";

function DriverStatus({ job }: { job?: DriverProgress }) {
  if (!job) return null;
  if (job.state === "installed") return <Glyph g={glyphs.completed} size={16} className="status-success" />;
  if (job.state === "failed") return <Glyph g={glyphs.error} size={16} className="status-critical" />;
  return <Spinner size="tiny" aria-label={job.message} />;
}

function GpuCard({ gpu }: { gpu: Gpu }) {
  const { startInstall, navigate, installed } = useApp();
  const toolInstalled = gpu.tool?.wingetId ? installed?.has(gpu.tool.wingetId.toLowerCase()) : false;
  const details = [gpu.driverVersion && `Driver ${gpu.driverVersion}`, gpu.driverDate].filter(Boolean).join(" · ");
  return (
    <SettingsCard
      icon={<Glyph g={glyphs.display} size={20} />}
      header={gpu.name}
      description={
        gpu.basicDriver
          ? "Running on Windows' basic display driver. Install the real driver for full performance."
          : details || "Driver details unavailable"
      }
    >
      {gpu.tool &&
        (toolInstalled ? (
          <span className="type-caption text-secondary">{gpu.tool.name} is installed</span>
        ) : gpu.tool.wingetId ? (
          <Button
            onClick={() => {
              void startInstall([gpu.tool!.wingetId!]);
              navigate({ name: "install" });
            }}
          >
            Install {gpu.tool.name}
          </Button>
        ) : (
          <Button icon={<Glyph g={glyphs.openLink} size={14} />} iconPosition="after" onClick={() => api.openUrl(gpu.tool!.url)}>
            Get {gpu.tool.name}
          </Button>
        ))}
    </SettingsCard>
  );
}

export function DriversPage() {
  const {
    driverScan: scan,
    driverPhase: phase,
    driverError,
    driverJobs,
    driverRebootRequired,
    scanDrivers,
    installDrivers,
    setDriverPhase,
    setDriverError,
    settings,
  } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const busy = phase === "scanning" || phase === "restoring" || phase === "installing";

  // Pre-select drivers that fix a broken device; leave the rest to the user.
  useEffect(() => {
    if (scan) setPicked(scan.problemDevices.map((d) => d.fixUpdateId).filter((id): id is string => !!id));
  }, [scan]);

  // Installed drivers drop out of the selection so they can't be installed twice.
  useEffect(() => {
    if (phase === "done") setPicked((p) => p.filter((id) => driverJobs.get(id)?.state !== "installed"));
  }, [phase, driverJobs]);

  const updates = scan?.updates ?? [];
  const allPicked = updates.length > 0 && picked.length === updates.length;
  const selectedTitles = useMemo(
    () => updates.filter((u) => picked.includes(u.updateId)).map((u) => u.title),
    [updates, picked],
  );

  const runInstall = async (withRestorePoint: boolean) => {
    setConfirm(null);
    if (withRestorePoint && !settings.simulate) {
      setDriverPhase("restoring");
      try {
        await api.createRestorePoint();
      } catch (e) {
        logError("create_restore_point failed", e);
        setDriverPhase("idle");
        const message = String(e);
        if (message.includes("declined")) setDriverError(message);
        else setConfirm({ restoreFailed: message });
        return;
      }
    }
    await installDrivers(picked);
  };

  const finished = phase === "done" && driverJobs.size > 0;
  const failedCount = [...driverJobs.values()].filter((j) => j.state === "failed").length;

  return (
    <div className="page padded-page settings-like">
      <PageHeader
        title="Drivers"
        description="Find devices that are missing drivers, and newer drivers offered by Windows Update."
      />

      <MessageBar intent="info" layout="multiline" className="drivers-info">
        <MessageBarBody>
          Drivers come from Windows Update and are signed by Microsoft, the same ones listed under Optional updates in
          Settings. Before installing, WindFox Studio makes a restore point so you can undo the change.
        </MessageBarBody>
      </MessageBar>

      <div className="card-stack">
        <SettingsCard
          icon={<Glyph g={glyphs.refresh} size={20} />}
          header="Scan for drivers"
          description={
            phase === "scanning"
              ? "Checking Windows Update. This can take a minute or two."
              : scan
                ? `Found ${scan.updates.length} driver ${scan.updates.length === 1 ? "update" : "updates"} and ${scan.problemDevices.length} ${scan.problemDevices.length === 1 ? "device" : "devices"} that need attention.`
                : "Check this PC's devices and Windows Update."
          }
        >
          {phase === "scanning" ? (
            <Spinner size="tiny" label="Scanning…" labelPosition="before" />
          ) : (
            <Button appearance={scan ? "secondary" : "primary"} onClick={scanDrivers} disabled={busy}>
              {scan ? "Scan again" : "Scan now"}
            </Button>
          )}
        </SettingsCard>
      </div>

      {driverError && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{driverError}</MessageBarBody>
        </MessageBar>
      )}

      {finished && (
        <MessageBar intent={failedCount ? "warning" : "success"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>
              {failedCount
                ? "Some drivers didn't install"
                : settings.simulate
                  ? "Simulation finished"
                  : "Drivers installed"}
            </MessageBarTitle>
            {driverRebootRequired ? "Restart your PC to finish." : failedCount ? "See the list below for details." : "You're all set."}
          </MessageBarBody>
          {driverRebootRequired && (
            <MessageBarActions>
              <Button onClick={() => setConfirm("restart")}>Restart now</Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}

      {scan && (
        <>
          {scan.gpus.length > 0 && (
            <>
              <SectionHeader>Graphics</SectionHeader>
              <div className="card-stack">
                {scan.gpus.map((gpu) => (
                  <GpuCard key={gpu.name} gpu={gpu} />
                ))}
              </div>
            </>
          )}

          <SectionHeader>Devices</SectionHeader>
          <div className="card-stack">
            {scan.problemDevices.length === 0 ? (
              <SettingsCard
                icon={<Glyph g={glyphs.completed} size={20} className="status-success" />}
                header="All devices are working"
                description="Device Manager doesn't report any driver problems."
              />
            ) : (
              scan.problemDevices.map((d) => (
                <SettingsCard
                  key={d.deviceId}
                  icon={<Glyph g={glyphs.warning} size={20} className="status-caution" />}
                  header={d.name}
                  description={`${d.problem} (code ${d.errorCode})`}
                >
                  {d.fixUpdateId ? (
                    <span className="pill tone-success type-caption">Fix available below</span>
                  ) : (
                    <Button
                      appearance="subtle"
                      icon={<Glyph g={glyphs.openLink} size={14} />}
                      iconPosition="after"
                      onClick={() =>
                        api.openUrl(
                          `https://www.bing.com/search?q=${encodeURIComponent(`${d.hardwareIds[0] ?? d.name} driver`)}`,
                        )
                      }
                    >
                      Search the web
                    </Button>
                  )}
                </SettingsCard>
              ))
            )}
          </div>

          <SectionHeader>Available from Windows Update</SectionHeader>
          {scan.updateError ? (
            <MessageBar intent="error" layout="multiline">
              <MessageBarBody>{scan.updateError}</MessageBarBody>
            </MessageBar>
          ) : updates.length === 0 ? (
            <div className="card-stack">
              <SettingsCard
                icon={<Glyph g={glyphs.completed} size={20} className="status-success" />}
                header="Your drivers are up to date"
                description="Windows Update has no newer drivers for this PC right now."
              />
            </div>
          ) : (
            <>
              <div className="card-stack">
                <SettingsCard
                  className="select-all-row"
                  icon={
                    <Checkbox
                      checked={allPicked ? true : picked.length ? "mixed" : false}
                      onChange={() => setPicked(allPicked ? [] : updates.map((u) => u.updateId))}
                      disabled={busy}
                      aria-label="Select all drivers"
                    />
                  }
                  header={`${picked.length} of ${updates.length} selected`}
                >
                  <Button
                    appearance="primary"
                    disabled={picked.length === 0 || busy}
                    onClick={() => setConfirm("install")}
                    icon={phase === "restoring" || phase === "installing" ? <Spinner size="extra-tiny" /> : undefined}
                  >
                    {phase === "restoring"
                      ? "Making restore point…"
                      : phase === "installing"
                        ? "Installing…"
                        : "Install selected"}
                  </Button>
                </SettingsCard>
                {updates.map((u) => {
                  const job = driverJobs.get(u.updateId);
                  return (
                    <SettingsCard
                      key={u.updateId}
                      icon={
                        <Checkbox
                          checked={picked.includes(u.updateId)}
                          disabled={busy || job?.state === "installed"}
                          onChange={() =>
                            setPicked((p) =>
                              p.includes(u.updateId) ? p.filter((x) => x !== u.updateId) : [...p, u.updateId],
                            )
                          }
                          aria-label={u.title}
                        />
                      }
                      header={u.title}
                      description={
                        job?.message ??
                        [u.driverClass, u.provider || u.manufacturer, u.date].filter(Boolean).join(" · ")
                      }
                    >
                      {job ? <DriverStatus job={job} /> : u.optional && <span className="pill type-caption">Optional</span>}
                    </SettingsCard>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={confirm !== null} onOpenChange={(_, d) => !d.open && setConfirm(null)}>
        <DialogSurface>
          <DialogBody>
            {confirm === "install" && (
              <>
                <DialogTitle>
                  Install {picked.length} {picked.length === 1 ? "driver" : "drivers"}?
                </DialogTitle>
                <DialogContent>
                  <ul className="review-list compact">
                    {selectedTitles.map((t) => (
                      <li key={t} className="type-body">
                        {t}
                      </li>
                    ))}
                  </ul>
                  {settings.simulate ? (
                    <MessageBar intent="warning">
                      <MessageBarBody>
                        Simulate installs is on, so no restore point is made and nothing is installed.
                      </MessageBarBody>
                    </MessageBar>
                  ) : (
                    <p className="type-body text-secondary">
                      WindFox Studio makes a restore point first, then downloads and installs these drivers from Windows
                      Update. Windows will ask for permission once. Your screen may flicker while display drivers
                      install.
                    </p>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button appearance="primary" onClick={() => runInstall(true)}>
                    Install
                  </Button>
                  <Button onClick={() => setConfirm(null)}>Cancel</Button>
                </DialogActions>
              </>
            )}
            {confirm && typeof confirm === "object" && (
              <>
                <DialogTitle>Couldn't make a restore point</DialogTitle>
                <DialogContent>
                  <p className="type-body">{confirm.restoreFailed}</p>
                  <p className="type-body text-secondary">
                    Without a restore point, you can still roll back a driver from Device Manager. Install anyway?
                  </p>
                </DialogContent>
                <DialogActions>
                  <Button appearance="primary" onClick={() => runInstall(false)}>
                    Install anyway
                  </Button>
                  <Button onClick={() => setConfirm(null)}>Cancel</Button>
                </DialogActions>
              </>
            )}
            {confirm === "restart" && (
              <>
                <DialogTitle>Restart now?</DialogTitle>
                <DialogContent>
                  <p className="type-body">Save your work first. Your PC will restart in 10 seconds.</p>
                </DialogContent>
                <DialogActions>
                  <Button
                    appearance="primary"
                    onClick={() => {
                      setConfirm(null);
                      void api.restartPc();
                    }}
                  >
                    Restart
                  </Button>
                  <Button onClick={() => setConfirm(null)}>Not now</Button>
                </DialogActions>
              </>
            )}
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
