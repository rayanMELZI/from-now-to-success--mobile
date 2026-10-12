import { useEffect } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Signed in → the tabs; signed out → login/register. The guards do every
 * redirect, so logging in or out is just a change of `user`.
 */
function RootNavigator() {
  const { user, loading } = useAuth();
  const { c, isDark } = useTheme();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  return (
    <NavigationTheme
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: c.accent,
          background: c.page,
          card: c.surface,
          text: c.ink,
          border: c.line,
        },
      }}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.page } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </NavigationTheme>
  );
}
