import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { loadJson, saveJson } from "./storage";

/** The Tailwind shades the web app uses, so both apps share one palette. */
export const tw = {
  amber: {
    50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24",
    500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f",
  },
  emerald: {
    50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399",
    500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b",
  },
  rose: {
    50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185",
    500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337",
  },
  sky: {
    50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8",
    500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e",
  },
  red: { 50: "#fef2f2", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
  stone: { 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c" },
  orange: { 500: "#f97316" },
  violet: { 100: "#ede9fe", 300: "#c4b5fd", 700: "#6d28d9" },
  lime: { 100: "#ecfccb", 300: "#bef264", 700: "#4d7c0f" },
} as const;

export interface Palette {
  surface: string;
  surfaceSunken: string;
  page: string;
  line: string;
  lineStrong: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  field: string;
  track: string;
}

const light: Palette = {
  surface: "#ffffff",
  surfaceSunken: "#f5f5f4",
  page: "#f5f5f4",
  line: "#e7e5e4",
  lineStrong: "#d6d3d1",
  ink: "#292524",
  inkSoft: "#57534e",
  inkFaint: "#a8a29e",
  accent: "#d97706",
  accentSoft: "#fef3c7",
  accentInk: "#92400e",
  field: "#ffffff",
  track: "#e7e5e4",
};

const dark: Palette = {
  surface: "#1c1917",
  surfaceSunken: "#292524",
  page: "#0c0a09",
  line: "#292524",
  lineStrong: "#44403c",
  ink: "#e7e5e4",
  inkSoft: "#a8a29e",
  inkFaint: "#78716c",
  accent: "#f59e0b",
  accentSoft: "rgba(245, 158, 11, 0.15)",
  accentInk: "#fcd34d",
  field: "#292524",
  track: "#44403c",
};

/**
 * A tinted message or chip in one of the app's moods: background, border and
 * text that stay readable in both themes.
 */
export type ToneName = "success" | "warning" | "danger" | "info" | "accent" | "neutral" | "deep";
export interface Tone {
  bg: string;
  border: string;
  text: string;
  solid: string;
}

function tones(isDark: boolean, c: Palette): Record<ToneName, Tone> {
  return isDark
    ? {
        success: { bg: "rgba(16,185,129,0.15)", border: "#065f46", text: tw.emerald[300], solid: tw.emerald[600] },
        warning: { bg: "rgba(245,158,11,0.15)", border: "#78350f", text: tw.amber[300], solid: tw.amber[500] },
        danger: { bg: "rgba(244,63,94,0.15)", border: "#881337", text: tw.rose[300], solid: tw.rose[500] },
        info: { bg: "rgba(14,165,233,0.15)", border: "#075985", text: tw.sky[300], solid: tw.sky[500] },
        accent: { bg: c.accentSoft, border: "rgba(245,158,11,0.4)", text: c.accentInk, solid: tw.amber[500] },
        neutral: { bg: c.surfaceSunken, border: c.lineStrong, text: c.inkSoft, solid: tw.stone[600] },
        deep: { bg: "rgba(244,63,94,0.15)", border: "#9f1239", text: tw.rose[300], solid: tw.rose[500] },
      }
    : {
        success: { bg: tw.emerald[50], border: tw.emerald[200], text: tw.emerald[800], solid: tw.emerald[600] },
        warning: { bg: tw.amber[50], border: tw.amber[300], text: tw.amber[800], solid: tw.amber[500] },
        danger: { bg: tw.rose[50], border: tw.rose[300], text: tw.rose[700], solid: tw.rose[500] },
        info: { bg: tw.sky[50], border: tw.sky[300], text: tw.sky[800], solid: tw.sky[500] },
        accent: { bg: c.accentSoft, border: tw.amber[300], text: c.accentInk, solid: tw.amber[600] },
        neutral: { bg: c.surfaceSunken, border: c.lineStrong, text: c.inkSoft, solid: tw.stone[700] },
        deep: { bg: tw.rose[50], border: tw.rose[400], text: tw.rose[700], solid: tw.rose[500] },
      };
}

export type ThemePreference = "light" | "system" | "dark";

interface ThemeState {
  c: Palette;
  tone: Record<ToneName, Tone>;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const PREF_KEY = "fnts.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => loadJson<ThemePreference>(PREF_KEY) ?? "system",
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveJson(PREF_KEY, next);
  }, []);

  const isDark = preference === "system" ? system === "dark" : preference === "dark";
  const c = isDark ? dark : light;

  return (
    <ThemeContext.Provider
      value={{ c, tone: tones(isDark, c), isDark, preference, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
