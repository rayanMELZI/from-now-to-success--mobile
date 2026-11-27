import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check, Plus, Search, X } from "lucide-react-native";
import {
  MAX_TAGS,
  MAX_TAGS_PER_TASK,
  MAX_TAG_NAME,
  TAG_COLORS,
  type TagColor,
  type Task,
  type TaskTag,
} from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { IconBtn } from "./ui/Button";
import { Banner } from "./ui/Card";
import { Field } from "./ui/Field";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";

/**
 * The web app's tag shades, as Tailwind hex: a soft chip (100 / 700, dark
 * 950 at 60 % / 300) for the label, a solid dot for swatches and filters.
 */
export const TAG_SHADES: Record<TagColor, { bg: string; text: string; darkBg: string; darkText: string; dot: string }> = {
  gray: { bg: "#f5f5f4", text: "#44403c", darkBg: "#292524", darkText: "#d6d3d1", dot: "#a8a29e" },
  red: { bg: "#fee2e2", text: "#b91c1c", darkBg: "#450a0a99", darkText: "#fca5a5", dot: "#ef4444" },
  orange: { bg: "#ffedd5", text: "#c2410c", darkBg: "#43140799", darkText: "#fdba74", dot: "#f97316" },
  amber: { bg: "#fef3c7", text: "#92400e", darkBg: "#451a0399", darkText: "#fcd34d", dot: "#fbbf24" },
  green: { bg: "#d1fae5", text: "#047857", darkBg: "#022c2299", darkText: "#6ee7b7", dot: "#10b981" },
  teal: { bg: "#ccfbf1", text: "#0f766e", darkBg: "#042f2e99", darkText: "#5eead4", dot: "#14b8a6" },
  sky: { bg: "#e0f2fe", text: "#0369a1", darkBg: "#082f4999", darkText: "#7dd3fc", dot: "#0ea5e9" },
  indigo: { bg: "#e0e7ff", text: "#4338ca", darkBg: "#1e1b4b99", darkText: "#a5b4fc", dot: "#6366f1" },
  violet: { bg: "#ede9fe", text: "#6d28d9", darkBg: "#2e106599", darkText: "#c4b5fd", dot: "#8b5cf6" },
  pink: { bg: "#fce7f3", text: "#be185d", darkBg: "#50072499", darkText: "#f9a8d4", dot: "#ec4899" },
};

/** A colour for the next tag: the first one not used yet, so tags stay apart. */
export function nextTagColor(tags: TaskTag[]): TagColor {
  const used = new Set(tags.map((t) => t.color));
  return TAG_COLORS.find((c) => c !== "gray" && !used.has(c)) ?? "gray";
}

/**
 * Open tasks bunched by tag, in the order the tags were made: a task sits
 * under its first tag, untagged ones last. Within a bunch the server's order
 * (deadlines first) stays.
 */
export function groupByTag(tasks: Task[], tags: TaskTag[]): { tag: TaskTag | null; tasks: Task[] }[] {
  const rank = new Map(tags.map((t, i) => [t.id, i]));
  const first = (task: Task) =>
    task.tags.reduce<TaskTag | null>(
      (best, t) => (best === null || (rank.get(t.id) ?? Infinity) < (rank.get(best.id) ?? Infinity) ? t : best),
      null,
    );
  const groups = [...tags, null].map((tag) => ({
    tag,
    tasks: tasks.filter((task) => (first(task)?.id ?? null) === (tag?.id ?? null)),
  }));
  return groups.filter((g) => g.tasks.length > 0);
}

export type CreateTag = (name: string, color: TagColor) => Promise<TaskTag | null>;

/** The light or dark shades of a tag colour. */
export function useTagShade(color: TagColor) {
  const { isDark } = useTheme();
  const s = TAG_SHADES[color];
  return { bg: isDark ? s.darkBg : s.bg, text: isDark ? s.darkText : s.text, dot: s.dot };
}

/** The solid round mark of a tag colour. */
export function TagDot({ color, size = 10 }: { color: TagColor; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: TAG_SHADES[color].dot }} />;
}

