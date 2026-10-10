import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { AlertTriangle, Ban, Sprout, TimerReset } from "lucide-react-native";
import { riskLabel, type RiskLevel } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Txt } from "./ui/Txt";

/** The little icon that says what kind of habit this is, at a glance. */
export function HabitIcon({
  habit,
  size = 14,
}: {
  habit: { trackingMode?: string; habitType: string };
  size?: number;
}) {
  if (habit.trackingMode === "TIMER") return <TimerReset size={size} color={tw.sky[500]} />;
  if (habit.habitType === "QUIT") return <Ban size={size} color={tw.red[500]} />;
  return <Sprout size={size} color={tw.emerald[600]} />;
}

/** "At risk" / "Slipping" — a colour on its own is not a warning. */
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { tone } = useTheme();
  const t = risk === "critical" ? tone.danger : tone.warning;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: t.bg,
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <AlertTriangle size={10} color={t.text} />
      <Txt variant="tiny" weight="700" color={t.text}>
        {riskLabel[risk]}
      </Txt>
    </View>
  );
}

/** The day's progress as a donut — readable at a glance. */
export function ProgressRing({ done, total, size = 68 }: { done: number; total: number; size?: number }) {
  const { c } = useTheme();
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke={c.track} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - pct)}
          stroke={pct >= 1 ? tw.emerald[500] : c.accent}
        />
      </Svg>
      <View
        style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Txt variant="small" weight="700" tabular>
          {done}
          <Txt variant="small" color="faint">
            /{total}
          </Txt>
        </Txt>
      </View>
    </View>
  );
}
