import { Button, Dropdown, Link, Option, Switch } from "@fluentui/react-components";
import { api, isTauri } from "../api";
import { glyphs } from "../catalog";
import { Glyph, PageHeader, SectionHeader } from "../components/basics";
import { ExpanderItem, SettingsCard, SettingsExpander } from "../components/SettingsCard";
import type { ThemeSetting } from "../settings";
import { useApp } from "../state";

const THEMES: { value: ThemeSetting; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Use system setting" },
];

/** Layout copied from WinUI Gallery's SettingsPage. */
export function SettingsPage() {
  const { settings, updateSettings, navigate } = useApp();
  const theme = THEMES.find((t) => t.value === settings.theme)!;

  return (
    <div className="page padded-page settings-like">
      <PageHeader title="Settings" />

      <SectionHeader>Appearance &amp; behavior</SectionHeader>
      <div className="card-stack">
        <SettingsCard icon={<Glyph g={glyphs.color} size={20} />} header="App theme" description="Select which app theme to display">
          <Dropdown
            aria-label="App theme"
            value={theme.label}
            selectedOptions={[theme.value]}
            onOptionSelect={(_, d) => updateSettings({ theme: d.optionValue as ThemeSetting })}
          >
            {THEMES.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Dropdown>
        </SettingsCard>
      </div>

      <SectionHeader>Installing apps</SectionHeader>
      <div className="card-stack">
        <SettingsCard
          icon={<Glyph g={glyphs.bug} size={20} />}
          header="Simulate installs"
          description="Walk through app and driver installs without installing anything. The winget commands are written to the log."
        >
          <Switch
            checked={settings.simulate}
            onChange={(_, d) => updateSettings({ simulate: d.checked })}
            label={settings.simulate ? "On" : "Off"}
            labelPosition="before"
          />
        </SettingsCard>
        <SettingsCard
          icon={<Glyph g={glyphs.sparkle} size={20} />}
          header="App suggestions"
          description="Pick what you use this PC for again to get new suggestions."
        >
          <Button onClick={() => navigate({ name: "welcome" })}>Run setup</Button>
        </SettingsCard>
        {isTauri && (
          <SettingsCard
            icon={<Glyph g={glyphs.folder} size={20} />}
            header="Logs"
            description="Install and driver logs are kept on this PC."
          >
            <Button onClick={() => void api.openLogs()}>Open folder</Button>
          </SettingsCard>
        )}
      </div>

      <SectionHeader>About</SectionHeader>
      <div className="card-stack about">
        <SettingsExpander
          icon={<img src="/app-icon.svg" width={20} height={20} alt="" />}
          header="WindFox Studio"
          description={`Version ${__APP_VERSION__}`}
        >
          <ExpanderItem header="Apps are installed with Windows Package Manager (winget) from their official sources.">
            <Link onClick={() => void api.openUrl("https://learn.microsoft.com/windows/package-manager/")}>Learn more</Link>
          </ExpanderItem>
          <ExpanderItem header="Drivers come from Windows Update and are signed by Microsoft." />
          <ExpanderItem header="Design based on the WinUI 3 Gallery (MIT License).">
            <Link onClick={() => void api.openUrl("https://github.com/microsoft/WinUI-Gallery")}>View on GitHub</Link>
          </ExpanderItem>
        </SettingsExpander>
      </div>
    </div>
  );
}
