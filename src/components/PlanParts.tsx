import { useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, Ban, Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react-native";
import {
  formatGap,
  formatMinute,
  type Habit,
  type PlanBlock,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Btn, IconBtn } from "./ui/Button";
import { Field, Labeled } from "./ui/Field";
import { DateTimeInput } from "./ui/Pickers";
import { Txt } from "./ui/Txt";
import { HabitPicker } from "./HabitPicker";

export const DAY_MINUTES = 24 * 60;
const SHIFT_PRESETS = [5, 10, 15, 30, 60];
export const MIN_SHIFT = 1;
export const MAX_SHIFT = 12 * 60;

function minuteToDate(minute: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

/** "5 prayers" — the habit a block was picked from. */
function HabitChip({ name, quit }: { name: string; quit: boolean }) {
  const { tone } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: tone.accent.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      {quit ? <Ban size={10} color={tone.accent.text} /> : <Sparkles size={10} color={tone.accent.text} />}
      <Txt variant="tiny" color={tone.accent.text} numberOfLines={1}>
        {name}
      </Txt>
    </View>
  );
}

/** The amber hairline that says "you are here". */
export function NowLine({ minute }: { minute: number }) {
  const { isDark } = useTheme();
  const amber = isDark ? tw.amber[400] : tw.amber[600];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
      <Txt variant="tiny" weight="700" color={amber} tabular style={{ width: 50, textAlign: "right" }}>
        {formatMinute(minute)}
      </Txt>
      <View style={{ width: 18, alignItems: "center" }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: tw.amber[500] }} />
      </View>
      <View style={{ flex: 1, height: 1.5, backgroundColor: tw.amber[400] }} />
    </View>
  );
}

/** One line of the day: the done dot on the rail, the card beside it. */
export function BlockRow({
  block,
  habit,
  entry,
  current,
  last,
  attachedAbove,
  attachedBelow,
  selecting,
  selected,
  pending,
  busy,
  onToggleDone,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  block: PlanBlock;
  habit: Habit | null;
  entry: TodayEntry | null;
  current: boolean;
  last: boolean;
  attachedAbove: boolean;
  attachedBelow: boolean;
  selecting: boolean;
  selected: boolean;
  pending: boolean;
  busy: boolean;
  onToggleDone: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { c, tone, isDark } = useTheme();
  const checkedIn = entry?.todayStatus === "DONE" || entry?.todayStatus === "DONE_TODAY";

  const cardBorder = selecting && selected ? tw.amber[400] : current ? (isDark ? "rgba(245,158,11,0.4)" : tw.amber[300]) : c.line;
  const cardBg = selecting && selected ? tone.accent.bg : current ? (isDark ? "rgba(251,191,36,0.08)" : "rgba(255,251,235,0.8)") : c.surface;

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {/* rail: the dot is the done switch — or, in shift mode, the tick box */}
      <View style={{ width: 18, alignItems: "center", paddingTop: 10 }}>
        {selecting ? (
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: selected ? tw.amber[500] : c.lineStrong,
              backgroundColor: selected ? tw.amber[500] : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selected && <Check size={11} color="#fff" strokeWidth={3.5} />}
          </View>
        ) : (
          <Pressable
            onPress={onToggleDone}
            disabled={busy || pending}
            hitSlop={14}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: block.done }}
            accessibilityLabel={block.done ? `Undo ${block.title}` : `Mark ${block.title} done`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 2,
              borderColor: block.done ? tw.emerald[500] : current ? tw.amber[500] : c.lineStrong,
              backgroundColor: block.done ? tw.emerald[500] : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {block.done && <Check size={11} color="#fff" strokeWidth={3.5} />}
          </Pressable>
        )}
        {!last && <View style={{ width: 1, flex: 1, marginTop: 4, backgroundColor: c.line }} />}
      </View>

      <Pressable
        onPress={selecting ? onToggleSelect : onEdit}
        disabled={busy && selecting}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: cardBorder,
          backgroundColor: cardBg,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderTopLeftRadius: attachedAbove ? 0 : 12,
          borderTopRightRadius: attachedAbove ? 0 : 12,
          borderBottomLeftRadius: attachedBelow ? 0 : 12,
          borderBottomRightRadius: attachedBelow ? 0 : 12,
          marginTop: attachedAbove ? -1 : 0,
          marginBottom: attachedBelow ? 0 : 8,
          opacity: block.done ? 0.6 : 1,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 6,
        }}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Txt variant="small" weight="600" color={block.done ? "faint" : "ink"} strike={block.done}>
            {block.title}
          </Txt>
          {(block.habitName || checkedIn) && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {block.habitName && <HabitChip name={block.habitName} quit={habit?.habitType === "QUIT"} />}
              {checkedIn && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: tone.success.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Check size={10} color={tone.success.text} />
                  <Txt variant="tiny" color={tone.success.text}>
                    checked in
                  </Txt>
                </View>
              )}
            </View>
          )}
        </View>
        {!selecting && (
          <IconBtn label={`Delete ${block.title}`} onPress={onDelete} size={32} disabled={busy}>
            <Trash2 size={15} color={c.inkFaint} />
          </IconBtn>
        )}
      </Pressable>
    </View>
  );
}

