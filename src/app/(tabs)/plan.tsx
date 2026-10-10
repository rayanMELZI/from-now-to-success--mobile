import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Copy, ListChecks, Plus, Sparkles } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import {
  formatGap,
  formatMinute,
  minuteOfUserDay,
  type CheckinResult,
  type Habit,
  type PlanBlock,
  type PlanDay,
  type PlanShiftResult,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { useFocusReload } from "@/lib/useFocusReload";
import { BlockFields, BlockRow, DAY_MINUTES, NowLine, ShiftBar } from "@/components/PlanParts";
import { Banner, Card } from "@/components/ui/Card";
import { Btn, IconBtn } from "@/components/ui/Button";
import { DateTimeInput, SelectField } from "@/components/ui/Pickers";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonScreen } from "@/components/ui/Skeleton";
import { Txt } from "@/components/ui/Txt";

/** Dates in the app's language, never the phone's — one place to change it. */
const DATE_LOCALE = "en-GB";

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}
function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}
function dayLabel(iso: string, today: string): string {
  const delta = daysBetween(today, iso);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  return parseIso(iso).toLocaleDateString(DATE_LOCALE, { weekday: "short", day: "numeric", month: "short" });
}
const shortDate = (iso: string) => parseIso(iso).toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "short" });

interface Slot {
  endMinute: number;
  items: PlanBlock[];
}
function toSlots(blocks: PlanBlock[]): Slot[] {
  const slots: Slot[] = [];
  for (const block of blocks) {
    const last = slots[slots.length - 1];
    if (last && last.endMinute === block.endMinute) last.items.push(block);
    else slots.push({ endMinute: block.endMinute, items: [block] });
  }
  return slots;
}

/** Never claim "moved 1h later" when the day's edge only let it move 20 minutes. */
function shiftNotice(count: number, asked: number, applied: number): string {
  const lines = `${count} line${count === 1 ? "" : "s"}`;
  if (applied === 0) return `Nothing to move — ${lines} already sit at the edge of your day`;
  const direction = applied < 0 ? "earlier" : "later";
  const trimmed = Math.abs(applied) < Math.abs(asked) ? " — the day ends there" : "";
  return `${lines} moved ${formatGap(Math.abs(applied))} ${direction}${trimmed}`;
}

const nowMinuteOf = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export default function PlanScreen() {
  const user = useUser();
  if (!user.plannerEnabled) return <PlannerOff />;
  return <Planner />;
}

