import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { Txt } from "./Txt";

export interface SegmentOption<T extends string> {
  value: T;
  label?: string;
  icon?: ReactNode;
  accessibilityLabel?: string;
}

/** The pill switch the web app uses everywhere: one choice out of a few. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  stretch = true,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: "md" | "sm";
  stretch?: boolean;
}) {
  const { c, isDark } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: c.surfaceSunken,
        borderRadius: 12,
        padding: 3,
        gap: 3,
        alignSelf: stretch ? "stretch" : "flex-start",
      }}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            style={{
              flex: stretch ? 1 : undefined,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: size === "sm" ? 32 : 40,
              paddingHorizontal: size === "sm" ? 10 : 12,
              borderRadius: 9,
              backgroundColor: on ? (isDark ? c.lineStrong : c.surface) : "transparent",
              shadowColor: "#000",
              shadowOpacity: on ? 0.08 : 0,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: on ? 1 : 0,
            }}
          >
            {option.icon}
            {option.label ? (
              <Txt
                variant={size === "sm" ? "small" : "body"}
                weight="600"
                color={on ? "ink" : "soft"}
                style={size === "md" ? { fontSize: 14 } : undefined}
              >
                {option.label}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
