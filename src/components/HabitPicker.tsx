import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, Eye, EyeOff, Search, X } from "lucide-react-native";
import type { Habit } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { Field } from "./ui/Field";
import { Txt } from "./ui/Txt";
import { HabitIcon } from "./HabitBits";

interface HabitPickerProps {
  habits: Habit[];
  selectedIds: number[];
  onToggle: (habit: Habit) => void;
  /** Trailing badge for a row — "already planned", "unanswered today"… */
  meta?: (habit: Habit) => ReactNode;
  /** Draws a habit back without disabling it. */
  dimmed?: (habit: Habit) => boolean;
  /** Set aside: still pickable, but greyed and listed after the rest. */
  muted?: (habit: Habit) => boolean;
  onToggleMuted?: (habit: Habit) => void;
  /** Below this many habits the list is skipped for one-tap pills. */
  searchThreshold?: number;
  placeholder?: string;
}

/**
 * Pick habits out of a list that may be three long or three hundred: short
 * lists stay as one-tap pills; past the threshold it becomes a search box
 * over a scrolling list, with the current picks pulled out as chips above.
 */
export function HabitPicker({
  habits,
  selectedIds,
  onToggle,
  meta,
  dimmed,
  muted,
  onToggleMuted,
  searchThreshold = 6,
  placeholder = "Search your habits…",
}: HabitPickerProps) {
  const { c, tone } = useTheme();
  const [query, setQuery] = useState("");
  const isMuted = (habit: Habit) => muted?.(habit) ?? false;

  const ordered = useMemo(() => {
    if (!muted) return habits;
    return [...habits.filter((h) => !muted(h)), ...habits.filter((h) => muted(h))];
  }, [habits, muted]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ordered.filter((h) => h.name.toLowerCase().includes(q)) : ordered;
  }, [ordered, query]);

  if (habits.length === 0) return null;

  /* ---- short list: pills ---- */
  if (habits.length <= searchThreshold) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ordered.map((habit) => {
          const on = selectedIds.includes(habit.id);
          const dim = ((dimmed?.(habit) ?? false) || isMuted(habit)) && !on;
          return (
            <Pressable
              key={habit.id}
              onPress={() => onToggle(habit)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? c.accent : c.lineStrong,
                backgroundColor: on ? tone.accent.bg : "transparent",
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: dim ? 0.5 : 1,
                maxWidth: "100%",
              }}
            >
              {on ? <Check size={12} color={tone.accent.text} strokeWidth={3.5} /> : <HabitIcon habit={habit} size={12} />}
              <Txt variant="small" weight="500" color={on ? tone.accent.text : "soft"} numberOfLines={1} style={{ flexShrink: 1 }}>
                {habit.name}
              </Txt>
              {meta?.(habit)}
            </Pressable>
          );
        })}
      </View>
    );
  }

  /* ---- long list: search over a scrolling list ---- */
  const selected = habits.filter((h) => selectedIds.includes(h.id));
  return (
    <View style={{ gap: 6 }}>
      {selected.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {selected.map((habit) => (
            <Pressable
              key={habit.id}
              onPress={() => onToggle(habit)}
              accessibilityLabel={`Remove ${habit.name}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: tone.accent.bg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <HabitIcon habit={habit} size={11} />
              <Txt variant="tiny" weight="600" color={tone.accent.text} numberOfLines={1} style={{ maxWidth: 160 }}>
                {habit.name}
              </Txt>
              <X size={11} color={tone.accent.text} />
            </Pressable>
          ))}
        </View>
      )}

      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        autoCorrect={false}
        icon={<Search size={15} color={c.inkFaint} />}
      />

      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 240, borderWidth: 1, borderColor: c.line, borderRadius: 10 }}
      >
        {matches.length === 0 ? (
          <Txt variant="small" color="faint" center style={{ padding: 16 }}>
            No habit matches that.
          </Txt>
        ) : (
          matches.map((habit, index) => {
            const on = selectedIds.includes(habit.id);
            const aside = isMuted(habit);
            const dim = ((dimmed?.(habit) ?? false) || aside) && !on;
            const firstAside = aside && index > 0 && !isMuted(matches[index - 1]);
            return (
              <View
                key={habit.id}
                style={{
                  flexDirection: "row",
                  alignItems: "stretch",
                  borderTopWidth: index === 0 ? 0 : firstAside ? 2 : 1,
                  borderTopColor: firstAside ? c.lineStrong : c.line,
                }}
              >
                <Pressable
                  onPress={() => onToggle(habit)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 9,
                    paddingVertical: 12,
                    paddingLeft: 12,
                    paddingRight: onToggleMuted ? 4 : 12,
                    opacity: dim ? 0.5 : 1,
                    backgroundColor: pressed ? c.surfaceSunken : "transparent",
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      borderWidth: 1.5,
                      borderColor: on ? c.accent : c.lineStrong,
                      backgroundColor: on ? c.accent : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on && <Check size={12} color="#fff" strokeWidth={3.5} />}
                  </View>
                  <HabitIcon habit={habit} />
                  <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
                    {habit.name}
                  </Txt>
                  {meta?.(habit)}
                </Pressable>
                {onToggleMuted && muted && (
                  <Pressable
                    onPress={() => onToggleMuted(habit)}
                    accessibilityLabel={
                      aside ? `Bring ${habit.name} back up the list` : `Set ${habit.name} aside`
                    }
                    hitSlop={4}
                    style={{ paddingHorizontal: 14, justifyContent: "center", opacity: aside ? 1 : 0.45 }}
                  >
                    {aside ? <EyeOff size={15} color={c.inkFaint} /> : <Eye size={15} color={c.inkFaint} />}
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
