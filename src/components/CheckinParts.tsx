import type { ReactNode } from "react";
import { View } from "react-native";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  Flame,
  Snowflake,
  Sprout,
  TimerReset,
  Trophy,
  X,
} from "lucide-react-native";
import {
  formatClock,
  formatDuration,
  habitRisk,
  habitVerbs,
  riskNote,
  type RiskLevel,
  type TimerEntry,
  type TodayEntry,
  type TodayResponse,
} from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Btn, IconBtn } from "./ui/Button";
import { Card } from "./ui/Card";
import { Field } from "./ui/Field";
import { DateTimeInput } from "./ui/Pickers";
import { Segmented } from "./ui/Segmented";
import { ToggleCard } from "./ui/ToggleCard";
import { Txt } from "./ui/Txt";
import { GaugeBar } from "./GaugeBar";
import { ProgressRing, RiskBadge } from "./HabitBits";

export interface MissDraft {
  habitId: number;
  reason: string;
  freeze: boolean;
}

export interface FallDraft {
  habitId: number;
  reason: string;
  when: "now" | "earlier";
  /** The picked moment for "earlier", in ms. */
  at: number;
}

/* ------------------------------------------------------------- summary */

export function TodaySummary({
  today,
  answered,
  pending,
  atRisk,
  runningTimers,
}: {
  today: TodayResponse;
  answered: number;
  pending: number;
  atRisk: number;
  runningTimers: number;
}) {
  const { isDark } = useTheme();
  const total = answered + pending;
  const stats: { label: string; value: ReactNode }[] = [
    {
      label: "Points today",
      value: (
        <Txt
          weight="700"
          tabular
          color={today.pointsToday >= 0 ? (isDark ? tw.emerald[400] : tw.emerald[600]) : isDark ? tw.amber[400] : tw.amber[600]}
        >
          {today.pointsToday >= 0 ? "+" : ""}
          {today.pointsToday}
        </Txt>
      ),
    },
  ];
  if (atRisk > 0) {
    stats.push({
      label: "At risk",
      value: <Stat icon={<AlertTriangle size={13} color={tw.rose[500]} />} text={String(atRisk)} color={isDark ? tw.rose[400] : tw.rose[600]} />,
    });
  }
  stats.push(
    { label: "Freezes", value: <Stat icon={<Snowflake size={13} color={tw.sky[500]} />} text={String(today.freezesLeft)} /> },
    {
      label: "Deep Freeze",
      value: <Stat icon={<Snowflake size={13} color={tw.rose[500]} />} text={today.deepFreezesLeft > 0 ? "ready" : "used"} />,
    },
  );
  if (runningTimers > 0) {
    stats.push({ label: "Clocks", value: <Stat icon={<TimerReset size={13} color={tw.sky[500]} />} text={String(runningTimers)} /> });
  }

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ProgressRing done={answered} total={total} />
        <View style={{ flex: 1 }}>
          <Txt weight="700">
            {total === 0 ? "Nothing to answer" : pending === 0 ? "All answered" : `${pending} left to answer`}
          </Txt>
          <Txt variant="tiny" color="soft">
            {today.date}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 10 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ gap: 2 }}>
            <Txt variant="label">{s.label}</Txt>
            {s.value}
          </View>
        ))}
      </View>
    </Card>
  );
}

function Stat({ icon, text, color }: { icon: ReactNode; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {icon}
      <Txt weight="700" tabular color={color ?? "ink"}>
        {text}
      </Txt>
    </View>
  );
}

/* ------------------------------------------------------- pending habit */

function HabitHeadline({ entry, risk }: { entry: TodayEntry; risk: RiskLevel | null }) {
  const { tone } = useTheme();
  const periodic = entry.schedule !== "DAILY";
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";
  const urgent = periodic && entry.daysLeftInPeriod <= entry.timesPerPeriod - entry.doneThisPeriod;
  const t = urgent ? tone.warning : tone.neutral;

  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {entry.habitType === "QUIT" ? <Ban size={15} color={tw.red[500]} /> : <Sprout size={15} color={tw.emerald[600]} />}
        <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {entry.name}
        </Txt>
      </View>
      {(periodic || risk) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {periodic && (
            <View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Txt variant="tiny" weight={urgent ? "600" : "400"} color={t.text}>
                {entry.doneThisPeriod}/{entry.timesPerPeriod} this {periodNoun} · {entry.daysLeftInPeriod} day
                {entry.daysLeftInPeriod === 1 ? "" : "s"} left
              </Txt>
            </View>
          )}
          {risk && <RiskBadge risk={risk} />}
        </View>
      )}
    </View>
  );
}

