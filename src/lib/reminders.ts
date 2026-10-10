import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "./api";
import { readJson, writeJson } from "./storage";
import type { TodayResponse, UserInfo } from "./types";

/**
 * The end-of-day nudge, done on the phone itself.
 *
 * The web app gets it as a Web Push from the server. A native app would need
 * FCM/APNs keys on the backend for that, so instead the phone schedules its
 * own local notifications at the user's reminder hour for the next two weeks
 * — skipping today once everything is answered, which keeps the web version's
 * promise: it only nags on days you haven't checked in, and never twice.
 * Every app open and every check-in re-plans the list.
 */

const ENABLED_KEY = "fnts.reminders";
const CHANNEL_ID = "checkin";
const DAYS_AHEAD = 14;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily check-in",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#d97706",
  });
}

export const remindersEnabled = async () => (await readJson<boolean>(ENABLED_KEY)) === true;

/** Asks for permission; false when the user (or the OS) says no. */
export async function enableReminders(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted ||
    (await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    })).granted;
  if (!granted) return false;
  await writeJson(ENABLED_KEY, true);
  return true;
}

export async function disableReminders(): Promise<void> {
  await writeJson(ENABLED_KEY, false);
  await Notifications.cancelAllScheduledNotificationsAsync();
}

const MESSAGES = [
  "How did today go? Your habits are waiting for an answer.",
  "A quick check-in keeps the gauges honest.",
  "Thirty seconds: tell your roadmap what you did today.",
];

/**
 * Re-plans the next two weeks of reminders. Pass `today` when it is already
 * at hand; otherwise it is fetched (and an offline failure plans every day).
 */
export async function syncReminders(user: UserInfo, today?: TodayResponse): Promise<void> {
  if (!(await remindersEnabled())) return;
  await ensureChannel();

  let answeredToday = false;
  try {
    const t = today ?? (await api<TodayResponse>("/api/checkins/today"));
    answeredToday = t.entries.length > 0 && t.allChecked;
  } catch {
    /* unknown: better one reminder too many than a silent missed day */
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (i === 0 && answeredToday) continue;
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, user.reminderHour);
    if (at.getTime() <= now.getTime()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "fromNowToSuccess",
        body: MESSAGES[i % MESSAGES.length],
        data: { url: "/checkin" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Fires a real notification in a few seconds — to see that it all works. */
export async function sendTestReminder(): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "fromNowToSuccess",
      body: "Test notification — your phone is set up!",
      data: { url: "/settings" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNEL_ID,
    },
  });
}
