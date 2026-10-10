import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { AlertTriangle, Sparkles } from "lucide-react-native";
import { DEMOTION_RATIO, gaugeRisk } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Txt } from "./ui/Txt";

/**
 * The habit gauge: fills toward validation, drops on misses. The tick marks
 * the demotion floor (60%); once a validated habit's fill sits on it the bar
 * warms to amber one miss early, then to rose when the next miss costs it.
 */
export function GaugeBar({
  gauge,
  max,
  valid,
  timer = false,
  style,
}: {
  gauge: number;
  max: number;
  valid: boolean;
  /** Timer habits fall all at once, so the near-the-floor warning is skipped. */
  timer?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, isDark } = useTheme();
  const pct = max > 0 ? Math.min(100, (gauge / max) * 100) : 0;
  const full = gauge >= max;
  const risk = timer ? null : gaugeRisk(gauge, max, valid);

  const colors: [string, string] = full
    ? [tw.emerald[400], tw.emerald[500]]
    : risk === "critical"
      ? [tw.rose[400], tw.rose[500]]
      : risk === "caution"
        ? [tw.amber[400], tw.orange[500]]
        : valid
          ? [tw.emerald[300], tw.emerald[400]]
          : [tw.amber[300], tw.amber[500]];

  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pct, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  const labelColor = full
    ? isDark ? tw.emerald[400] : tw.emerald[600]
    : risk === "critical"
      ? isDark ? tw.rose[400] : tw.rose[600]
      : risk === "caution"
        ? isDark ? tw.amber[400] : tw.amber[700]
        : c.inkSoft;

  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}
      accessibilityLabel={`Gauge ${gauge} of ${max}`}
    >
      <View
        style={{ flex: 1, height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: c.track }}
      >
        <Animated.View style={[{ height: "100%", borderRadius: 5, overflow: "hidden" }, fill]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        {/* demotion floor tick — drawn hard once the fill is nearly on it */}
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${DEMOTION_RATIO * 100}%`,
            width: risk ? 2 : 1,
            backgroundColor:
              risk === "critical"
                ? isDark ? tw.rose[200] : tw.rose[700]
                : risk === "caution"
                  ? isDark ? tw.amber[200] : tw.amber[700]
                  : c.inkFaint,
            opacity: risk ? 1 : 0.7,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {risk && <AlertTriangle size={11} color={labelColor} />}
        <Txt variant="tiny" weight="600" color={labelColor} tabular>
          {gauge}/{max}
        </Txt>
        {full && <Sparkles size={11} color={tw.emerald[500]} />}
      </View>
    </View>
  );
}
