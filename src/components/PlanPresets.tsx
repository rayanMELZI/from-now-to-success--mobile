import { useState } from "react";
import { View } from "react-native";
import { ArrowLeft, Bookmark, LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { formatMinute, type Habit, type PlanPreset } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { Banner, Card } from "./ui/Card";
import { Btn, IconBtn } from "./ui/Button";
import { Field, Labeled } from "./ui/Field";
import { DateTimeInput, SelectField } from "./ui/Pickers";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";

/** The server's limits, so the editor stops before it is told off. */
const MAX_LINES = 60;
const MAX_NAME = 60;
const MAX_TITLE = 120;
const LAST_MINUTE = 24 * 60 - 1;

/** "6 lines · 07:30 → 22:00" — enough to tell two presets apart at a glance. */
export function presetSummary(preset: PlanPreset): string {
  const count = `${preset.lines.length} line${preset.lines.length === 1 ? "" : "s"}`;
  if (preset.lines.length === 0) return count;
  const first = preset.lines[0].endMinute;
  const last = preset.lines[preset.lines.length - 1].endMinute;
  return first === last ? `${count} · ${formatMinute(first)}` : `${count} · ${formatMinute(first)} → ${formatMinute(last)}`;
}

function minuteToDate(minute: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d;
}

/** A line being edited; `key` keeps each row its own across removals. */
interface DraftLine {
  key: number;
  minute: number;
  title: string;
  habitId: number | null;
}

let nextKey = 1;
const draftLine = (minute: number, title = "", habitId: number | null = null): DraftLine => ({
  key: nextKey++,
  minute,
  title,
  habitId,
});

/**
 * Everything about presets in one sheet: the list, using one on the day being
 * looked at, saving that day as a new one, and editing or deleting them.
 */
export function PresetsSheet({
  open,
  onClose,
  presets,
  habits,
  dayHasPlan,
  busy,
  onChanged,
  onApply,
  onSaveDay,
}: {
  open: boolean;
  onClose: () => void;
  presets: PlanPreset[];
  habits: Habit[];
  /** A preset only ever goes onto an empty day; with a plan, it can be saved instead. */
  dayHasPlan: boolean;
  busy: boolean;
  /** The list changed on the server: read it again. */
  onChanged: () => Promise<unknown>;
  onApply: (preset: PlanPreset) => Promise<void>;
  onSaveDay: (name: string) => Promise<void>;
}) {
  const { c } = useTheme();
  // null: the list; "new": a blank preset; a preset: that one being edited.
  const [editing, setEditing] = useState<PlanPreset | "new" | null>(null);
  const [saveName, setSaveName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  function close() {
    setEditing(null);
    setConfirmDelete(null);
    setError(null);
    onClose();
  }

  async function attempt(action: () => Promise<void>) {
    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  const remove = (preset: PlanPreset) =>
    attempt(async () => {
      await api(`/api/plan/presets/${preset.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await onChanged();
    });

  const saveDay = () =>
    attempt(async () => {
      const name = saveName.trim();
      if (!name) return;
      await onSaveDay(name);
      setSaveName("");
    });

  const disabled = busy || working;

  return (
    <Sheet open={open} onClose={close} tall>
      {editing !== null ? (
        <PresetEditor
          // A different preset is a different form, not this one refilled.
          key={editing === "new" ? "new" : editing.id}
          preset={editing === "new" ? null : editing}
          habits={habits}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            await onChanged();
            setEditing(null);
          }}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LayoutTemplate size={18} color={c.accent} />
            <Txt variant="heading" style={{ flex: 1 }}>
              Day presets
            </Txt>
            <IconBtn label="Close" onPress={close} size={34}>
              <X size={16} color={c.inkSoft} />
            </IconBtn>
          </View>
          <Txt variant="small" color="soft">
            The kinds of day you live — a workday, a gym day, a Sunday. An empty day starts from one in a tap, and stays yours to change.
          </Txt>

          {error && <Banner onClose={() => setError(null)}>{error}</Banner>}

          {presets.length === 0 ? (
            <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: c.lineStrong, borderRadius: 14, padding: 16 }}>
              <Txt variant="small" color="soft" center>
                No presets yet. Save a day you planned, or write one from scratch.
              </Txt>
            </View>
          ) : (
            presets.map((preset) => (
              <Card key={preset.id} style={{ padding: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Txt weight="600" numberOfLines={1}>
                      {preset.name}
                    </Txt>
                    <Txt variant="tiny" color="faint" tabular>
                      {presetSummary(preset)}
                    </Txt>
                  </View>
                  {!dayHasPlan && <Btn size="sm" label="Use" onPress={() => void attempt(() => onApply(preset))} disabled={disabled} />}
                  <IconBtn label={`Edit ${preset.name}`} onPress={() => setEditing(preset)} size={34} disabled={disabled}>
                    <Pencil size={15} color={c.inkSoft} />
                  </IconBtn>
                  {confirmDelete === preset.id ? (
                    <Btn size="sm" variant="solid" tone="danger" label="Delete?" onPress={() => void remove(preset)} disabled={disabled} />
                  ) : (
                    <IconBtn label={`Delete ${preset.name}`} onPress={() => setConfirmDelete(preset.id)} size={34} disabled={disabled}>
                      <Trash2 size={15} color={c.inkFaint} />
                    </IconBtn>
                  )}
                </View>
                <View style={{ gap: 2 }}>
                  {preset.lines.slice(0, 4).map((line, index) => (
                    <View key={index} style={{ flexDirection: "row", gap: 8 }}>
                      <Txt variant="tiny" color="faint" tabular style={{ width: 40 }}>
                        {formatMinute(line.endMinute)}
                      </Txt>
                      <Txt variant="tiny" color="soft" numberOfLines={1} style={{ flex: 1 }}>
                        {line.title}
                      </Txt>
                    </View>
                  ))}
                  {preset.lines.length > 4 && (
                    <Txt variant="tiny" color="faint" style={{ paddingLeft: 48 }}>
                      and {preset.lines.length - 4} more
                    </Txt>
                  )}
                </View>
              </Card>
            ))
          )}

          <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
            {dayHasPlan && (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Labeled label="Save this day as a preset">
                    <Field
                      value={saveName}
                      onChangeText={setSaveName}
                      maxLength={MAX_NAME}
                      placeholder="Workday"
                      returnKeyType="done"
                      onSubmitEditing={() => void saveDay()}
                    />
                  </Labeled>
                </View>
                <Btn label="Save" icon={<Bookmark size={14} color="#fff" />} onPress={() => void saveDay()} disabled={disabled || !saveName.trim()} />
              </View>
            )}
            <Btn variant="ghost" label="New preset" icon={<Plus size={15} color={c.ink} />} onPress={() => setEditing("new")} disabled={disabled} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

/** Writes a preset line by line: a name, then "done at" times and what they are. */
function PresetEditor({
  preset,
  habits,
  onCancel,
  onSaved,
}: {
  preset: PlanPreset | null;
  habits: Habit[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const { c } = useTheme();
  const [name, setName] = useState(preset?.name ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    preset && preset.lines.length > 0
      ? preset.lines.map((l) => draftLine(l.endMinute, l.title, l.habitId))
      : [draftLine(8 * 60)],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Locked habits are not doable yet; one a line already names stays listed.
  const linkedIds = new Set(lines.map((l) => l.habitId));
  const pickable = habits.filter((h) => h.status !== "LOCKED" || linkedIds.has(h.id));
  const habitOptions = [{ value: 0, label: "No habit" }, ...pickable.map((h) => ({ value: h.id, label: h.name }))];

  const patch = (key: number, change: Partial<DraftLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...change } : l)));

  function addLine() {
    // The next line usually follows the last one: start it a little later.
    const last = lines[lines.length - 1];
    setLines((current) => [...current, draftLine(last ? Math.min(LAST_MINUTE, last.minute + 30) : 8 * 60)]);
  }

  async function save() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the preset a name");
      return;
    }
    // A blank row is just an unused one, not a mistake.
    const filled = lines.filter((l) => l.title.trim() !== "");
    if (filled.length === 0) {
      setError("A preset needs at least one line");
      return;
    }
    setSaving(true);
    try {
      await api<PlanPreset>(preset ? `/api/plan/presets/${preset.id}` : "/api/plan/presets", {
        method: preset ? "PUT" : "POST",
        body: {
          name: trimmed,
          lines: filled.map((l) => ({ title: l.title.trim(), endMinute: l.minute, habitId: l.habitId })),
        },
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, "Could not save the preset"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconBtn label="Back to the presets" onPress={onCancel} size={34}>
          <ArrowLeft size={16} color={c.inkSoft} />
        </IconBtn>
        <Txt variant="heading">{preset ? "Edit preset" : "New preset"}</Txt>
      </View>

      <Labeled label="Name">
        <Field value={name} onChangeText={setName} maxLength={MAX_NAME} placeholder="Workday" autoFocus={!preset} />
      </Labeled>

      <Txt variant="label">Lines — the time each thing is done</Txt>
      {lines.map((line) => (
        <View key={line.key} style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: c.line, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ width: 96 }}>
              <DateTimeInput
                mode="time"
                value={minuteToDate(line.minute)}
                onChange={(d) => patch(line.key, { minute: d.getHours() * 60 + d.getMinutes() })}
                accessibilityLabel="The time this is finished"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                value={line.title}
                onChangeText={(title) => patch(line.key, { title })}
                maxLength={MAX_TITLE}
                placeholder="What"
                accessibilityLabel="What this line is"
              />
            </View>
            <IconBtn
              label="Remove this line"
              onPress={() => setLines((current) => current.filter((l) => l.key !== line.key))}
              disabled={lines.length === 1}
              size={34}
            >
              <X size={15} color={lines.length === 1 ? c.lineStrong : c.inkSoft} />
            </IconBtn>
          </View>
          {pickable.length > 0 && (
            <SelectField
              title="The habit this line stands for"
              value={line.habitId ?? 0}
              searchable={pickable.length > 8}
              options={habitOptions}
              onChange={(value) => {
                const habit = habits.find((h) => h.id === value);
                // Picking a habit for an untitled line names the line after it.
                patch(line.key, {
                  habitId: value === 0 ? null : value,
                  ...(habit && line.title.trim() === "" ? { title: habit.name } : {}),
                });
              }}
            />
          )}
        </View>
      ))}
      <Btn variant="ghost" label="Add a line" icon={<Plus size={15} color={c.ink} />} onPress={addLine} disabled={lines.length >= MAX_LINES} />

      {error && <Banner onClose={() => setError(null)}>{error}</Banner>}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label="Save preset" onPress={() => void save()} loading={saving} flex />
        <Btn variant="ghost" label="Cancel" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}