function GaugeRow({ entry }: { entry: TodayEntry }) {
  const { tone } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <GaugeBar gauge={entry.gauge} max={entry.requiredStreak} valid={entry.status === "VALID"} style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Flame size={12} color={tw.orange[500]} />
        <Txt variant="tiny" color="faint" tabular>
          {entry.currentStreak}
        </Txt>
      </View>
      {entry.multiplier > 1 && (
        <View style={{ backgroundColor: tone.accent.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Txt variant="tiny" weight="600" color={tone.accent.text}>
            ×{entry.multiplier}
          </Txt>
        </View>
      )}
    </View>
  );
}

function RiskNote({ risk }: { risk: RiskLevel }) {
  const { tone } = useTheme();
  const t = risk === "critical" ? tone.danger : tone.warning;
  return (
    <View style={{ flexDirection: "row", gap: 6, backgroundColor: t.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
      <AlertTriangle size={12} color={t.text} style={{ marginTop: 2 }} />
      <Txt variant="tiny" color={t.text} style={{ flex: 1 }}>
        {riskNote[risk]}
        {risk === "critical" && " — this one needs today."}
      </Txt>
    </View>
  );
}

export interface PendingProps {
  entry: TodayEntry;
  compact: boolean;
  busy: boolean;
  missDraft: MissDraft | null;
  freezesLeft: number;
  deepFreezesLeft: number;
  reordering: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: number) => void;
  onDone: () => void;
  onMissClick: (freeze: boolean) => void;
  onMissConfirm: (draft: MissDraft) => void;
  onMissCancel: () => void;
  onDraftChange: (draft: MissDraft) => void;
}

/** One habit waiting for an answer. */
export function PendingCard(props: PendingProps) {
  const { entry, compact, busy, missDraft, reordering } = props;
  const { tone, c } = useTheme();
  const risk = habitRisk(entry);
  const verbs = habitVerbs(entry.habitType);
  const periodic = entry.schedule !== "DAILY";
  const deep = entry.schedule === "MONTHLY";
  const freezeQuotaLeft = deep ? props.deepFreezesLeft : props.freezesLeft;

  const answers = (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Btn
        size="sm"
        variant="solid"
        tone="success"
        label={verbs.did}
        icon={<Check size={15} color="#fff" />}
        onPress={props.onDone}
        loading={busy}
        flex={!compact}
      />
      {periodic ? (
        <Btn
          size="sm"
          variant="outline"
          tone={deep ? "deep" : "info"}
          label={deep ? "Deep Freeze" : "Freeze"}
          icon={<Snowflake size={15} color={deep ? tw.rose[500] : tw.sky[500]} />}
          onPress={() => props.onMissClick(true)}
          disabled={busy || freezeQuotaLeft <= 0}
          flex={!compact}
        />
      ) : (
        <Btn
          size="sm"
          variant="ghost"
          label={verbs.missed}
          icon={<X size={15} color={c.ink} />}
          onPress={() => props.onMissClick(false)}
          disabled={busy}
          flex={!compact}
        />
      )}
    </View>
  );

  return (
    <Card
      borderColor={risk === "critical" ? tone.danger.border : risk === "caution" ? tone.warning.border : undefined}
      style={{ gap: 10, padding: compact ? 12 : 14 }}
    >
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 8 }}>
          <HabitHeadline entry={entry} risk={risk} />
          <GaugeRow entry={entry} />
        </View>
        {reordering && (
          <View style={{ gap: 2 }}>
            <IconBtn label={`Move ${entry.name} up`} onPress={() => props.onMove(-1)} disabled={!props.canMoveUp} size={34} bordered>
              <ArrowUp size={15} color={c.inkSoft} />
            </IconBtn>
            <IconBtn label={`Move ${entry.name} down`} onPress={() => props.onMove(1)} disabled={!props.canMoveDown} size={34} bordered>
              <ArrowDown size={15} color={c.inkSoft} />
            </IconBtn>
          </View>
        )}
      </View>
      {risk && !compact && <RiskNote risk={risk} />}
      {!reordering && (compact ? <View style={{ alignSelf: "flex-end" }}>{answers}</View> : answers)}
      {missDraft && (
        <MissDraftPanel
          entry={entry}
          draft={missDraft}
          busy={busy}
          freezesLeft={props.freezesLeft}
          deepFreezesLeft={props.deepFreezesLeft}
          onConfirm={props.onMissConfirm}
          onCancel={props.onMissCancel}
          onChange={props.onDraftChange}
        />
      )}
    </Card>
  );
}

