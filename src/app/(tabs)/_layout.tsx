import { useEffect } from "react";
import { AppState } from "react-native";
import { router, Tabs } from "expo-router";
import * as Notifications from "expo-notifications";
import { BarChart3, ClipboardList, ListChecks, Map as MapIcon, Settings } from "lucide-react-native";
import { AppHeader } from "@/components/AppHeader";
import { OnboardingProvider } from "@/components/OnboardingGuide";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useUser } from "@/lib/auth";
import { syncReminders } from "@/lib/reminders";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const user = useUser();
  const { c } = useTheme();

  // Tapping a reminder opens the screen it is about.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === "string") router.navigate(url as "/checkin");
    });
    return () => sub.remove();
  }, []);

  // Re-plan the reminders whenever the app comes back to the foreground.
  useEffect(() => {
    void syncReminders(user);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncReminders(user);
    });
    return () => sub.remove();
  }, [user]);

  return (
    <OnboardingProvider userId={user.id}>
      <Tabs
        screenOptions={{
          header: () => <AppHeader />,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.inkFaint,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
          sceneStyle: { backgroundColor: c.page },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Roadmap", tabBarIcon: ({ color, size }) => <MapIcon size={size - 2} color={color} /> }}
        />
        <Tabs.Screen
          name="checkin"
          options={{ title: "Check-in", tabBarIcon: ({ color, size }) => <ListChecks size={size - 2} color={color} /> }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: "Plan",
            // Opt-in: no tab at all until the user turns the planner on.
            href: user.plannerEnabled ? undefined : null,
            tabBarIcon: ({ color, size }) => <ClipboardList size={size - 2} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{ title: "Stats", tabBarIcon: ({ color, size }) => <BarChart3 size={size - 2} color={color} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} /> }}
        />
      </Tabs>
      <UpdatePrompt />
    </OnboardingProvider>
  );
}
