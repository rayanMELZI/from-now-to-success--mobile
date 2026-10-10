import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { ArrowUpDown, Ban, Check, LayoutGrid, Rows3, Sprout, Trophy } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { syncReminders } from "@/lib/reminders";
import {
  formatDuration,
  habitRisk,
  type CheckinResult,
  type FallResult,
  type TimerEntry,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { useFocusReload } from "@/lib/useFocusReload";
import { usePersistentState } from "@/lib/usePersistentState";
import {
  AnsweredStatus,
  PendingCard,
  TimerCard,
  TodaySummary,
  type FallDraft,
  type MissDraft,
} from "@/components/CheckinParts";
import { Banner, Card } from "@/components/ui/Card";
import { IconBtn } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonScreen } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { Txt } from "@/components/ui/Txt";

type GroupBy = "none" | "rhythm" | "goal";
type Shape = "cards" | "list";

function groupEntries(entries: TodayEntry[], mode: GroupBy) {
  const buckets: { key: string; label: string; match: (e: TodayEntry) => boolean }[] =
    mode === "rhythm"
      ? [
          { key: "DAILY", label: "Daily", match: (e) => e.schedule === "DAILY" },
          { key: "WEEKLY", label: "Weekly", match: (e) => e.schedule === "WEEKLY" },
          { key: "MONTHLY", label: "Monthly", match: (e) => e.schedule === "MONTHLY" },
        ]
      : mode === "goal"
        ? [
            { key: "BUILD", label: "Building", match: (e) => e.habitType === "BUILD" },
            { key: "QUIT", label: "Quitting", match: (e) => e.habitType === "QUIT" },
          ]
        : [{ key: "all", label: "", match: () => true }];
  return buckets
    .map((b) => ({ key: b.key, label: b.label, items: entries.filter(b.match) }))
    .filter((g) => g.items.length > 0);
}

/** Which section an entry lands in — reordering never crosses those. */
function groupKey(entry: TodayEntry, mode: GroupBy): string {
  return mode === "rhythm" ? entry.schedule : mode === "goal" ? entry.habitType : "all";
}

