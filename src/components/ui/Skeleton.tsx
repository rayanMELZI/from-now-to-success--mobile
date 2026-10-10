import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/lib/theme";

export function Skeleton({
  height,
  width = "100%",
  radius = 10,
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
}) {
  const { c } = useTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.45, { duration: 800 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius, backgroundColor: c.surfaceSunken }, style]}
    />
  );
}

/** The shape of a screen while its first fetch is in flight. */
export function SkeletonScreen({ cards = 4 }: { cards?: number }) {
  return (
    <View style={{ padding: 16, gap: 12 }} accessibilityLabel="Loading">
      <Skeleton height={26} width={180} />
      <Skeleton height={14} width={240} />
      <View style={{ height: 6 }} />
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} height={96} radius={16} />
      ))}
    </View>
  );
}
