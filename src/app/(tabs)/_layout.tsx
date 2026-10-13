import { useEffect, useState } from "react";
import { AppState, InteractionManager, View } from "react-native";
import { router, usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import * as Notifications from "expo-notifications";
import { AppHeader } from "@/components/AppHeader";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { OnboardingProvider } from "@/components/OnboardingGuide";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useUser } from "@/lib/auth";
import { syncReminders } from "@/lib/reminders";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const user = useUser();
  const { c } = useTheme();
  const pathname = usePathname();
  // One feedback sheet for the whole app, opened from any tab's header.
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Tapping a reminder opens the screen it is about.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string") router.navigate(url as "/checkin");
    });
    return () => sub.remove();
  }, []);

  // Re-plan the reminders when the app comes back to the foreground, or when
  // the reminder hour changes — not on every points update. It is never
  // urgent, so it waits until the first screen is on.
  const { reminderHour } = user;
  useEffect(() => {
    const sync = () => void syncReminders({ reminderHour });
    const task = InteractionManager.runAfterInteractions(sync);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => {
      task.cancel();
      sub.remove();
    };
  }, [reminderHour]);

  return (
    <OnboardingProvider userId={user.id}>
      {/* One header for the whole app, above the tabs rather than inside each. */}
      <View style={{ flex: 1, backgroundColor: c.page }}>
        <AppHeader onFeedback={() => setFeedbackOpen(true)} />
        {/* Android's own tab bar: every tab is built once at startup and a tap
            just shows it — no JavaScript between the tap and the switch. */}
        <NativeTabs
          backgroundColor={c.surface}
          iconColor={{ default: c.inkFaint, selected: c.accentInk }}
          labelStyle={{
            default: { color: c.inkFaint, fontSize: 11 },
            selected: { color: c.accentInk, fontSize: 11 },
          }}
          indicatorColor={c.accentSoft}
          rippleColor={c.accentSoft}
          labelVisibilityMode="labeled"
        >
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Icon md="map" />
            <NativeTabs.Trigger.Label>Roadmap</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="checkin">
            <NativeTabs.Trigger.Icon md="checklist" />
            <NativeTabs.Trigger.Label>Check-in</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          {/* Opt-in: no tab at all until the user turns the planner on. */}
          <NativeTabs.Trigger name="plan" hidden={!user.plannerEnabled}>
            <NativeTabs.Trigger.Icon md="assignment" />
            <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="stats">
            <NativeTabs.Trigger.Icon md="bar_chart" />
            <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Icon md="settings" />
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
      <UpdatePrompt />
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} page={pathname} />
    </OnboardingProvider>
  );
}
