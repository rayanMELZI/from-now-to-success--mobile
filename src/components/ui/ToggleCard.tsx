import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme, type Tone } from "@/lib/theme";
import { Txt } from "./Txt";

/**
 * The web app's "ice card" switch: an icon badge, a title and a line of
 * explanation, and a track that lights up when it is on. Used for the streak
 * freeze and for the opt-in daily plan.
 */
export function ToggleCard({
  active,
  title,
  subtitle,
  icon,
  tone,
  disabled,
  locked,
  onToggle,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: (color: string) => ReactNode;
  tone: Tone;
  disabled?: boolean;
  /** No switch drawn: the card states a fact rather than offering a choice. */
  locked?: boolean;
  onToggle?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled || locked}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggle?.();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled: !!disabled }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: active ? tone.solid : c.line,
        backgroundColor: active ? tone.bg : "transparent",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? tone.solid : tone.bg,
          transform: [{ scale: active ? 1.08 : 1 }],
        }}
      >
        {icon(active ? "#ffffff" : tone.solid)}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="small" weight="700" color={active ? tone.text : "ink"}>
          {title}
        </Txt>
        <Txt variant="tiny" color="soft">
          {subtitle}
        </Txt>
      </View>
      {!locked && (
        <View
          style={{
            width: 44,
            height: 26,
            borderRadius: 13,
            backgroundColor: active ? tone.solid : c.lineStrong,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#ffffff",
              marginLeft: active ? 21 : 3,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}
