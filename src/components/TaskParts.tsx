import { useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { CalendarDays, CalendarPlus, Check, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { invalidate, keys } from "@/lib/queries";
import { queryClient } from "@/lib/queryClient";
import type { TagColor, Task, TaskList, TaskTag } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Btn, IconBtn } from "./ui/Button";
import { Field, Labeled } from "./ui/Field";
import { DateTimeInput } from "./ui/Pickers";
import { Txt } from "./ui/Txt";

/** Same rule as the plan: dates in the app's language, not the phone's. */
const DATE_LOCALE = "en-GB";

export function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * "Overdue · 2 days", "Today", "Tomorrow", else "Thu 30 Oct" — what a
 * deadline means from where the user stands, plus whether it is late.
 */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const delta = Math.round((parseIso(due).getTime() - parseIso(today).getTime()) / 86_400_000);
  if (delta < 0) return { text: `Overdue · ${-delta} day${delta === -1 ? "" : "s"}`, late: true };
  if (delta === 0) return { text: "Today", late: false };
  if (delta === 1) return { text: "Tomorrow", late: false };
  return {
    text: parseIso(due).toLocaleDateString(DATE_LOCALE, { weekday: "short", day: "numeric", month: "short" }),
    late: false,
  };
}

/* ------------------------------------------------------------- the actions */

const patchList = (update: (list: TaskList) => TaskList) =>
  queryClient.setQueryData<TaskList>(keys.tasks, (current) => current && update(current));

/**
 * Every way to change the list, shared by the tasks tab and the plan. Each
 * resolves to an error message, or null when it went through. Ticking is
 * optimistic — it lands on screen first and only bounces back if the server
 * refuses it.
 */
export const taskActions = {
  async add(title: string, dueDate: string | null, tagIds: number[] = []) {
    return attempt(() => api<Task>("/api/tasks", { method: "POST", body: { title, dueDate, tagIds } }));
  },
  /** Without tagIds the task keeps the tags it has. */
  async update(id: number, title: string, dueDate: string | null, tagIds?: number[]) {
    return attempt(() => api<Task>(`/api/tasks/${id}`, { method: "PUT", body: { title, dueDate, tagIds } }));
  },
  /**
   * Retags a saved task straight from its row: shown at once, sent with its
   * title and deadline unchanged.
   */
  async setTags(task: Task, tagIds: number[]) {
    // A refetch still on its way would put the old tags back.
    await queryClient.cancelQueries({ queryKey: keys.tasks });
    patchList((list) => ({
      ...list,
      open: list.open.map((t) => (t.id === task.id ? { ...t, tags: list.tags.filter((g) => tagIds.includes(g.id)) } : t)),
    }));
    return attempt(() =>
      api<Task>(`/api/tasks/${task.id}`, { method: "PUT", body: { title: task.title, dueDate: task.dueDate, tagIds } }),
    );
  },
  /** Resolves to the new tag as well, so a chooser can tick it straight away. */
  async addTag(name: string, color: TagColor): Promise<{ tag: TaskTag | null; error: string | null }> {
    let tag: TaskTag | null = null;
    const error = await attempt(async () => {
      tag = await api<TaskTag>("/api/tasks/tags", { method: "POST", body: { name, color } });
    });
    return { tag, error };
  },
  /** Renaming or recolouring changes it on every task. */
  async updateTag(id: number, name: string, color: TagColor) {
    return attempt(() => api<TaskTag>(`/api/tasks/tags/${id}`, { method: "PUT", body: { name, color } }));
  },
  /** Takes it off every task; the tasks themselves stay. */
  async removeTag(id: number) {
    return attempt(() => api(`/api/tasks/tags/${id}`, { method: "DELETE" }));
  },
  /** A plan line that stood for it keeps its title, but loses the link. */
  async remove(id: number) {
    return attempt(() => api(`/api/tasks/${id}`, { method: "DELETE" }), true);
  },
  async clearDone() {
    return attempt(() => api("/api/tasks/done", { method: "DELETE" }), true);
  },
  async toggleDone(task: Task) {
    const done = !task.done;
    if (done) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Move it across at once: open ↔ done, the way it will come back.
    const moved = { ...task, done };
    patchList((list) =>
      done
        ? { ...list, open: list.open.filter((t) => t.id !== task.id), done: [moved, ...list.done] }
        : { ...list, open: [...list.open, moved], done: list.done.filter((t) => t.id !== task.id) },
    );
    return attempt(() => api<Task>(`/api/tasks/${task.id}/done`, { method: "PUT", body: { done } }));
  },
};

async function attempt(action: () => Promise<unknown>, touchesPlan = false): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (err) {
    return errorMessage(err);
  } finally {
    // Success or not, the server's copy is the one to show.
    await invalidate(keys.tasks, ...(touchesPlan ? [["plan"]] : [])).catch(() => {});
  }
}

/* ----------------------------------------------------------------- pieces */