/** A tag as a small coloured label. */
export function TagChip({ tag, onRemove }: { tag: TaskTag; onRemove?: () => void }) {
  const shade = useTagShade(tag.color);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        maxWidth: 180,
        backgroundColor: shade.bg,
        borderRadius: 999,
        paddingLeft: onRemove ? 10 : 8,
        paddingRight: onRemove ? 4 : 8,
        paddingVertical: onRemove ? 3 : 1,
      }}
    >
      <Txt variant={onRemove ? "small" : "tiny"} weight="500" color={shade.text} numberOfLines={1} style={{ flexShrink: 1 }}>
        {tag.name}
      </Txt>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove the ${tag.name} tag`}
          style={{ padding: 2, opacity: 0.75 }}
        >
          <X size={13} strokeWidth={3} color={shade.text} />
        </Pressable>
      )}
    </View>
  );
}

/** The palette as a row of round swatches, the chosen one ringed. */
export function TagColorSwatches({ value, onChange }: { value: TagColor; onChange: (color: TagColor) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Tag colour" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {TAG_COLORS.map((color) => {
        const on = value === color;
        return (
          <Pressable
            key={color}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(color);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={color}
            hitSlop={2}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: on ? c.ink : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TagDot color={color} size={22} />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The tags a user can choose from, as a checklist in a sheet: an empty box
 * for "not on it", a ticked one for "on it" — nothing can be mistaken for
 * already chosen. Each tick goes straight to onChange, so on a saved task it
 * applies at once. Typing filters the list; Enter applies the match, or
 * makes the tag.
 */
export function TagChooser({
  open,
  onClose,
  title = "Tags",
  tags,
  selected,
  onChange,
  onCreate,
  error,
  onDismissError,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  tags: TaskTag[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onCreate: CreateTag;
  error?: string | null;
  onDismissError?: () => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const q = query.trim().toLowerCase();
  const shown = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const exact = tags.find((t) => t.name.toLowerCase() === q);
  const full = selected.length >= MAX_TAGS_PER_TASK;
  const canCreate = q.length > 0 && !exact && tags.length < MAX_TAGS && !full;

  const toggle = (id: number) => {
    void Haptics.selectionAsync().catch(() => {});
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    const tag = await onCreate(query.trim(), nextTagColor(tags));
    setBusy(false);
    if (!tag) return;
    setQuery("");
    onChange([...selected, tag.id]);
  }

  function submit() {
    if (exact) {
      if (selected.includes(exact.id) || !full) toggle(exact.id);
      setQuery("");
    } else void create();
  }

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} tall>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Txt variant="heading" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
        <IconBtn label="Close" onPress={close} size={36}>
          <X size={18} color={c.inkSoft} />
        </IconBtn>
      </View>
      {error ? (
        <Banner onClose={onDismissError} style={{ marginBottom: 8 }}>
          {error}
        </Banner>
      ) : null}
      <Field
        value={query}
        onChangeText={setQuery}
        maxLength={MAX_TAG_NAME}
        placeholder={tags.length > 0 ? "Find or make a tag…" : "Name your first tag…"}
        accessibilityLabel="Find or make a tag"
        autoCorrect={false}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        icon={<Search size={15} color={c.inkFaint} />}
      />
      <View style={{ marginTop: 6 }}>
        {shown.map((tag) => {
          const on = selected.includes(tag.id);
          const off = !on && full;
          return (
            <Pressable
              key={tag.id}
              onPress={() => toggle(tag.id)}
              disabled={off}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: off }}
              accessibilityLabel={tag.name}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 48,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: pressed ? c.surfaceSunken : "transparent",
                opacity: off ? 0.4 : 1,
              })}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderColor: on ? c.ink : c.lineStrong,
                  backgroundColor: on ? c.ink : "transparent",
                }}
              >
                {on && <Check size={14} strokeWidth={3.5} color={c.surface} />}
              </View>
              <TagDot color={tag.color} size={11} />
              <Txt numberOfLines={1} style={{ flex: 1 }}>
                {tag.name}
              </Txt>
            </Pressable>
          );
        })}
        {canCreate && (
          <Pressable
            onPress={() => void create()}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: pressed ? c.surfaceSunken : "transparent",
              opacity: busy ? 0.5 : 1,
            })}
          >
            <Plus size={18} color={c.inkSoft} />
            <Txt color="soft" numberOfLines={1} style={{ flex: 1 }}>
              Make <Txt weight="600">“{query.trim()}”</Txt>
            </Txt>
          </Pressable>
        )}
        {shown.length === 0 && !canCreate && (
          <Txt variant="small" color="faint" style={{ padding: 8 }}>
            {full
              ? `${MAX_TAGS_PER_TASK} tags at most per task.`
              : q
                ? "No tag by that name."
                : "No tags yet — type a name to make one."}
          </Txt>
        )}
        {full && shown.length > 0 && (
          <Txt variant="tiny" color="faint" style={{ paddingHorizontal: 8, paddingTop: 4 }}>
            {MAX_TAGS_PER_TASK} tags at most per task.
          </Txt>
        )}
      </View>
    </Sheet>
  );
}

/** The tags chosen so far in a form, each with its own × to take it off. */
export function ChosenTags({
  tags,
  selected,
  onChange,
}: {
  tags: TaskTag[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const chosen = tags.filter((t) => selected.includes(t.id));
  if (chosen.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {chosen.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={() => onChange(selected.filter((id) => id !== tag.id))} />
      ))}
    </View>
  );
}
