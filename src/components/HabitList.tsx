import { useMemo, useState } from "react";
import { View } from "react-native";
import { Flame, Lock, Search, Trophy } from "lucide-react-native";
import { formatDuration, habitRisk, scheduleLabel, type Habit, type HabitStatus } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Card } from "./ui/Card";
import { Field } from "./ui/Field";
import { Txt } from "./ui/Txt";
import { GaugeBar } from "./GaugeBar";
import { HabitIcon, RiskBadge } from "./HabitBits";

const SECTIONS: { status: HabitStatus; label: string; hint: string }[] = [
  { status: "ACTIVE", label: "In progress", hint: "unlocked and waiting for you" },
  { status: "VALID", label: "Validated", hint: "these unlock what comes next" },
  { status: "LOCKED", label: "Locked", hint: "waiting on their prerequisites" },
];

/** The roadmap as something you can scroll, search and read. */
export function HabitList({
  habits,
  onSelect,
}: {
  habits: Habit[];
  onSelect: (habit: Habit) => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? habits.filter((h) => h.name.toLowerCase().includes(q)) : habits;
  }, [habits, query]);

  const sections = SECTIONS.map((s) => ({ ...s, items: matches.filter((h) => h.status === s.status) })).filter(
    (s) => s.items.length > 0,
  );

  return (
    <View style={{ gap: 18 }}>
      {habits.length > 6 && (
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search your habits…"
          autoCorrect={false}
          icon={<Search size={15} color={c.inkFaint} />}
        />
      )}

      {sections.length === 0 && (
        <Txt variant="small" color="faint" center style={{ paddingVertical: 24 }}>
          No habit matches that.
        </Txt>
      )}

      {sections.map((section) => (
        <View key={section.status} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt variant="label">{section.label}</Txt>
            <View style={{ backgroundColor: c.surfaceSunken, borderRadius: 999, paddingHorizontal: 7 }}>
              <Txt variant="tiny" weight="600" color="soft" tabular>
                {section.items.length}
              </Txt>
            </View>
            <Txt variant="tiny" color="faint" numberOfLines={1} style={{ flex: 1 }}>
              {section.hint}
            </Txt>
          </View>
          {section.items.map((habit) => (
            <HabitCard key={habit.id} habit={habit} onPress={() => onSelect(habit)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function HabitCard({ habit, onPress }: { habit: Habit; onPress: () => void }) {
  const { tone, c } = useTheme();
  const timer = habit.trackingMode === "TIMER";
  const locked = habit.status === "LOCKED";
  const risk = habitRisk(habit);

  return (
    <Card
      onPress={onPress}
      borderColor={risk === "critical" ? tone.danger.border : risk === "caution" ? tone.warning.border : undefined}
      style={{ opacity: locked ? 0.7 : 1, gap: 8 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {locked ? <Lock size={14} color={c.inkFaint} /> : <HabitIcon habit={habit} />}
        <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {habit.name}
        </Txt>
        {risk && <RiskBadge risk={risk} />}
      </View>
      <GaugeBar gauge={habit.gauge} max={habit.requiredStreak} valid={habit.status === "VALID"} timer={timer} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {timer ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Trophy size={12} color={tw.amber[500]} />
              <Txt variant="tiny" color="faint">
                {habit.bestCleanSeconds > 0 ? formatDuration(habit.bestCleanSeconds) : "no run yet"}
              </Txt>
            </View>
            <Txt variant="tiny" color="faint">
              goal {formatDuration(habit.goalSeconds ?? 0)}
            </Txt>
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Flame size={12} color={tw.orange[500]} />
              <Txt variant="tiny" color="faint">
                {habit.currentStreak}
              </Txt>
            </View>
            <Txt variant="tiny" color="faint">
              {scheduleLabel[habit.schedule]}
              {habit.schedule !== "DAILY" && ` · ${habit.timesPerPeriod}×`}
            </Txt>
          </>
        )}
        <Txt variant="tiny" color="faint">
          {habit.basePoints} pts
        </Txt>
      </View>
    </Card>
  );
}
