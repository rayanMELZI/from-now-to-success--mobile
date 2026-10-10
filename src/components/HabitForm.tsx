import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ban, CalendarCheck, ChevronDown, Sprout, TimerReset } from "lucide-react-native";
import {
  GOAL_PRESETS,
  formatDuration,
  type Habit,
  type HabitRequest,
  type HabitSchedule,
  type HabitType,
  type TrackingMode,
} from "@/lib/types";
import { errorMessage } from "@/lib/api";
import { tw, useTheme } from "@/lib/theme";
import { Banner } from "./ui/Card";
import { Btn } from "./ui/Button";
import { Field, Labeled, Stepper } from "./ui/Field";
import { Segmented } from "./ui/Segmented";
import { Txt } from "./ui/Txt";
import { HabitPicker } from "./HabitPicker";

const DAY_SECONDS = 86400;
const DEFAULT_POINTS = 10;
const DEFAULT_STREAK = 7;

/**
 * Creating a habit asks four questions — what, how it is tracked, build or
 * quit, and how often. Points, validation length and prerequisites stay in
 * sight; tracking mode and notes live behind "Advanced".
 */
export function HabitForm({
  allHabits,
  initial,
  onSubmit,
  onCancel,
}: {
  allHabits: Habit[];
  initial?: Habit;
  onSubmit: (request: HabitRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const { c, tone } = useTheme();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [basePoints, setBasePoints] = useState(initial?.basePoints ?? DEFAULT_POINTS);
  const [requiredStreak, setRequiredStreak] = useState(initial?.requiredStreak ?? DEFAULT_STREAK);
  const [schedule, setSchedule] = useState<HabitSchedule>(initial?.schedule ?? "DAILY");
  const [habitType, setHabitType] = useState<HabitType>(initial?.habitType ?? "BUILD");
  const [timesPerPeriod, setTimesPerPeriod] = useState(initial?.timesPerPeriod ?? 1);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(initial?.trackingMode ?? "SCHEDULED");
  const [goalSeconds, setGoalSeconds] = useState(initial?.goalSeconds ?? 30 * DAY_SECONDS);
  const [prereqIds, setPrereqIds] = useState<number[]>(initial?.prerequisiteIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    initial !== undefined && (initial.trackingMode === "TIMER" || (initial.description ?? "") !== ""),
  );

  const candidates = allHabits.filter((h) => h.id !== initial?.id);
  const periodNoun = schedule === "WEEKLY" ? "week" : "month";
  const streakNoun = schedule === "DAILY" ? "days" : schedule === "WEEKLY" ? "weeks" : "months";
  const timer = trackingMode === "TIMER";
  const goalDays = Math.max(1, Math.round(goalSeconds / DAY_SECONDS));

  async function submit() {
    if (!name.trim()) {
      setError("Give the habit a name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description || undefined,
        basePoints,
        trackingMode,
        prerequisiteIds: prereqIds,
        // A timer is always about staying away from something, and its gauge
        // is the milestone ladder — the server sizes it from the goal.
        ...(timer
          ? { habitType: "QUIT" as const, goalSeconds }
          : {
              habitType,
              requiredStreak,
              schedule,
              timesPerPeriod: schedule === "DAILY" ? 1 : timesPerPeriod,
            }),
      });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Txt variant="heading">{initial ? "Edit habit" : "New habit"}</Txt>

      {error && <Banner>{error}</Banner>}

      <Labeled label="Habit name">
        <Field
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus={!initial}
          placeholder={timer ? "e.g. smoking" : habitType === "QUIT" ? "e.g. doomscrolling at night" : "e.g. 5 prayers"}
        />
      </Labeled>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        {!timer && (
          <View style={{ flex: 1 }}>
            <Labeled label="Goal">
              <Segmented
                value={habitType}
                onChange={setHabitType}
                options={[
                  { value: "BUILD", label: "Build it", icon: <Sprout size={14} color={tw.emerald[600]} /> },
                  { value: "QUIT", label: "Quit it", icon: <Ban size={14} color={tw.red[500]} /> },
                ]}
              />
            </Labeled>
          </View>
        )}
        <Pressable
          onPress={() => setAdvancedOpen(!advancedOpen)}
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          style={{
            flex: timer ? 1 : undefined,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            height: 46,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: advancedOpen ? c.accent : c.lineStrong,
            backgroundColor: advancedOpen ? tone.accent.bg : "transparent",
          }}
        >
          <ChevronDown
            size={15}
            color={advancedOpen ? tone.accent.text : c.inkSoft}
            style={{ transform: [{ rotate: advancedOpen ? "0deg" : "-90deg" }] }}
          />
          <Txt variant="small" weight="600" color={advancedOpen ? tone.accent.text : "soft"}>
            Advanced
          </Txt>
        </Pressable>
      </View>

      {advancedOpen && (
        <Labeled
          label="Tracking"
          hint="Almost every habit is a check-in. A timer is the rarer kind: one clock that runs until you slip, instead of a daily question."
        >
          <Segmented
            value={trackingMode}
            onChange={setTrackingMode}
            options={[
              { value: "SCHEDULED", label: "Check-in", icon: <CalendarCheck size={14} color={c.accent} /> },
              { value: "TIMER", label: "Timer", icon: <TimerReset size={14} color={tw.sky[500]} /> },
            ]}
          />
        </Labeled>
      )}

      {timer && (
        <Banner tone="info">
          A clock that runs until you slip and reset it. No daily question — you just try to make each run longer than the last.
        </Banner>
      )}

      {timer ? (
        <Labeled
          label="Stay clean for"
          hint={`Reaching ${formatDuration(goalSeconds)} clean validates the habit. Shorter milestones along the way (a day, a week, a month…) pay points as you pass them.`}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GOAL_PRESETS.map((preset) => {
              const on = goalSeconds === preset.seconds;
              return (
                <Pressable
                  key={preset.seconds}
                  onPress={() => setGoalSeconds(preset.seconds)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? tw.sky[500] : c.lineStrong,
                    backgroundColor: on ? tone.info.bg : "transparent",
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Txt variant="small" weight="500" color={on ? tone.info.text : "soft"}>
                    {preset.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={[rowBox, { backgroundColor: tone.info.bg }]}>
            <Txt variant="small" color="soft">
              Days
            </Txt>
            <Stepper
              label="days clean"
              value={goalDays}
              min={1}
              max={1825}
              onChange={(days) => setGoalSeconds(days * DAY_SECONDS)}
            />
          </View>
        </Labeled>
      ) : (
        <Labeled label="Rhythm">
          <Segmented
            value={schedule}
            onChange={setSchedule}
            options={[
              { value: "DAILY", label: "Daily" },
              { value: "WEEKLY", label: "Weekly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
          />
          {schedule !== "DAILY" && (
            <View style={[rowBox, { backgroundColor: tone.accent.bg }]}>
              <Txt variant="small" color="soft">
                Times per {periodNoun}
              </Txt>
              <Stepper
                label={`times per ${periodNoun}`}
                value={timesPerPeriod}
                min={1}
                max={30}
                onChange={setTimesPerPeriod}
                suffix="×"
              />
            </View>
          )}
        </Labeled>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <Labeled label={`Points ${timer ? "per milestone" : "per check-in"}`}>
          <Stepper label="points" value={basePoints} min={1} max={100} onChange={setBasePoints} />
        </Labeled>
        {!timer && (
          <Labeled label={`${streakNoun} to validate`}>
            <Stepper
              label={`${streakNoun} to validate`}
              value={requiredStreak}
              min={2}
              max={90}
              onChange={setRequiredStreak}
            />
          </Labeled>
        )}
      </View>

      {advancedOpen && (
        <Labeled label="Notes (optional)">
          <Field
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            placeholder="Why this habit matters to you…"
          />
        </Labeled>
      )}

      {candidates.length > 0 && (
        <Labeled
          label="Unlocks after (prerequisites)"
          hint="This habit stays locked until every habit you pick here is valid."
        >
          <HabitPicker
            habits={candidates}
            selectedIds={prereqIds}
            onToggle={(habit) =>
              setPrereqIds((current) =>
                current.includes(habit.id) ? current.filter((p) => p !== habit.id) : [...current, habit.id],
              )
            }
            placeholder="Search habits to require first…"
          />
        </Labeled>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn
          label={busy ? "Saving…" : initial ? "Save changes" : "Add to roadmap"}
          onPress={submit}
          loading={busy}
          flex
        />
        <Btn label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const rowBox = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 8,
  marginTop: 6,
};
