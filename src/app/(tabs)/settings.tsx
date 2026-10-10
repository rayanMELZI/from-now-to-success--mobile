import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Constants from "expo-constants";
import {
  Bell,
  BookOpen,
  Download,
  ClipboardList,
  Globe,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  Sun,
} from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
  sendTestReminder,
  syncReminders,
} from "@/lib/reminders";
import { tw, useTheme } from "@/lib/theme";
import {
  CURRENT_VERSION,
  UPDATES_SUPPORTED,
  autoUpdateEnabled,
  checkForUpdate,
  installUpdate,
  setAutoUpdate,
  useUpdateState,
} from "@/lib/updater";
import { useOnboarding } from "@/components/OnboardingGuide";
import { Banner, Card } from "@/components/ui/Card";
import { Btn } from "@/components/ui/Button";
import { Labeled } from "@/components/ui/Field";
import { SelectField, type Option } from "@/components/ui/Pickers";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { ToggleCard } from "@/components/ui/ToggleCard";
import { Txt } from "@/components/ui/Txt";

const FALLBACK_ZONES = [
  "UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Istanbul",
  "Africa/Algiers", "Africa/Casablanca", "Africa/Tunis", "Africa/Cairo", "Africa/Lagos",
  "Asia/Dubai", "Asia/Riyadh", "Asia/Karachi", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo",
  "Australia/Sydney", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Sao_Paulo", "America/Toronto",
];

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function allTimezones(current: string): string[] {
  let zones: string[] = FALLBACK_ZONES;
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") zones = intl.supportedValuesOf("timeZone");
  } catch {
    /* fall back to the short list */
  }
  const device = deviceTimezone();
  return Array.from(new Set([current, ...(device ? [device] : []), ...zones]));
}

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
const HOURS: Option<number>[] = Array.from({ length: 24 }, (_, h) => ({ value: h, label: pad(h) }));
const DAY_END: Option<number>[] = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: h === 0 ? "midnight" : `${pad(h)} ${h <= 12 ? "(night owl)" : "(early bird)"}`,
}));
const WEEK_DAYS: Option<number>[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
  (label, i) => ({ value: i + 1, label }),
);

