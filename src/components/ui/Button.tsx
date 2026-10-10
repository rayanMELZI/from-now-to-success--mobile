import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { tw, useTheme, type ToneName } from "@/lib/theme";
import { Txt } from "./Txt";

type Variant = "primary" | "ghost" | "solid" | "outline" | "plain";

interface BtnProps {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  /** For "solid" and "outline": which colour family. */
  tone?: ToneName;
  size?: "md" | "sm";
  disabled?: boolean;
  loading?: boolean;
  flex?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** The app's one button: primary amber, ghost, or a tinted solid/outline. */
export function Btn({
  label,
  icon,
  onPress,
  variant = "primary",
  tone = "accent",
  size = "md",
  disabled,
  loading,
  flex,
  haptic = true,
  style,
  accessibilityLabel,
}: BtnProps) {
  const { c, tone: tones, isDark } = useTheme();
  const t = tones[tone];

  const palette: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: { bg: isDark ? tw.amber[500] : tw.amber[600], border: "transparent", text: isDark ? "#1c1917" : "#ffffff" },
    ghost: { bg: "transparent", border: c.lineStrong, text: c.ink },
    solid: { bg: t.solid, border: "transparent", text: "#ffffff" },
    outline: { bg: "transparent", border: t.border, text: tone === "danger" || tone === "deep" ? (isDark ? tw.rose[400] : tw.rose[600]) : tone === "info" ? (isDark ? tw.sky[400] : tw.sky[600]) : t.text },
    plain: { bg: "transparent", border: "transparent", text: c.inkSoft },
  };
  const p = palette[variant];
  const off = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        if (haptic) void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        { backgroundColor: p.bg, borderColor: p.border },
        flex && { flex: 1 },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          {label ? (
            <Txt variant={size === "sm" ? "small" : "body"} weight="600" color={p.text}>
              {label}
            </Txt>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/** A round, icon-only button — always at least a thumb wide. */
export function IconBtn({
  children,
  onPress,
  label,
  bordered,
  size = 40,
  disabled,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
  bordered?: boolean;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: bordered ? 1 : 0,
          borderColor: c.lineStrong,
        },
        pressed && { backgroundColor: c.surfaceSunken },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  md: { minHeight: 46, paddingHorizontal: 16 },
  sm: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
});
