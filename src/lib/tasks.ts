import { useState } from "react";
import { api, errorMessage } from "./api";
import { invalidate, keys } from "./queries";
import { queryClient } from "./queryClient";
import { TAG_COLORS, type TagColor, type Task, type TaskList, type TaskTag } from "./types";

/** Same rule as the plan: dates in the app's language, not the phone's. */
const DATE_LOCALE = "en-GB";

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const isoToDate = parseIso;

/**
 * "Overdue · 2 days", "Today", "Tomorrow", else "Thu 30 Oct" — what a
 * deadline means from where the user stands, plus whether it is late.
 */
export function dueLabel(due: string, today: string): { text: string; late: boolean } {
  const delta = Math.round((parseIso(due).getTime() - parseIso(today).getTime()) / 86_400_000);
  if (delta < 0) {
    return { text: `Overdue · ${-delta} day${delta === -1 ? "" : "s"}`, late: true };
  }
  if (delta === 0) return { text: "Today", late: false };
  if (delta === 1) return { text: "Tomorrow", late: false };
  return {
    text: parseIso(due).toLocaleDateString(DATE_LOCALE, { weekday: "short", day: "numeric", month: "short" }),
    late: false,
  };
}

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

const setList = (update: (current: TaskList) => TaskList) =>
  queryClient.setQueryData<TaskList>(keys.tasks, (current) => current && update(current));

/**
 * Every way to change the tasks list. Ticking and tagging are optimistic —
 * they land on screen first and only bounce back if the server refuses them.
 */
export function useTaskActions() {
  const [error, setError] = useState<string | null>(null);
  const reload = () => invalidate(keys.tasks);

  async function attempt(action: () => Promise<unknown>, fallback?: string) {
    setError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(errorMessage(err, fallback));
      return false;
    }
  }

  const add = (title: string, dueDate: string | null, tagIds: number[]) =>
    attempt(() => api<Task>("/api/tasks", { method: "POST", body: { title, dueDate, tagIds } }));

  const update = (id: number, title: string, dueDate: string | null, tagIds: number[]) =>
    attempt(() => api<Task>(`/api/tasks/${id}`, { method: "PUT", body: { title, dueDate, tagIds } }));

  /**
   * Retags a saved task straight from its row: shown at once, sent with its
   * title and deadline unchanged, and only reloaded if the server refuses.
   */
  async function setTags(task: Task, tagIds: number[]) {
    setError(null);
    await queryClient.cancelQueries({ queryKey: keys.tasks });
    setList((current) => ({
      ...current,
      open: current.open.map((t) =>
        t.id === task.id ? { ...t, tags: current.tags.filter((g) => tagIds.includes(g.id)) } : t,
      ),
    }));
    try {
      await api<Task>(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: { title: task.title, dueDate: task.dueDate, tagIds },
      });
    } catch (err) {
      setError(errorMessage(err, "Could not change its tags"));
      await reload();
    }
  }

  /** Resolves to the new tag, so a chooser can tick it straight away. */
  async function addTag(name: string, color: TagColor): Promise<TaskTag | null> {
    const made: { tag: TaskTag | null } = { tag: null };
    await attempt(async () => {
      made.tag = await api<TaskTag>("/api/tasks/tags", { method: "POST", body: { name, color } });
    });
    return made.tag;
  }

  const updateTag = (id: number, name: string, color: TagColor) =>
    attempt(() => api<TaskTag>(`/api/tasks/tags/${id}`, { method: "PUT", body: { name, color } }));

  const removeTag = (id: number) => attempt(() => api(`/api/tasks/tags/${id}`, { method: "DELETE" }));

  const remove = (id: number) => attempt(() => api(`/api/tasks/${id}`, { method: "DELETE" }));

  const clearDone = () => attempt(() => api("/api/tasks/done", { method: "DELETE" }));

  async function toggleDone(task: Task) {
    const done = !task.done;
    await queryClient.cancelQueries({ queryKey: keys.tasks });
    // Move it across at once: open ↔ done, the way it will come back.
    const moved = { ...task, done };
    setList((current) =>
      done
        ? { ...current, open: current.open.filter((t) => t.id !== task.id), done: [moved, ...current.done] }
        : { ...current, open: [...current.open, moved], done: current.done.filter((t) => t.id !== task.id) },
    );
    const ok = await attempt(() => api<Task>(`/api/tasks/${task.id}/done`, { method: "PUT", body: { done } }));
    if (!ok) await reload();
  }

  return { error, setError, reload, add, update, remove, clearDone, toggleDone, setTags, addTag, updateTag, removeTag };
}
