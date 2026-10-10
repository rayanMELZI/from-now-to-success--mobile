import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Ban, Flame, Lock, Pencil, TimerReset, Trash2, Trophy } from "lucide-react-native";
import {
  demotionFloor,
  formatDuration,
  habitRisk,
  scheduleLabel,
  type Habit,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Banner } from "./ui/Card";
import { Btn } from "./ui/Button";
import { Txt } from "./ui/Txt";
import { GaugeBar } from "./GaugeBar";

/** What the details sheet shows when an island or a list card is tapped. */
export function HabitDetails({
  habit,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { tone, c } = useTheme();
  const risk = habitRisk(habit);
  const timer = habit.trackingMode === "TIMER";

  // A timer habit shows a running clock; it only ticks while the sheet is open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const rows: [string, ReactNode][] = [["Status", <Txt key="s" weight="600">{habit.status.toLowerCase()}</Txt>]];
  if (timer) {
    rows.push(
      ["Goal", <Txt key="g">{formatDuration(habit.goalSeconds ?? 0)} clean</Txt>],
      [
        "Running for",
        <Inline key="r" icon={<TimerReset size={14} color={tw.sky[500]} />}>
          {habit.clockStartedAt
            ? formatDuration((nowMs - Date.parse(habit.clockStartedAt)) / 1000)
            : "not started"}
        </Inline>,
      ],
      [
        "Best run",
        <Inline key="b" icon={<Trophy size={14} color={tw.amber[500]} />}>
          {habit.bestCleanSeconds > 0 ? formatDuration(habit.bestCleanSeconds) : "—"}
        </Inline>,
      ],
    );
  } else {
    rows.push(
      [
        "Rhythm",
        <Txt key="rh">
          {scheduleLabel[habit.schedule]}
          {habit.schedule !== "DAILY" && ` · ${habit.timesPerPeriod}×`}
        </Txt>,
      ],
      [
        "Streak",
        <Inline key="st" icon={<Flame size={14} color={tw.orange[500]} />}>
          {`${habit.currentStreak}  (best ${habit.bestStreak})`}
        </Inline>,
      ],
    );
  }
  rows.push(["Points", <Txt key="p">{habit.basePoints}</Txt>]);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {habit.habitType === "QUIT" && <Ban size={17} color={tw.red[500]} />}
          <Txt variant="heading" style={{ flex: 1 }}>
            {habit.name}
          </Txt>
        </View>
        {habit.description ? (
          <Txt variant="small" color="soft" style={{ marginTop: 4 }}>
            {habit.description}
          </Txt>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <Txt variant="label">{timer ? "Milestones" : "Validation gauge"}</Txt>
        <GaugeBar gauge={habit.gauge} max={habit.requiredStreak} valid={habit.status === "VALID"} timer={timer} />
      </View>

      {risk && (
        <Banner tone={risk === "critical" ? "danger" : "warning"}>
          {`Validated, but the gauge has slipped to ${habit.gauge}/${habit.requiredStreak}. Below ${demotionFloor(
            habit.requiredStreak,
          )} it drops back to in progress and re-locks whatever it unlocked.`}
        </Banner>
      )}

      <View style={{ gap: 10 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center" }}>
            <Txt color="soft" style={{ width: 120 }}>
              {label}
            </Txt>
            <View style={{ flex: 1 }}>{value}</View>
          </View>
        ))}
      </View>

      {habit.status === "LOCKED" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: c.surfaceSunken,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <Lock size={13} color={c.inkSoft} />
          <Txt variant="small" color="soft" style={{ flex: 1 }}>
            Unlocks when all its prerequisite habits are valid.
          </Txt>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Edit" variant="ghost" icon={<Pencil size={15} color={c.ink} />} onPress={onEdit} flex />
        <Btn
          label="Delete"
          variant="outline"
          tone="danger"
          icon={<Trash2 size={15} color={tone.danger.solid} />}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

function Inline({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {icon}
      <Txt>{children}</Txt>
    </View>
  );
}

