import { forwardRef, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { Txt } from "./Txt";

/** A text field that reads as a field in both themes. */
export const Field = forwardRef<TextInput, TextInputProps & { icon?: ReactNode }>(
  function Field({ style, icon, multiline, ...rest }, ref) {
    const { c } = useTheme();
    const input = (
      <TextInput
        ref={ref}
        placeholderTextColor={c.inkFaint}
        multiline={multiline}
        {...rest}
        style={[
          {
            borderWidth: 1,
            borderColor: c.lineStrong,
            backgroundColor: c.field,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingLeft: icon ? 36 : 12,
            paddingVertical: multiline ? 10 : 0,
            minHeight: multiline ? 72 : 46,
            fontSize: 16,
            color: c.ink,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
    );
    if (!icon) return input;
    return (
      <View style={{ justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 12, zIndex: 1 }}>{icon}</View>
        {input}
      </View>
    );
  },
);

/** A label above a control, with an optional hint under it. */
export function Labeled({
  label,
  hint,
  children,
  right,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt variant="label">{label}</Txt>
        {right}
      </View>
      {children}
      {hint ? (
        <Txt variant="tiny" color="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** − value + : for the small whole numbers in the habit form. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
  label: string;
}) {
  const { c } = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const step = (delta: number) => {
    const next = clamp(value + delta);
    if (next !== value) void Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };
  const button = (text: string, delta: number, a11y: string) => (
    <Pressable
      onPress={() => step(delta)}
      onLongPress={() => step(delta * 5)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.lineStrong,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.surfaceSunken : "transparent",
      })}
    >
      <Txt variant="heading" color="soft">
        {text}
      </Txt>
    </Pressable>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {button("−", -1, `Decrease ${label}`)}
      <View
        accessibilityLiveRegion="polite"
        style={{
          minWidth: 64,
          height: 42,
          borderRadius: 10,
          backgroundColor: c.surfaceSunken,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          paddingHorizontal: 8,
        }}
      >
        <Txt weight="600" tabular>
          {value}
        </Txt>
        {suffix ? (
          <Txt color="soft" style={{ marginLeft: 3 }}>
            {suffix}
          </Txt>
        ) : null}
      </View>
      {button("+", 1, `Increase ${label}`)}
    </View>
  );
}