function Planner() {
  const { c, isDark } = useTheme();
  const { refreshUser } = useAuth();
  const user = useUser();

  const [day, setDay] = useState<PlanDay | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<PlanBlock | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [shiftAmount, setShiftAmount] = useState(60);
  const [busy, setBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMinute, setNowMinute] = useState(nowMinuteOf);

  useEffect(() => {
    const id = setInterval(() => setNowMinute(nowMinuteOf()), 30_000);
    return () => clearInterval(id);
  }, []);

  // The day being looked at, so a refresh reloads it rather than jumping
  // back to today. Null until the first load, which asks for today.
  const shownDate = useRef<string | null>(null);
  const load = useCallback(
    (date: string | null) =>
      api<PlanDay>(`/api/plan${date ? `?date=${date}` : ""}`).then((data) => {
        shownDate.current = data.date;
        setDay(data);
      }),
    [],
  );

  const reload = useCallback(
    () =>
      Promise.all([
        load(shownDate.current),
        api<Habit[]>("/api/habits").then(setHabits).catch(() => {}),
        api<TodayResponse>("/api/checkins/today").then(setToday).catch(() => {}),
      ]).then(() => setError(null)),
    [load],
  );
  const onLoadError = useCallback((err: unknown) => setError(errorMessage(err, "Could not load your plan")), []);
  useFocusReload(reload, onLoadError);

  const blocks = useMemo(() => day?.blocks ?? [], [day]);
  const slots = useMemo(() => toSlots(blocks), [blocks]);
  const isToday = day != null && day.date === day.today;
  const doneCount = blocks.filter((b) => b.done).length;
  const donePercent =
    doneCount === 0 || blocks.length === 0
      ? 0
      : doneCount === blocks.length
        ? 100
        : Math.min(99, Math.max(1, Math.round((doneCount / blocks.length) * 100)));

  // The timeline runs in the user's own day: with a day ending at 04:00, a
  // 01:00 block belongs at the bottom, not the top.
  const position = (minute: number) => minuteOfUserDay(minute, user.dayEndHour);
  const nowPosition = position(nowMinute);
  const currentIndex = isToday ? slots.findIndex((slot) => position(slot.endMinute) > nowPosition) : -1;

  function entryFor(habitId: number | null): TodayEntry | null {
    if (habitId === null || !isToday) return null;
    return today?.entries.find((e) => e.habitId === habitId) ?? null;
  }

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const setPending = (id: number, on: boolean) =>
    setPendingIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchBlock = (id: number, patch: Partial<PlanBlock>) =>
    setDay((current) =>
      current === null ? current : { ...current, blocks: current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) },
    );

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  const goTo = (date: string) => {
    stopSelecting();
    return run(() => load(date));
  };

  async function addBlock(title: string, endMinute: number, habitId: number | null): Promise<boolean> {
    if (!day) return false;
    const ok = await run(async () => {
      await api<PlanBlock>(`/api/plan?date=${day.date}`, { method: "POST", body: { title, endMinute, habitId } });
      await load(day.date);
      return true;
    });
    return ok === true;
  }

  async function saveBlock(id: number, title: string, endMinute: number, habitId: number | null): Promise<boolean> {
    if (!day) return false;
    const ok = await run(async () => {
      await api<PlanBlock>(`/api/plan/${id}`, { method: "PUT", body: { title, endMinute, habitId } });
      await load(day.date);
      setEditing(null);
      return true;
    });
    return ok === true;
  }

  /** A preference, not a plan change: lands at once, bounces back on failure. */
  async function toggleMuted(habit: Habit) {
    const muted = !habit.plannerMuted;
    const patch = (value: boolean) => setHabits((cur) => cur.map((h) => (h.id === habit.id ? { ...h, plannerMuted: value } : h)));
    patch(muted);
    try {
      await api<Habit>(`/api/habits/${habit.id}/planner-muted`, { method: "PUT", body: { muted } });
    } catch (err) {
      patch(!muted);
      setError(errorMessage(err));
    }
  }

  /**
   * Ticking a block off answers its habit's daily question too — a planned
   * habit is never ticked twice. Only on today's plan, only while still
   * unanswered; un-ticking leaves the check-in standing (it cannot be undone).
   */
  async function toggleDone(block: PlanBlock) {
    if (!day || pendingIds.has(block.id)) return;
    const done = !block.done;
    const entry = entryFor(block.habitId);

    patchBlock(block.id, { done });
    setPending(block.id, true);
    setError(null);
    if (done) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const saved = await api<PlanBlock>(`/api/plan/${block.id}/done`, { method: "PUT", body: { done } });
      patchBlock(block.id, saved);
    } catch (err) {
      patchBlock(block.id, { done: block.done });
      setError(errorMessage(err));
      setPending(block.id, false);
      return;
    }

    try {
      if (done && entry?.todayStatus === "PENDING") await checkIn(entry.habitId, entry.name);
    } catch (err) {
      setError(errorMessage(err, "Could not check that habit in"));
    } finally {
      setPending(block.id, false);
    }
  }

  function removeBlock(block: PlanBlock) {
    if (!day) return;
    Alert.alert("Delete this line?", block.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await api(`/api/plan/${block.id}`, { method: "DELETE" });
            await load(day.date);
          }),
      },
    ]);
  }

  async function shiftSelected(delta: number) {
    if (!day) return;
    const ids = blocks.filter((b) => selectedIds.has(b.id)).map((b) => b.id);
    if (ids.length === 0) return;
    await run(async () => {
      const result = await api<PlanShiftResult>("/api/plan/shift", { method: "POST", body: { blockIds: ids, deltaMinutes: delta } });
      setDay(result.day);
      setNotice(shiftNotice(ids.length, delta, result.appliedMinutes));
    });
  }

  async function copyFrom(from: string) {
    if (!day) return;
    await run(async () => {
      const copied = await api<PlanDay>(`/api/plan/copy?date=${day.date}`, { method: "POST", body: { from } });
      setDay(copied);
    });
  }

  /** The one bridge to the game. */
  async function checkIn(habitId: number, name: string) {
    const result = await api<CheckinResult>("/api/checkins", { method: "POST", body: { entries: [{ habitId, done: true }] } });
    setNotice(
      result.earnedPoints === 0
        ? `${name} was already counted for today`
        : `${name} checked in · ${result.earnedPoints > 0 ? "+" : ""}${result.earnedPoints} points`,
    );
    void Promise.all([api<TodayResponse>("/api/checkins/today"), refreshUser()])
      .then(([fresh]) => setToday(fresh))
      .catch(() => {});
  }

  if (!day) {
    return error ? (
      <Screen onRefresh={reload}>
        <Banner>{error}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen cards={5} />
    );
  }

  const suggestedMinute =
    blocks.length === 0
      ? Math.min(DAY_MINUTES - 1, Math.ceil(nowMinute / 5) * 5)
      : Math.min(DAY_MINUTES - 1, blocks[blocks.length - 1].endMinute + 10);
  const amber = isDark ? tw.amber[400] : tw.amber[600];

  const overlay = (
    <>
      {selecting && (
        <ShiftBar
          selectedCount={selectedIds.size}
          totalCount={blocks.length}
          amount={shiftAmount}
          busy={busy}
          onAmount={setShiftAmount}
          onSelectAll={() => setSelectedIds(new Set(blocks.map((b) => b.id)))}
          onClear={() => setSelectedIds(new Set())}
          onShift={shiftSelected}
          onDone={stopSelecting}
        />
      )}
      {!selecting && (
        <View style={{ position: "absolute", right: 16, bottom: 16 }}>
          <IconBtn label="Add a line" onPress={() => setComposing(true)} size={56} style={{ backgroundColor: c.accent, elevation: 6, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8 }}>
            <Plus size={26} color="#fff" />
          </IconBtn>
        </View>
      )}
      <Sheet open={composing} onClose={() => setComposing(false)} tall>
        <BlockFields
          key={`${day.date}-${composing}`}
          habits={habits}
          busy={busy}
          suggestedMinute={suggestedMinute}
          plannedHabitIds={blocks.map((b) => b.habitId).filter((id): id is number => id !== null)}
          today={today}
          isToday={isToday}
          onSubmit={addBlock}
          onCancel={() => setComposing(false)}
          onToggleMuted={toggleMuted}
        />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} tall>
        {editing && (
          <BlockFields
            key={editing.id}
            habits={habits}
            initial={editing}
            busy={busy}
            onSubmit={(title, endMinute, habitId) => saveBlock(editing.id, title, endMinute, habitId)}
            onCancel={() => setEditing(null)}
            onToggleMuted={toggleMuted}
          />
        )}
      </Sheet>
    </>
  );

  return (
    <Screen onRefresh={reload} overlay={overlay} contentStyle={{ paddingBottom: selecting ? 260 : 110 }}>
      <ScreenHeader
        title="Daily plan"
        subtitle={`${dayLabel(day.date, day.today)} · ${parseIso(day.date).toLocaleDateString(DATE_LOCALE, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <IconBtn label="Previous day" onPress={() => goTo(shiftIso(day.date, -1))} bordered size={40}>
          <ChevronLeft size={18} color={c.inkSoft} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <DateTimeInput
            mode="date"
            compact
            value={parseIso(day.date)}
            onChange={(d) => goTo(toIso(d))}
            accessibilityLabel="Jump to a day"
          />
        </View>
        {!isToday && <Btn size="sm" variant="ghost" label="Today" onPress={() => goTo(day.today)} />}
        <IconBtn label="Next day" onPress={() => goTo(shiftIso(day.date, 1))} bordered size={40}>
          <ChevronRight size={18} color={c.inkSoft} />
        </IconBtn>
      </View>

      {blocks.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.track, overflow: "hidden" }}>
            <View style={{ width: `${(doneCount / blocks.length) * 100}%`, height: "100%", backgroundColor: tw.emerald[500] }} />
          </View>
          <Txt variant="tiny" color="soft" tabular>
            <Txt variant="tiny" weight="700" color={donePercent === 100 ? tw.emerald[600] : "soft"}>
              {donePercent}%
            </Txt>{" "}
            {doneCount}/{blocks.length}
          </Txt>
          {!selecting && (
            <Btn
              size="sm"
              variant="ghost"
              label="Shift"
              icon={<ListChecks size={14} color={c.ink} />}
              onPress={() => setSelecting(true)}
            />
          )}
        </View>
      )}

      {error && <Banner onClose={() => setError(null)}>{error}</Banner>}
      {notice && (
        <Banner tone="success" onClose={() => setNotice(null)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} color={tw.emerald[600]} />
            <Txt variant="small" color={isDark ? tw.emerald[300] : tw.emerald[800]} style={{ flex: 1 }}>
              {notice}
            </Txt>
          </View>
        </Banner>
      )}

      {blocks.length === 0 ? (
        <EmptyDay plannedDates={day.plannedDates} date={day.date} today={day.today} busy={busy} onCopy={copyFrom} onAdd={() => setComposing(true)} />
      ) : (
        <View>
          {slots.map((slot, index) => {
            const previous = slots[index - 1];
            const length = previous === undefined ? null : position(slot.endMinute) - position(previous.endMinute);
            const current = index === currentIndex;
            const leftOfIt = position(slot.endMinute) - nowPosition;
            return (
              <View key={slot.endMinute} style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ width: 50, alignItems: "flex-end", paddingTop: 8 }}>
                  <Txt variant="small" weight="700" tabular color={current ? amber : "ink"}>
                    {formatMinute(slot.endMinute)}
                  </Txt>
                  {length !== null && length > 0 && (
                    <Txt variant="tiny" color="faint">
                      {formatGap(length)}
                    </Txt>
                  )}
                  {current && leftOfIt > 0 && (
                    <Txt variant="tiny" weight="600" color={amber}>
                      {formatGap(leftOfIt)} left
                    </Txt>
                  )}
                  {slot.items.length > 1 && (
                    <Txt variant="tiny" color="faint">
                      ×{slot.items.length}
                    </Txt>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  {slot.items.map((block, itemIndex) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      habit={habits.find((h) => h.id === block.habitId) ?? null}
                      entry={entryFor(block.habitId)}
                      current={current}
                      last={index === slots.length - 1 && itemIndex === slot.items.length - 1}
                      attachedAbove={itemIndex > 0}
                      attachedBelow={itemIndex < slot.items.length - 1}
                      selecting={selecting}
                      selected={selectedIds.has(block.id)}
                      pending={pendingIds.has(block.id)}
                      busy={busy}
                      onToggleDone={() => toggleDone(block)}
                      onToggleSelect={() =>
                        setSelectedIds((cur) => {
                          const next = new Set(cur);
                          if (!next.delete(block.id)) next.add(block.id);
                          return next;
                        })
                      }
                      onEdit={() => setEditing(block)}
                      onDelete={() => removeBlock(block)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
          {isToday && currentIndex === -1 && <NowLine minute={nowMinute} />}
        </View>
      )}
    </Screen>
  );
}

/** A day with nothing on it yet — and the fastest way out of that. */
function EmptyDay({
  plannedDates,
  date,
  today,
  busy,
  onCopy,
  onAdd,
}: {
  plannedDates: string[];
  date: string;
  today: string;
  busy: boolean;
  onCopy: (from: string) => void;
  onAdd: () => void;
}) {
  const { c } = useTheme();
  // Yesterday is the usual answer: the most recent planned day before this one.
  const nearest = plannedDates.find((d) => d < date) ?? plannedDates[plannedDates.length - 1];
  const [source, setSource] = useState(nearest ?? "");
  const chosen = plannedDates.includes(source) ? source : (nearest ?? "");

  return (
    <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: c.lineStrong, borderRadius: 18, padding: 22, alignItems: "center", gap: 8 }}>
      <CalendarDays size={28} color={c.inkFaint} />
      <Txt weight="600">Nothing planned yet</Txt>
      <Txt variant="small" color="soft" center>
        Add the first line — what you are doing and the time it is done. Each line runs from the end of the one above it.
      </Txt>
      <Txt variant="tiny" color="faint" center style={{ fontFamily: "monospace", lineHeight: 18 }}>
        {"(12:00) Planning\n(12:10) prayer\n(12:20) Write dailies"}
      </Txt>
      <Btn label="Add the first line" icon={<Plus size={15} color="#fff" />} onPress={onAdd} style={{ alignSelf: "stretch", marginTop: 4 }} />
      {chosen ? (
        <View style={{ alignSelf: "stretch", gap: 8, marginTop: 6 }}>
          <Txt variant="label">Or copy a day you already planned</Txt>
          <SelectField
            title="Copy from"
            value={chosen}
            onChange={setSource}
            options={plannedDates.map((d) => ({
              value: d,
              label: `${dayLabel(d, today)}${Math.abs(daysBetween(today, d)) <= 1 ? ` · ${shortDate(d)}` : ""}`,
            }))}
          />
          <Btn variant="ghost" label="Copy this day" icon={<Copy size={14} color={c.ink} />} onPress={() => onCopy(chosen)} loading={busy} />
        </View>
      ) : null}
    </View>
  );
}

/** Reached with the setting off — explain, then point at the switch. */
function PlannerOff() {
  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 8, padding: 24, marginTop: 24 }}>
        <ClipboardList size={32} color={tw.amber[600]} />
        <Txt weight="600">The daily plan is off</Txt>
        <Txt variant="small" color="soft" center>
          Turn it on to lay your day out hour by hour and pull habits straight into the timeline.
        </Txt>
        <Btn label="Open settings" onPress={() => router.navigate("/settings")} style={{ marginTop: 6, alignSelf: "stretch" }} />
      </Card>
    </Screen>
  );
}
