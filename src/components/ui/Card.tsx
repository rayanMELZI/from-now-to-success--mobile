import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react-native";
import { useTheme, type ToneName } from "@/lib/theme";
import { Txt } from "./Txt";

/** Anything that sits on the page: a white (or stone) rounded panel. */
export function Card({
  children,
  style,
  onPress,
  borderColor,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  borderColor?: string;
}) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderColor ?? c.line,
    padding: 14,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  );
}

/** A tinted line of feedback: an error, a success, a note. */
export function Banner({
  tone = "danger",
  children,
  onClose,
  style,
}: {
  tone?: ToneName;
  children: ReactNode;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { tone: tones } = useTheme();
  const t = tones[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" || tone === "warning" ? AlertTriangle : Info;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
          backgroundColor: t.bg,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 9,
        },
        style,
      ]}
    >
      <Icon size={15} color={t.text} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        {typeof children === "string" ? (
          <Txt variant="small" color={t.text}>
            {children}
          </Txt>
        ) : (
          children
        )}
      </View>
      {onClose && (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Dismiss">
          <X size={15} color={t.text} />
        </Pressable>
      )}
    </View>
  );
}

/** A small rounded pill: a status, a count, a badge. */
export function Chip({
  tone = "neutral",
  icon,
  label,
  bold,
}: {
  tone?: ToneName;
  icon?: ReactNode;
  label: string;
  bold?: boolean;
}) {
  const { tone: tones } = useTheme();
  const t = tones[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: t.bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      {icon}
      <Txt variant="tiny" color={t.text} weight={bold ? "600" : "500"}>
        {label}
      </Txt>
    </View>
  );
}