/** Shift mode's control panel, floating at the foot of the screen. */
export function ShiftBar({
  selectedCount,
  totalCount,
  amount,
  busy,
  onAmount,
  onSelectAll,
  onClear,
  onShift,
  onDone,
}: {
  selectedCount: number;
  totalCount: number;
  amount: number;
  busy: boolean;
  onAmount: (minutes: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onShift: (delta: number) => void;
  onDone: () => void;
}) {
  const { c } = useTheme();
  const ready = amount >= MIN_SHIFT && amount <= MAX_SHIFT && selectedCount > 0 && !busy;
  const custom = !SHIFT_PRESETS.includes(amount);

  return (
    <View style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tw.amber[300],
          padding: 12,
          gap: 10,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt variant="small" weight="700" style={{ flex: 1 }}>
            {selectedCount === 0 ? "Pick the lines to move" : `${selectedCount} of ${totalCount} picked`}
          </Txt>
          <Btn
            size="sm"
            variant="plain"
            label={selectedCount === totalCount ? "Clear" : "Select all"}
            onPress={selectedCount === totalCount ? onClear : onSelectAll}
          />
          <IconBtn label="Leave shift mode" onPress={onDone} size={32}>
            <X size={16} color={c.inkSoft} />
          </IconBtn>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <Txt variant="label">By</Txt>
          {SHIFT_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => onAmount(preset)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 11,
                paddingVertical: 6,
                backgroundColor: amount === preset ? tw.amber[500] : c.surfaceSunken,
              }}
            >
              <Txt variant="tiny" weight="600" color={amount === preset ? "#fff" : "soft"}>
                {formatGap(preset)}
              </Txt>
            </Pressable>
          ))}
          <Field
            value={String(amount)}
            onChangeText={(t) => onAmount(Number(t.replace(/\D/g, "")) || 0)}
            keyboardType="number-pad"
            accessibilityLabel="Minutes to move by"
            style={{ width: 64, minHeight: 34, fontSize: 14, borderColor: custom ? tw.amber[400] : c.lineStrong }}
          />
          <Txt variant="tiny" color="faint">
            min
          </Txt>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn variant="ghost" label="Earlier" icon={<ArrowUp size={15} color={c.ink} />} onPress={() => onShift(-amount)} disabled={!ready} flex />
          <Btn label="Later" icon={<ArrowDown size={15} color="#fff" />} onPress={() => onShift(amount)} disabled={!ready} loading={busy} flex />
        </View>
      </View>
    </View>
  );
}

/** The time + title + habit trio, for adding a line and for editing one. */
export function BlockFields({
  habits,
  initial,
  busy,
  suggestedMinute,
  plannedHabitIds,
  today,
  isToday,
  onSubmit,
  onCancel,
  onToggleMuted,
}: {
  habits: Habit[];
  initial?: PlanBlock;
  busy: boolean;
  suggestedMinute?: number;
  plannedHabitIds?: number[];
  today?: TodayResponse | null;
  isToday?: boolean;
  onSubmit: (title: string, endMinute: number, habitId: number | null) => Promise<boolean>;
  onCancel: () => void;
  onToggleMuted: (habit: Habit) => void;
}) {
  const [minute, setMinute] = useState(initial?.endMinute ?? suggestedMinute ?? 8 * 60);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [habitId, setHabitId] = useState<number | null>(initial?.habitId ?? null);
  const [added, setAdded] = useState(0);

  // Locked habits are not doable yet, so they never belong in a day's plan.
  const pickable = habits.filter((h) => h.status !== "LOCKED");
  const valid = title.trim().length > 0;

  function pickHabit(habit: Habit) {
    if (habitId === habit.id) {
      setHabitId(null);
      return;
    }
    setHabitId(habit.id);
    if (!title.trim() || habits.some((h) => h.name === title.trim())) setTitle(habit.name);
  }

  async function submit() {
    if (!valid) return;
    const ok = await onSubmit(title.trim(), minute, habitId);
    if (ok && !initial) {
      // Ready for the next line, ten minutes on.
      setTitle("");
      setHabitId(null);
      setMinute(Math.min(DAY_MINUTES - 1, minute + 10));
      setAdded(added + 1);
    }
  }

  const pendingIds = new Set(
    isToday ? (today?.entries ?? []).filter((e) => e.todayStatus === "PENDING").map((e) => e.habitId) : [],
  );

  return (
    <View style={{ gap: 14 }}>
      <Txt variant="heading">{initial ? "Edit line" : "Add to the plan"}</Txt>
      {added > 0 && !initial && (
        <Txt variant="tiny" color={tw.emerald[600]}>
          {added} line{added === 1 ? "" : "s"} added — keep going, or close when you are done.
        </Txt>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ width: 110 }}>
          <Labeled label="Done at">
            <DateTimeInput
              mode="time"
              value={minuteToDate(minute)}
              onChange={(d) => setMinute(d.getHours() * 60 + d.getMinutes())}
              accessibilityLabel="The time this is finished"
            />
          </Labeled>
        </View>
        <View style={{ flex: 1 }}>
          <Labeled label="What">
            <Field
              value={title}
              maxLength={120}
              onChangeText={setTitle}
              placeholder="Finished doing what?"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </Labeled>
        </View>
      </View>

      {pickable.length > 0 && (
        <Labeled label="Or pick a habit">
          <HabitPicker
            habits={pickable}
            selectedIds={habitId === null ? [] : [habitId]}
            onToggle={pickHabit}
            placeholder="Search a habit to plan…"
            searchThreshold={0}
            dimmed={(habit) => plannedHabitIds?.includes(habit.id) ?? false}
            muted={(habit) => habit.plannerMuted}
            onToggleMuted={onToggleMuted}
            meta={(habit) =>
              pendingIds.has(habit.id) && habitId !== habit.id ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tw.emerald[500] }} />
              ) : null
            }
          />
        </Labeled>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn
          label={initial ? "Save" : "Add line"}
          icon={initial ? <Pencil size={15} color="#fff" /> : <Plus size={15} color="#fff" />}
          onPress={submit}
          disabled={!valid}
          loading={busy}
          flex
        />
        <Btn label={initial || added === 0 ? "Cancel" : "Done"} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