/** The round tick box a task is finished with. */
export function TaskCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={task.done ? `Put ${task.title} back on the list` : `Mark ${task.title} done`}
      style={({ pressed }) => ({
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: task.done ? tw.emerald[500] : c.lineStrong,
        backgroundColor: task.done ? tw.emerald[500] : "transparent",
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      {task.done && <Check size={13} color="#fff" strokeWidth={3.5} />}
    </Pressable>
  );
}

/** The deadline chip — red once it has passed. */
export function DueChip({ due, today }: { due: string; today: string }) {
  const { c, isDark } = useTheme();
  const { text, late } = dueLabel(due, today);
  const color = late ? (isDark ? tw.rose[400] : tw.rose[600]) : c.inkFaint;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <CalendarDays size={11} color={color} />
      <Txt variant="tiny" weight="500" color={color} tabular>
        {text}
      </Txt>
    </View>
  );
}

/** A task line: tick box on the left, whatever actions on the right. */
export function TaskRow({
  task,
  today,
  onToggle,
  onPress,
  dimmed = false,
  children,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  /** Tapping the text — editing, on the tasks tab. */
  onPress?: () => void;
  /** Drawn back without being disabled — e.g. already on today's plan. */
  dimmed?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: dimmed ? 0.55 : 1 }}>
      <TaskCheck task={task} onToggle={onToggle} />
      <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, gap: 2, paddingVertical: 2 }}>
        <Txt variant="small" weight={task.done ? "400" : "600"} color={task.done ? "faint" : "ink"} strike={task.done}>
          {task.title}
        </Txt>
        {task.dueDate && !task.done && <DueChip due={task.dueDate} today={today} />}
      </Pressable>
      {children}
    </View>
  );
}

/** Opens the phone's date picker on a day, for a deadline that is not set yet. */
function pickDate(start: Date, onPick: (iso: string) => void) {
  if (Platform.OS === "android") {
    DateTimePickerAndroid.open({
      value: start,
      mode: "date",
      onChange: (event, picked) => {
        if (event.type === "set" && picked) onPick(toIso(picked));
      },
    });
  } else {
    // iOS draws its own inline control once there is a value to show.
    onPick(toIso(start));
  }
}

/** An optional deadline: a button while unset, the date and a clear cross once set. */
export function DueField({
  value,
  onChange,
  today,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  today: string;
}) {
  const { c } = useTheme();
  if (!value) {
    return (
      <Btn
        variant="ghost"
        label="Add a deadline"
        icon={<CalendarPlus size={15} color={c.ink} />}
        onPress={() => pickDate(parseIso(today), onChange)}
      />
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ flex: 1 }}>
        <DateTimeInput mode="date" value={parseIso(value)} onChange={(d) => onChange(toIso(d))} accessibilityLabel="Due by" />
      </View>
      <IconBtn label="No deadline" onPress={() => onChange(null)} bordered size={44}>
        <X size={16} color={c.inkSoft} />
      </IconBtn>
    </View>
  );
}

/** One line: the title in, an optional deadline, "done" on the keyboard adds it. */
export function TaskQuickAdd({
  today,
  onAdd,
  compact = false,
}: {
  today: string;
  onAdd: (title: string, dueDate: string | null) => Promise<boolean>;
  /** Inside the plan: no deadline, just the title. */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onAdd(trimmed, dueDate);
    setBusy(false);
    if (ok) {
      setTitle("");
      setDueDate(null);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Field
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Something to get done…"
            accessibilityLabel="New task"
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => void submit()}
          />
        </View>
        {!compact && !dueDate && (
          <IconBtn label="Add a deadline" onPress={() => pickDate(parseIso(today), setDueDate)} bordered size={46}>
            <CalendarPlus size={18} color={c.inkSoft} />
          </IconBtn>
        )}
        <IconBtn
          label="Add task"
          onPress={() => void submit()}
          disabled={busy || !title.trim()}
          size={46}
          style={{ backgroundColor: c.accent }}
        >
          <Plus size={20} color="#fff" />
        </IconBtn>
      </View>
      {!compact && dueDate && <DueField value={dueDate} onChange={setDueDate} today={today} />}
    </View>
  );
}

/** Title and deadline, edited in a sheet — with the way out at the bottom. */
export function TaskEditor({
  task,
  today,
  onSave,
  onDelete,
  onCancel,
}: {
  task: Task;
  today: string;
  onSave: (title: string, dueDate: string | null) => Promise<void>;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { c } = useTheme();
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState<string | null>(task.dueDate);
  const [busy, setBusy] = useState(false);
  const valid = title.trim().length > 0;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    await onSave(title.trim(), dueDate);
    setBusy(false);
  }

  return (
    <View style={{ gap: 14 }}>
      <Txt variant="heading">Edit task</Txt>
      <Labeled label="Task">
        <Field
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          accessibilityLabel="Task"
        />
      </Labeled>
      <Labeled label="Due by" hint="Optional — tasks with a deadline sit on top, soonest first.">
        <DueField value={dueDate} onChange={setDueDate} today={today} />
      </Labeled>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Save" icon={<Pencil size={15} color="#fff" />} onPress={() => void save()} disabled={!valid} loading={busy} flex />
        <Btn label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
      <Btn variant="plain" label="Delete this task" icon={<Trash2 size={14} color={c.inkSoft} />} onPress={onDelete} />
    </View>
  );
}