/** Owning a miss: the reason, the freeze switch, and the confirmation. */
function MissDraftPanel({
  entry,
  draft,
  busy,
  freezesLeft,
  deepFreezesLeft,
  onConfirm,
  onCancel,
  onChange,
}: {
  entry: TodayEntry;
  draft: MissDraft;
  busy: boolean;
  freezesLeft: number;
  deepFreezesLeft: number;
  onConfirm: (draft: MissDraft) => void;
  onCancel: () => void;
  onChange: (draft: MissDraft) => void;
}) {
  const { c, tone } = useTheme();
  const periodic = entry.schedule !== "DAILY";
  const deep = entry.schedule === "MONTHLY";
  const periodNoun = entry.schedule === "WEEKLY" ? "week" : "month";
  const freezeTone = deep ? tone.deep : tone.info;

  return (
    <View style={{ gap: 10, backgroundColor: c.surfaceSunken, borderRadius: 12, padding: 12 }}>
      {periodic && <Txt variant="small" weight="600">Skip this whole {periodNoun}?</Txt>}
      <Txt variant="tiny" color="soft">
        What happened? (a reason halves the point loss)
      </Txt>
      <Field
        value={draft.reason}
        maxLength={500}
        multiline
        onChangeText={(reason) => onChange({ ...draft, reason })}
        placeholder="e.g. traveled all day, was sick…"
        style={{ minHeight: 60 }}
      />
      <ToggleCard
        active={draft.freeze}
        disabled={!periodic && freezesLeft <= 0}
        locked={periodic}
        tone={freezeTone}
        icon={(color) => <Snowflake size={18} color={color} />}
        title={deep ? "Deep Freeze" : "Streak freeze"}
        subtitle={`Gauge and streak stay untouched · ${
          deep ? `1 every 3 months (${deepFreezesLeft} ready)` : `${freezesLeft} left this month`
        }`}
        onToggle={periodic ? undefined : () => onChange({ ...draft, freeze: !draft.freeze })}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn
          variant="solid"
          tone={draft.freeze ? (deep ? "deep" : "info") : "neutral"}
          icon={draft.freeze ? <Snowflake size={14} color="#fff" /> : undefined}
          label={
            periodic
              ? deep
                ? "Use Deep Freeze"
                : `Freeze this ${periodNoun}`
              : draft.freeze
                ? "Freeze & confirm"
                : "Confirm miss"
          }
          onPress={() => onConfirm(draft)}
          loading={busy}
          flex
        />
        <Btn label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- answered */

export function AnsweredStatus({ entry }: { entry: TodayEntry }) {
  const { isDark } = useTheme();
  if (entry.todayStatus === "FROZEN") {
    const deep = entry.schedule === "MONTHLY";
    const color = deep ? tw.rose[500] : tw.sky[500];
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Snowflake size={13} color={color} />
        <Txt variant="tiny" color={color}>
          {deep ? "deep-frozen" : "frozen"}
        </Txt>
      </View>
    );
  }
  if (entry.todayStatus === "MISSED") {
    return (
      <Txt variant="tiny" color="faint">
        missed
      </Txt>
    );
  }
  return (
    <Txt variant="tiny" color={isDark ? tw.emerald[400] : tw.emerald[600]}>
      {entry.todayStatus === "DONE_TODAY"
        ? `${entry.doneThisPeriod}/${entry.timesPerPeriod} this ${entry.schedule === "WEEKLY" ? "week" : "month"}`
        : entry.habitType === "QUIT"
          ? "avoided ✓"
          : "done ✓"}
    </Txt>
  );
}

/* ---------------------------------------------------------------- timer */

const MINUTE_MS = 60_000;

/**
 * A timer habit: a clock running since the last relapse, the record it is
 * chasing, and the one button that ends the run.
 */
export function TimerCard({
  entry,
  elapsed,
  nowMs,
  busy,
  draft,
  onSlipClick,
  onDraftChange,
  onConfirm,
  onCancel,
}: {
  entry: TimerEntry;
  elapsed: number;
  nowMs: number;
  busy: boolean;
  draft: FallDraft | null;
  onSlipClick: () => void;
  onDraftChange: (draft: FallDraft) => void;
  onConfirm: (draft: FallDraft) => void;
  onCancel: () => void;
}) {
  const { c, isDark } = useTheme();
  const { days, time } = formatClock(elapsed);
  const record = entry.bestCleanSeconds;
  const beatingRecord = record > 0 && elapsed > record;
  const goalReached = entry.nextMilestoneSeconds === 0;
  const toNext = entry.nextMilestoneSeconds - elapsed;
  const gold = isDark ? tw.amber[400] : tw.amber[600];

  // A backdated slip sits inside the run that is ending: not before the clock
  // started, not after now — rounded inwards so the server never refuses it.
  const startedMs = Date.parse(entry.clockStartedAt);
  const earliest = Math.ceil(startedMs / MINUTE_MS) * MINUTE_MS;
  const latest = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  const backdated = draft?.when === "earlier";
  const pickedMs = backdated ? draft.at : nowMs;
  const pickedValid = Number.isFinite(pickedMs) && pickedMs >= startedMs && pickedMs <= nowMs;
  const endsAt = pickedValid ? Math.max(0, Math.floor((pickedMs - startedMs) / 1000)) : elapsed;
  const headStart = pickedValid ? Math.max(0, Math.floor((nowMs - pickedMs) / 1000)) : 0;
  const endsAsRecord = record > 0 && endsAt > record;

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ban size={15} color={tw.red[500]} />
        <Txt weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {entry.name}
        </Txt>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        {days > 0 && (
          <Txt tabular weight="700" style={{ fontSize: 28 }}>
            {days}
            <Txt color="faint" style={{ fontSize: 17 }}>
              d
            </Txt>
          </Txt>
        )}
        <Txt tabular weight="700" color={beatingRecord ? gold : "ink"} style={{ fontSize: 28 }}>
          {time}
        </Txt>
      </View>

      <GaugeBar gauge={entry.gauge} max={entry.requiredStreak} valid={entry.status === "VALID"} timer />
      <Txt variant="tiny" color="faint">
        {entry.gauge}/{entry.requiredStreak} milestones
      </Txt>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Trophy size={12} color={beatingRecord ? gold : c.inkFaint} />
          <Txt variant="tiny" color={beatingRecord ? gold : "faint"}>
            {record === 0
              ? "First run — you are setting the bar"
              : beatingRecord
                ? `Past your best of ${formatDuration(record)}`
                : `Best: ${formatDuration(record)}`}
          </Txt>
        </View>
        {goalReached ? (
          <Txt variant="tiny" color={isDark ? tw.emerald[400] : tw.emerald[600]}>
            Goal reached ✓
          </Txt>
        ) : (
          toNext > 0 && (
            <Txt variant="tiny" color="faint">
              Next milestone in {formatDuration(toNext)}
            </Txt>
          )
        )}
      </View>

      <Btn
        size="sm"
        variant="outline"
        tone="danger"
        label="I slipped"
        icon={<TimerReset size={15} color={tw.rose[500]} />}
        onPress={onSlipClick}
        disabled={busy}
      />

      {draft && (
        <View style={{ gap: 10, backgroundColor: c.surfaceSunken, borderRadius: 12, padding: 12 }}>
          <Txt variant="small" weight="600">
            Reset the clock?
          </Txt>
          <Txt variant="tiny" color="soft">
            When did it happen?
          </Txt>
          <Segmented
            size="sm"
            value={draft.when}
            options={[
              { value: "now", label: "Just now" },
              { value: "earlier", label: "Earlier" },
            ]}
            onChange={(when) => onDraftChange({ ...draft, when })}
          />
          {backdated && (
            <DateTimeInput
              mode="datetime"
              value={new Date(draft.at)}
              minimumDate={new Date(earliest)}
              maximumDate={new Date(latest)}
              onChange={(d) => onDraftChange({ ...draft, at: d.getTime() })}
              accessibilityLabel="The moment you slipped"
            />
          )}
          {backdated && !pickedValid ? (
            <Txt variant="tiny" color={isDark ? tw.rose[400] : tw.rose[600]}>
              Pick a moment inside this run — after it started, and not in the future.
            </Txt>
          ) : (
            <Txt variant="tiny" color="soft">
              This run ends at {formatDuration(endsAt)}
              {endsAsRecord ? " — your new record" : ""}. The gauge empties and the clock starts over
              {headStart > 0 ? `, already reading ${formatDuration(headStart)} clean since then` : " from zero"}.
            </Txt>
          )}
          <Txt variant="tiny" color="soft">
            What happened? (a reason halves the point loss)
          </Txt>
          <Field
            value={draft.reason}
            maxLength={500}
            multiline
            onChangeText={(reason) => onDraftChange({ ...draft, reason })}
            placeholder="e.g. stressed after work, someone offered…"
            style={{ minHeight: 60 }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn
              variant="solid"
              tone="danger"
              label="Yes, restart it"
              onPress={() => onConfirm(draft)}
              loading={busy}
              disabled={backdated && !pickedValid}
              flex
            />
            <Btn label="Cancel" variant="ghost" onPress={onCancel} />
          </View>
        </View>
      )}
    </Card>
  );
}
