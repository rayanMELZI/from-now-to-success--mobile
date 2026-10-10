import { useEffect, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { useTheme, type ToneName } from "@/lib/theme";

/** A result that floats over the screen instead of pushing it down. */
export function Toast({
  open,
  tone = "success",
  onClose,
  children,
  duration = 6000,
}: {
  open: boolean;
  tone?: ToneName;
  onClose: () => void;
  children: ReactNode;
  duration?: number;
}) {
  const { c, tone: tones } = useTheme();
  const t = tones[tone];

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [open, onClose, duration]);

  if (!open) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: c.surface,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <View style={{ width: 4, borderRadius: 2, backgroundColor: t.solid }} />
        <View style={{ flex: 1, gap: 2 }}>{children}</View>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Dismiss">
          <X size={16} color={c.inkFaint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