function elapsedOf(timer: TimerEntry, serverNowMs: number): number {
  return Math.max(0, Math.floor((serverNowMs - Date.parse(timer.clockStartedAt)) / 1000));
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export default function CheckinScreen() {
  const { c, isDark } = useTheme();
  const { refreshUser } = useAuth();
  const user = useUser();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [missDraft, setMissDraft] = useState<MissDraft | null>(null);
  const [fallDraft, setFallDraft] = useState<FallDraft | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [fallResult, setFallResult] = useState<FallResult | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const [groupBy, setGroupBy] = usePersistentState<GroupBy>("checkinGroupBy", "none");
  const [shape, setShape] = usePersistentState<Shape>("checkinView", "cards");

  // The clocks tick locally; skew corrects a device clock that disagrees
  // with the server, which owns the real elapsed time.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [skewMs, setSkewMs] = useState(0);
  const bankedRef = useRef("");

  const reload = useCallback(
    () =>
      api<TodayResponse>("/api/checkins/today").then((data) => {
        setSkewMs(Date.parse(data.serverNow) - Date.now());
        setToday(data);
        setLocalOrder(null);
        setError(null);
        return data;
      }),
    [],
  );
  const onLoadError = useCallback((err: unknown) => setError(errorMessage(err)), []);
  useFocusReload(reload, onLoadError);

  const timers = useMemo(() => today?.timers ?? [], [today]);
  const hasTimers = timers.length > 0;

  useEffect(() => {
    if (!hasTimers) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  // A milestone only pays once the server sees it: ask again the moment a
  // clock ticks past one — each (habit, milestone) pair triggers one reload.
  useEffect(() => {
    const due = timers
      .filter((t) => t.nextMilestoneSeconds > 0 && elapsedOf(t, nowMs + skewMs) >= t.nextMilestoneSeconds)
      .map((t) => `${t.habitId}:${t.nextMilestoneSeconds}`)
      .join(",");
    if (due && due !== bankedRef.current) {
      bankedRef.current = due;
      void reload();
    }
  }, [timers, nowMs, skewMs, reload]);

  /** After any answer: the screen, the points in the header, the reminders. */
  async function settle() {
    const [fresh] = await Promise.all([reload(), refreshUser()]);
    void syncReminders(user, fresh);
  }

  async function answer(habitId: number, done: boolean, reason?: string, freeze?: boolean) {
    setBusyId(habitId);
    setError(null);
    try {
      const submission = await api<CheckinResult>("/api/checkins", {
        method: "POST",
        body: { entries: [{ habitId, done, reason: reason || undefined, freeze }] },
      });
      void Haptics.notificationAsync(
        submission.becameValid.length > 0 || submission.unlocked.length > 0
          ? Haptics.NotificationFeedbackType.Success
          : done
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      setResult(submission);
      setFallResult(null);
      setMissDraft(null);
      await settle();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmFall(draft: FallDraft) {
    setBusyId(draft.habitId);
    setError(null);
    try {
      // Only a deliberate "earlier" is backdated; "now" stays server-side so a
      // wrong device clock cannot skew an in-the-moment slip.
      const slippedAt = draft.when === "earlier" ? new Date(draft.at).toISOString() : undefined;
      const submission = await api<FallResult>(`/api/timers/${draft.habitId}/fall`, {
        method: "POST",
        body: { reason: draft.reason || undefined, slippedAt },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setFallResult(submission);
      setResult(null);
      setFallDraft(null);
      bankedRef.current = "";
      await settle();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!today) {
    return error ? (
      <Screen onRefresh={reload}>
        <Banner>{error}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen />
    );
  }

  const answered = today.entries.filter((e) => e.todayStatus !== "PENDING");
  const serverPending = today.entries.filter((e) => e.todayStatus === "PENDING");
  const pending = localOrder
    ? localOrder.flatMap((id) => serverPending.filter((e) => e.habitId === id))
    : serverPending;

  /** Moves one habit up or down inside its own section, and saves the order. */
  async function move(habitId: number, delta: number) {
    const ids = pending.map((e) => e.habitId);
    const from = ids.indexOf(habitId);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    if (groupKey(pending[to], groupBy) !== groupKey(pending[from], groupBy)) return;
    const next = moveItem(ids, from, to);
    setLocalOrder(next);
    void Haptics.selectionAsync().catch(() => {});
    try {
      await api("/api/habits/order", { method: "PUT", body: { habitIds: next } });
    } catch (err) {
      setError(errorMessage(err, "Could not save the order"));
      await reload();
    }
  }

  const renderPending = (entry: TodayEntry) => {
    const index = pending.indexOf(entry);
    const prev = pending[index - 1];
    const next = pending[index + 1];
    return (
      <PendingCard
        key={entry.habitId}
        entry={entry}
        compact={shape === "list"}
        busy={busyId === entry.habitId}
        missDraft={missDraft?.habitId === entry.habitId ? missDraft : null}
        freezesLeft={today.freezesLeft}
        deepFreezesLeft={today.deepFreezesLeft}
        reordering={reordering}
        canMoveUp={!!prev && groupKey(prev, groupBy) === groupKey(entry, groupBy)}
        canMoveDown={!!next && groupKey(next, groupBy) === groupKey(entry, groupBy)}
        onMove={(delta) => move(entry.habitId, delta)}
        onDone={() => answer(entry.habitId, true)}
        onMissClick={(freeze) => setMissDraft({ habitId: entry.habitId, reason: "", freeze })}
        onMissConfirm={(draft) => answer(entry.habitId, false, draft.reason, draft.freeze)}
        onMissCancel={() => setMissDraft(null)}
        onDraftChange={setMissDraft}
      />
    );
  };

  const groups = groupEntries(pending, groupBy);
  const gap = shape === "list" ? 8 : 12;

  const toasts = (
    <>
      <Toast
        open={result !== null}
        tone={result && result.earnedPoints >= 0 ? "success" : "warning"}
        onClose={() => setResult(null)}
      >
        {result && (
          <>
            <Txt weight="600">
              {result.earnedPoints >= 0 ? "+" : ""}
              {result.earnedPoints} points · Total {result.totalPoints} (level {result.level})
            </Txt>
            {result.becameValid.length > 0 && (
              <Txt variant="small" color="soft">
                ✓ Now valid: {result.becameValid.join(", ")}
              </Txt>
            )}
            {result.unlocked.length > 0 && (
              <Txt variant="small" color="soft">
                Unlocked: {result.unlocked.join(", ")}
              </Txt>
            )}
          </>
        )}
      </Toast>
      <Toast open={fallResult !== null} tone="neutral" onClose={() => setFallResult(null)}>
        {fallResult && (
          <>
            <Txt weight="600">
              Clock restarted — that run lasted {formatDuration(fallResult.lastRunSeconds)}.
              {fallResult.newRunSeconds > 0 && ` The new one already reads ${formatDuration(fallResult.newRunSeconds)}.`}
            </Txt>
            <Txt variant="small" color="soft">
              {fallResult.earnedPoints >= 0 ? "+" : ""}
              {fallResult.earnedPoints} points · Total {fallResult.totalPoints} (level {fallResult.level})
            </Txt>
            {fallResult.newRecord && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Trophy size={14} color={tw.amber[600]} />
                <Txt variant="small" color={isDark ? tw.amber[300] : tw.amber[700]}>
                  A new personal best — beat {formatDuration(fallResult.bestCleanSeconds)} next time.
                </Txt>
              </View>
            )}
            {fallResult.relocked.length > 0 && (
              <Txt variant="small" color="soft">
                Locked again: {fallResult.relocked.join(", ")}
              </Txt>
            )}
          </>
        )}
      </Toast>
    </>
  );

  return (
    <Screen onRefresh={reload} overlay={toasts}>
      <ScreenHeader
        title="Daily check-in"
        subtitle="Answer any habit as soon as you know. Honesty builds the gauge that counts."
      />

      <TodaySummary
        today={today}
        answered={answered.length}
        pending={pending.length}
        atRisk={pending.filter((e) => habitRisk(e) !== null).length}
        runningTimers={timers.length}
      />

      {error && <Banner onClose={() => setError(null)}>{error}</Banner>}

      {timers.length > 0 && (
        <Disclosure title="Timers" count={timers.length} defaultOpen storageKey="checkin-timers" summary="clocks still running">
          <View style={{ gap: 12 }}>
            {timers.map((timer) => (
              <TimerCard
                key={timer.habitId}
                entry={timer}
                elapsed={elapsedOf(timer, nowMs + skewMs)}
                nowMs={nowMs + skewMs}
                busy={busyId === timer.habitId}
                draft={fallDraft?.habitId === timer.habitId ? fallDraft : null}
                onSlipClick={() =>
                  setFallDraft({ habitId: timer.habitId, reason: "", when: "now", at: nowMs + skewMs })
                }
                onDraftChange={setFallDraft}
                onConfirm={confirmFall}
                onCancel={() => setFallDraft(null)}
              />
            ))}
          </View>
        </Disclosure>
      )}

      {today.entries.length === 0 && timers.length === 0 && (
        <View style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: c.lineStrong, borderRadius: 16, padding: 28 }}>
          <Txt color="soft" center>
            No active habits yet — add some on your roadmap first.
          </Txt>
        </View>
      )}

      {pending.length > 0 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {pending.length > 1 && (
              <View style={{ flex: 1 }}>
                <Segmented
                  size="sm"
                  value={groupBy}
                  onChange={setGroupBy}
                  options={[
                    { value: "none", label: "All" },
                    { value: "rhythm", label: "Rhythm" },
                    { value: "goal", label: "Goal" },
                  ]}
                />
              </View>
            )}
            <Segmented
              size="sm"
              stretch={false}
              value={shape}
              onChange={setShape}
              options={[
                { value: "cards", icon: <LayoutGrid size={15} color={shape === "cards" ? c.ink : c.inkFaint} />, accessibilityLabel: "Roomy cards" },
                { value: "list", icon: <Rows3 size={15} color={shape === "list" ? c.ink : c.inkFaint} />, accessibilityLabel: "Compact list" },
              ]}
            />
            {pending.length > 1 && (
              <IconBtn
                label={reordering ? "Done reordering" : "Reorder habits"}
                onPress={() => setReordering(!reordering)}
                bordered
                size={38}
                style={reordering ? { backgroundColor: c.accent, borderColor: c.accent } : undefined}
              >
                {reordering ? <Check size={16} color="#fff" /> : <ArrowUpDown size={16} color={c.inkSoft} />}
              </IconBtn>
            )}
          </View>

          {groupBy === "none" ? (
            <View style={{ gap }}>{pending.map(renderPending)}</View>
          ) : (
            <View style={{ gap: 6 }}>
              {groups.map((group) => (
                <Disclosure key={group.key} title={group.label} count={group.items.length} defaultOpen storageKey={`checkin-group-${group.key}`}>
                  <View style={{ gap }}>{group.items.map(renderPending)}</View>
                </Disclosure>
              ))}
            </View>
          )}
        </>
      )}

      {pending.length === 0 && today.entries.length > 0 && (
        <Card
          borderColor={isDark ? "#065f46" : tw.emerald[200]}
          style={{ alignItems: "center", gap: 4, padding: 22, backgroundColor: isDark ? "rgba(16,185,129,0.12)" : tw.emerald[50] }}
        >
          <Check size={28} color={isDark ? tw.emerald[300] : tw.emerald[700]} />
          <Txt weight="600" color={isDark ? tw.emerald[300] : tw.emerald[800]}>
            All answered for now
          </Txt>
          <Txt variant="small" color={isDark ? tw.emerald[300] : tw.emerald[800]}>
            {today.pointsToday >= 0 ? "+" : ""}
            {today.pointsToday} points today. See you tomorrow!
          </Txt>
        </Card>
      )}

      {answered.length > 0 && (
        <Disclosure title="Answered" count={answered.length} storageKey="checkin-answered" summary="already settled today">
          <View style={{ gap: 4 }}>
            {answered.map((entry) => (
              <View
                key={entry.habitId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: c.surface,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                {entry.habitType === "QUIT" ? <Ban size={13} color={tw.red[500]} /> : <Sprout size={13} color={tw.emerald[600]} />}
                <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
                  {entry.name}
                </Txt>
                <AnsweredStatus entry={entry} />
              </View>
            ))}
          </View>
        </Disclosure>
      )}
    </Screen>
  );
}
