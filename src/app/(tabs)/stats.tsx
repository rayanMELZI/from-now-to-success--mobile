import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { Ban, Flame } from "lucide-react-native";
import { errorMessage } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { keys, useHabits, useHistory, useRefreshOnFocus } from "@/lib/queries";
import { habitRisk, type HistoryDay } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { GaugeBar } from "@/components/GaugeBar";
import { RiskBadge } from "@/components/HabitBits";
import { Banner, Card, Chip } from "@/components/ui/Card";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { SkeletonScreen } from "@/components/ui/Skeleton";
import { Txt } from "@/components/ui/Txt";

const POINTS_PER_LEVEL = 500;
const DONE = tw.emerald[600];
const MISSED = tw.stone[500];

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function localIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <Txt variant="label">{label}</Txt>
      <Txt tabular weight="700" style={{ fontSize: 24 }}>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="tiny" color="faint">
          {hint}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Last 30 days: done stacked over missed, zero-filled so the axis is continuous. */
function HistoryChart({ history }: { history: HistoryDay[] }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<HistoryDay | null>(null);

  const days = useMemo(() => {
    const byDate = new Map(history.map((d) => [d.date, d]));
    const today = localIso();
    const lastData = history.length ? history[history.length - 1].date : today;
    const end = lastData > today ? lastData : today;
    return Array.from({ length: 30 }, (_, i) => {
      const date = shiftDate(end, i - 29);
      return byDate.get(date) ?? { date, done: 0, missed: 0, points: 0 };
    });
  }, [history]);

  const maxTotal = Math.max(1, ...days.map((d) => d.done + d.missed));
  const chartHeight = 130;
  const gap = 3;
  const barWidth = width > 0 ? Math.max(3, (width - (days.length - 1) * gap) / days.length) : 0;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt weight="600">Last 30 days</Txt>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[
            { color: DONE, label: "done" },
            { color: MISSED, label: "missed" },
          ].map((l) => (
            <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
              <Txt variant="tiny" color="soft">
                {l.label}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {history.length === 0 ? (
        <Txt variant="small" color="faint" center style={{ paddingVertical: 28 }}>
          No history yet — check in for a few days and your progress shows up here.
        </Txt>
      ) : (
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <Txt variant="tiny" color={picked ? "soft" : "faint"} center style={{ marginBottom: 6 }}>
            {picked
              ? `${picked.date}: ${picked.done} done · ${picked.missed} missed · ${picked.points >= 0 ? "+" : ""}${picked.points} pts`
              : "Tap a bar for that day"}
          </Txt>
          {width > 0 && (
            <View>
              <Svg width={width} height={chartHeight + 18}>
                {days.map((day, i) => {
                  const x = i * (barWidth + gap);
                  const doneH = (day.done / maxTotal) * chartHeight;
                  const missedH = (day.missed / maxTotal) * chartHeight;
                  const dim = picked && picked.date !== day.date ? 0.5 : 1;
                  return (
                    <G key={day.date}>
                      {day.missed > 0 && (
                        <Rect x={x} y={chartHeight - missedH} width={barWidth} height={missedH} rx={2} fill={MISSED} opacity={dim} />
                      )}
                      {day.done > 0 && (
                        <Rect
                          x={x}
                          y={chartHeight - missedH - doneH - (day.missed > 0 ? 2 : 0)}
                          width={barWidth}
                          height={doneH}
                          rx={2}
                          fill={DONE}
                          opacity={dim}
                        />
                      )}
                      {i % 7 === 1 && (
                        <SvgText x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill={c.inkFaint}>
                          {day.date.slice(5)}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </Svg>
              {/* touch targets wider than the bars, laid over the chart */}
              <View style={{ position: "absolute", left: 0, top: 0, flexDirection: "row", height: chartHeight }}>
                {days.map((day) => (
                  <Pressable
                    key={day.date}
                    onPress={() => setPicked(picked?.date === day.date ? null : day)}
                    accessibilityLabel={`${day.date}: ${day.done} done, ${day.missed} missed`}
                    style={{ width: barWidth + gap, height: chartHeight }}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

export default function StatsScreen() {
  const { c } = useTheme();
  const { refreshUser } = useAuth();
  const user = useUser();
  const historyQuery = useHistory(30);
  const habitsQuery = useHabits();
  useRefreshOnFocus(keys.history(30), keys.habits);
  const history = historyQuery.data;
  const habits = habitsQuery.data;
  const loadError = historyQuery.error ?? habitsQuery.error;
  const error = loadError ? errorMessage(loadError) : null;

  const reload = () =>
    Promise.all([historyQuery.refetch(), habitsQuery.refetch(), refreshUser().catch(() => {})]);

  if (!history || !habits) {
    return error ? (
      <Screen onRefresh={reload}>
        <Banner>{error}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen cards={3} />
    );
  }

  const bestStreak = Math.max(0, ...habits.map((h) => h.bestStreak));
  const validCount = habits.filter((h) => h.status === "VALID").length;
  const intoLevel = user.totalPoints % POINTS_PER_LEVEL;
  const unlocked = habits.filter((h) => h.status !== "LOCKED");

  return (
    <Screen onRefresh={reload}>
      <ScreenHeader title="Your progress" subtitle="Points, streaks and the last 30 days." />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatTile label="Total points" value={String(user.totalPoints)} />
        <StatTile label="Level" value={String(user.level)} hint={`${intoLevel}/${POINTS_PER_LEVEL} to next`} />
        <StatTile label="Best streak" value={`${bestStreak} days`} />
        <StatTile label="Valid habits" value={`${validCount}/${habits.length}`} hint="unlock the next tier" />
      </View>

      {/* the level bar — how far into this level the points have come */}
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="small" weight="600">
            Level {user.level}
          </Txt>
          <Txt variant="tiny" color="faint" tabular>
            {POINTS_PER_LEVEL - intoLevel} pts to level {user.level + 1}
          </Txt>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: "hidden" }}>
          <View style={{ width: `${(intoLevel / POINTS_PER_LEVEL) * 100}%`, height: "100%", backgroundColor: c.accent }} />
        </View>
      </Card>

      <HistoryChart history={history} />

      {unlocked.length > 0 && (
        <Card style={{ gap: 2 }}>
          <Txt weight="600" style={{ marginBottom: 6 }}>
            Streaks
          </Txt>
          {unlocked.map((habit, i) => {
            const risk = habitRisk(habit);
            return (
              <View key={habit.id} style={{ gap: 8, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.line }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {habit.habitType === "QUIT" && <Ban size={13} color={tw.red[500]} />}
                  <Txt variant="small" style={{ flexShrink: 1 }}>
                    {habit.name}
                  </Txt>
                  {habit.status === "VALID" && <Chip tone="success" label="valid" />}
                  {risk && <RiskBadge risk={risk} />}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <GaugeBar
                    gauge={habit.gauge}
                    max={habit.requiredStreak}
                    valid={habit.status === "VALID"}
                    timer={habit.trackingMode === "TIMER"}
                    style={{ flex: 1 }}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Flame size={13} color={tw.orange[500]} />
                    <Txt variant="small" color="soft" tabular>
                      {habit.currentStreak}
                    </Txt>
                    <Txt variant="tiny" color="faint" style={{ marginLeft: 6 }}>
                      best {habit.bestStreak}
                    </Txt>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
