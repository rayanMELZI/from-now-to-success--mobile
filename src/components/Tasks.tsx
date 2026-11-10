import { useState, type ReactNode } from "react";
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { CalendarDays, Check, Plus, Search, Tag, X } from "lucide-react-native";
import { TAG_SHADES, dueLabel, isoToDate, nextTagColor, toIso } from "@/lib/tasks";
import {
  MAX_TAGS,
  MAX_TAGS_PER_TASK,
  MAX_TAG_NAME,
  MAX_TASK_TITLE,
  TAG_COLORS,
  type TagColor,
  type Task,
  type TaskTag,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Btn, IconBtn } from "./ui/Button";
import { Banner } from "./ui/Card";
import { Field } from "./ui/Field";
import { DateTimeInput } from "./ui/Pickers";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";

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

/** The round tick box a task is finished with. */
function TaskCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!task.done) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggle();
      }}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={task.done ? `Put ${task.title} back on the list` : `Mark ${task.title} done`}
      style={({ pressed }) => ({
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        borderColor: task.done ? tw.emerald[500] : c.lineStrong,
        backgroundColor: task.done ? tw.emerald[500] : "transparent",
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      {task.done && <Check size={14} strokeWidth={3.5} color="#ffffff" />}
    </Pressable>
  );
}

/** The deadline label — red once it has passed. */
function DueChip({ due, today }: { due: string; today: string }) {
  const { c, isDark } = useTheme();
  const { text, late } = dueLabel(due, today);
  const color = late ? (isDark ? tw.red[400] : tw.red[600]) : c.inkFaint;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <CalendarDays size={11} color={color} />
      <Txt variant="tiny" weight="500" color={color} tabular>
        {text}
      </Txt>
    </View>
  );
}

/** A task line: tick box on the left, title with its deadline and tags, actions on the right. */
export function TaskRow({
  task,
  today,
  onToggle,
  children,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const showDue = task.dueDate !== null && !task.done;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <TaskCheck task={task} onToggle={onToggle} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt weight={task.done ? "400" : "500"} color={task.done ? "faint" : "ink"} strike={task.done}>
          {task.title}
        </Txt>
        {(task.tags.length > 0 || showDue) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
            {showDue && <DueChip due={task.dueDate!} today={today} />}
            {task.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </View>
        )}
      </View>
      {children}
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
function ChosenTags({
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

/** An optional deadline: "No deadline" until a day is picked, then that day with a × to drop it. */
function DueDateField({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const { c } = useTheme();
  if (value) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <DateTimeInput
          mode="date"
          compact
          value={isoToDate(value)}
          onChange={(d) => onChange(toIso(d))}
          accessibilityLabel="Due by"
        />
        <IconBtn label="No deadline" onPress={() => onChange(null)} size={36}>
          <X size={16} color={c.inkSoft} />
        </IconBtn>
      </View>
    );
  }
  const pick = () => {
    // iOS has no dialog to open: start from today and let its inline picker take over.
    if (Platform.OS !== "android") {
      onChange(toIso(new Date()));
      return;
    }
    DateTimePickerAndroid.open({
      value: new Date(),
      mode: "date",
      onChange: (event, picked) => {
        if (event.type === "set" && picked) onChange(toIso(picked));
      },
    });
  };
  return (
    <Pressable
      onPress={pick}
      accessibilityRole="button"
      accessibilityLabel="Due by (optional)"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.lineStrong,
        backgroundColor: pressed ? c.surfaceSunken : c.field,
        paddingHorizontal: 12,
      })}
    >
      <CalendarDays size={15} color={c.inkFaint} />
      <Txt variant="small" color="soft">
        No deadline
      </Txt>
    </Pressable>
  );
}

/**
 * Title, optional deadline and tags. "add" is the quick-add card: the title
 * line with its button, emptied once added. "edit" fills in a saved task and
 * ends with Save / Cancel.
 */
export function TaskForm({
  mode,
  initial,
  tags,
  onCreateTag,
  onSubmit,
  onCancel,
  error,
  onDismissError,
  style,
}: {
  mode: "add" | "edit";
  initial?: Task;
  tags: TaskTag[];
  onCreateTag: CreateTag;
  onSubmit: (title: string, dueDate: string | null, tagIds: number[]) => Promise<boolean>;
  onCancel?: () => void;
  /** Shown in the tag chooser, which covers the screen's own banner. */
  error?: string | null;
  onDismissError?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueDate, setDueDate] = useState<string | null>(initial?.dueDate ?? null);
  const [tagIds, setTagIds] = useState<number[]>(() => initial?.tags.map((t) => t.id) ?? []);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = title.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    // A tag deleted meanwhile would be dropped by the server anyway.
    const ok = await onSubmit(title.trim(), dueDate, tagIds.filter((id) => tags.some((t) => t.id === id)));
    setBusy(false);
    if (ok && mode === "add") {
      setTitle("");
      setDueDate(null);
      setTagIds([]);
    }
  }

  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field
          value={title}
          onChangeText={setTitle}
          maxLength={MAX_TASK_TITLE}
          placeholder="Something to get done…"
          accessibilityLabel={mode === "add" ? "New task" : "Task"}
          returnKeyType={mode === "add" ? "done" : "default"}
          // Adding several in a row keeps the keyboard up.
          submitBehavior={mode === "add" ? "submit" : "blurAndSubmit"}
          onSubmitEditing={() => void submit()}
          style={{ flex: 1 }}
        />
        {mode === "add" && (
          <IconBtn
            label="Add task"
            onPress={() => void submit()}
            disabled={busy || !valid}
            size={46}
            style={{ backgroundColor: c.accent, borderRadius: 12 }}
          >
            <Plus size={20} color="#ffffff" />
          </IconBtn>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <DueDateField value={dueDate} onChange={setDueDate} />
        <Btn
          size="sm"
          variant="ghost"
          label="Tag it"
          icon={<Tag size={14} color={c.ink} />}
          onPress={() => setChoosing(true)}
        />
      </View>
      <ChosenTags tags={tags} selected={tagIds} onChange={setTagIds} />
      {mode === "edit" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn label="Save" onPress={() => void submit()} disabled={!valid} loading={busy} flex />
          <Btn variant="ghost" label="Cancel" onPress={() => onCancel?.()} />
        </View>
      )}
      <TagChooser
        open={choosing}
        onClose={() => setChoosing(false)}
        title="Tag it"
        tags={tags}
        selected={tagIds}
        onChange={setTagIds}
        onCreate={onCreateTag}
        error={error}
        onDismissError={onDismissError}
      />
    </View>
  );
}