export default function SettingsScreen() {
  const { c, tone, preference, setPreference } = useTheme();
  const { refreshUser, logout } = useAuth();
  const user = useUser();
  const { show: showGuide } = useOnboarding();

  const [timezone, setTimezone] = useState(user.timezone);
  const [reminderHour, setReminderHour] = useState(user.reminderHour);
  const [dayEndHour, setDayEndHour] = useState(user.dayEndHour);
  const [weekStartDay, setWeekStartDay] = useState(user.weekStartDay);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plannerBusy, setPlannerBusy] = useState(false);
  const [remindersOn, setRemindersOn] = useState<boolean | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [autoUpdate, setAutoUpdateState] = useState<boolean | null>(null);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const update = useUpdateState();

  const zones = useMemo(() => allTimezones(user.timezone).map((z) => ({ value: z, label: z })), [user.timezone]);

  useEffect(() => {
    remindersEnabled().then(setRemindersOn);
    autoUpdateEnabled().then(setAutoUpdateState);
  }, []);

  const dirty =
    timezone !== user.timezone ||
    reminderHour !== user.reminderHour ||
    dayEndHour !== user.dayEndHour ||
    weekStartDay !== user.weekStartDay;

  async function saveSettings() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api("/api/users/me/settings", {
        method: "PATCH",
        body: { timezone, reminderHour, dayEndHour, weekStartDay },
      });
      await refreshUser();
      setSaved(true);
      // The reminder hour may have moved.
      void syncReminders({ ...user, reminderHour });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePlanner() {
    setPlannerBusy(true);
    setError(null);
    try {
      await api("/api/users/me/settings", { method: "PATCH", body: { plannerEnabled: !user.plannerEnabled } });
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err, "Could not save that"));
    } finally {
      setPlannerBusy(false);
    }
  }

  async function toggleReminders() {
    setError(null);
    if (remindersOn) {
      await disableReminders();
      setRemindersOn(false);
      return;
    }
    const granted = await enableReminders();
    if (!granted) {
      setError("Notifications are blocked for this app — allow them in your phone's settings.");
      return;
    }
    setRemindersOn(true);
    await syncReminders(user);
  }

  const detected = deviceTimezone();

  return (
    <Screen>
      <ScreenHeader title="Settings" subtitle="How the app fits around your day." />

      {error && <Banner onClose={() => setError(null)}>{error}</Banner>}
      {saved && !dirty && (
        <Banner tone="success" onClose={() => setSaved(false)}>
          Settings saved.
        </Banner>
      )}

      <Card style={{ gap: 16 }}>
        <Txt weight="600">Your day</Txt>
        <Labeled
          label="Your timezone"
          right={
            detected && detected !== timezone ? (
              <Pressable
                onPress={() => setTimezone(detected)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tone.accent.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <MapPin size={12} color={tone.accent.text} />
                <Txt variant="tiny" weight="600" color={tone.accent.text}>
                  Use this phone&apos;s
                </Txt>
              </Pressable>
            ) : undefined
          }
        >
          <SelectField
            title="Timezone"
            value={timezone}
            options={zones}
            onChange={setTimezone}
            searchable
            icon={<Globe size={15} color={c.inkFaint} />}
          />
        </Labeled>
        <Labeled label="Remind me at">
          <SelectField title="Reminder time" value={reminderHour} options={HOURS} onChange={setReminderHour} />
        </Labeled>
        <Labeled label="My day ends at" hint="Checking in before this hour still counts for the previous day.">
          <SelectField title="Day ends at" value={dayEndHour} options={DAY_END} onChange={setDayEndHour} />
        </Labeled>
        <Labeled label="My week starts on" hint="Weekly habits reset on this day.">
          <SelectField title="Week starts on" value={weekStartDay} options={WEEK_DAYS} onChange={setWeekStartDay} />
        </Labeled>
        <Btn label="Save" onPress={saveSettings} loading={saving} disabled={!dirty} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="600">Reminders</Txt>
        <Txt variant="small" color="soft">
          A notification on this phone at {pad(reminderHour)} — skipped on days you&apos;ve already answered everything.
        </Txt>
        <ToggleCard
          active={!!remindersOn}
          disabled={remindersOn === null}
          tone={tone.accent}
          icon={(color) => <Bell size={18} color={color} />}
          title="Daily check-in reminder"
          subtitle={remindersOn ? "On for this phone" : "Off"}
          onToggle={toggleReminders}
        />
        {remindersOn && (
          <Btn
            variant="ghost"
            label={testSent ? "Sent — it arrives in a few seconds" : "Send a test notification"}
            onPress={async () => {
              await sendTestReminder();
              setTestSent(true);
            }}
          />
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="600">Extras</Txt>
        <ToggleCard
          active={user.plannerEnabled}
          disabled={plannerBusy}
          tone={{ ...tone.accent, solid: tw.amber[500] }}
          icon={(color) => <ClipboardList size={18} color={color} />}
          title="Daily plan"
          subtitle="A timeline of your day — adds a “Plan” tab and pulls habits straight into it."
          onToggle={togglePlanner}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt weight="600">Appearance</Txt>
        <Segmented
          value={preference}
          onChange={setPreference}
          options={[
            { value: "light", label: "Light", icon: <Sun size={14} color={c.inkSoft} /> },
            { value: "system", label: "System", icon: <Monitor size={14} color={c.inkSoft} /> },
            { value: "dark", label: "Dark", icon: <Moon size={14} color={c.inkSoft} /> },
          ]}
        />
      </Card>

      {UPDATES_SUPPORTED && (
        <Card style={{ gap: 12 }}>
          <Txt weight="600">App updates</Txt>
          <Txt variant="small" color="soft">
            Version {CURRENT_VERSION}.{" "}
            {update.latest
              ? `Version ${update.latest.version} is available.`
              : checkedOnce && !update.checking && !update.error
                ? "You have the latest version."
                : "New versions come from the app's GitHub releases."}
          </Txt>
          <ToggleCard
            active={!!autoUpdate}
            disabled={autoUpdate === null}
            tone={tone.success}
            icon={(color) => <Download size={18} color={color} />}
            title="Install updates automatically"
            subtitle="The first update asks you to confirm once; later ones install by themselves."
            onToggle={() => {
              const next = !autoUpdate;
              setAutoUpdateState(next);
              void setAutoUpdate(next);
            }}
          />
          {update.error && <Banner tone="warning">{update.error}</Banner>}
          {update.latest ? (
            <Btn
              label={
                update.phase === "downloading"
                  ? `Downloading… ${Math.round(update.progress * 100)}%`
                  : update.phase === "installing" || update.phase === "waiting"
                    ? "Installing…"
                    : `Update to ${update.latest.version}`
              }
              icon={<Download size={15} color="#fff" />}
              disabled={update.phase === "downloading" || update.phase === "installing"}
              onPress={() => void installUpdate()}
            />
          ) : (
            <Btn
              variant="ghost"
              label={update.checking ? "Checking…" : "Check for updates"}
              loading={update.checking}
              onPress={async () => {
                await checkForUpdate(true);
                setCheckedOnce(true);
              }}
            />
          )}
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <Txt weight="600">Account</Txt>
        <Txt variant="small" color="soft">
          Signed in as <Txt variant="small" weight="600">{user.username}</Txt> · {user.email}
        </Txt>
        <Btn variant="ghost" label="Sign out" icon={<LogOut size={15} color={c.ink} />} onPress={logout} />
      </Card>

      <View style={{ alignItems: "center", gap: 6, marginTop: 4 }}>
        <Pressable onPress={showGuide} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8 }}>
          <BookOpen size={14} color={c.inkFaint} />
          <Txt variant="small" color="faint">
            Replay the app guide
          </Txt>
        </Pressable>
        <Txt variant="tiny" color="faint">
          v{Constants.expoConfig?.version ?? "1.0.0"} · {API_URL.replace(/^https?:\/\//, "")}
        </Txt>
      </View>
    </Screen>
  );
}
