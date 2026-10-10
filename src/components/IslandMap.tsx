import { useMemo, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { ClipPath, Circle, Defs, Path, Pattern, Rect } from "react-native-svg";
import {
  AlertTriangle,
  Ban,
  Check,
  Flame,
  Footprints,
  Lock,
  Maximize2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Zap,
} from "lucide-react-native";
import { habitRisk, type Habit } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { Txt } from "./ui/Txt";

/* ------------------------------------------------------------------ */
/* Layout — the same layered layout as the web map. Columns are        */
/* prerequisite depth; the longest chain (the spine) runs straight     */
/* along the centre line and everything else splits above and below.  */
/* ------------------------------------------------------------------ */

const NODE_W = 190;
const NODE_H = 104;
const COL_W = 240;
const ROW_H = 132;
const ANCHOR_W = 150;
const ANCHOR_GAP = 60;
const PAD = 48;

type Point = { x: number; y: number };

function computeLayout(habits: Habit[]): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (habits.length === 0) {
    positions.set("now", { x: 0, y: -NODE_H / 2 });
    positions.set("success", { x: ANCHOR_W + ANCHOR_GAP * 2, y: -NODE_H / 2 });
    return positions;
  }

  const ids = new Set(habits.map((h) => h.id));
  const byId = new Map(habits.map((h) => [h.id, h]));
  const prereqsOf = (h: Habit) => h.prerequisiteIds.filter((p) => ids.has(p));

  const chainLen = new Map<number, number>();
  const chainPrev = new Map<number, number | null>();
  const lenOf = (h: Habit): number => {
    const cached = chainLen.get(h.id);
    if (cached !== undefined) return cached;
    chainLen.set(h.id, 1); // cycle guard (the backend forbids cycles anyway)
    let best = 0;
    let prev: number | null = null;
    for (const p of prereqsOf(h)) {
      const v = lenOf(byId.get(p)!);
      if (v > best) {
        best = v;
        prev = p;
      }
    }
    chainLen.set(h.id, best + 1);
    chainPrev.set(h.id, prev);
    return best + 1;
  };
  habits.forEach(lenOf);

  let last = habits[0];
  habits.forEach((h) => {
    if ((chainLen.get(h.id) ?? 0) > (chainLen.get(last.id) ?? 0)) last = h;
  });
  const spineIds = new Set<number>();
  for (let cur: number | null | undefined = last.id; cur != null; cur = chainPrev.get(cur)) {
    spineIds.add(cur);
  }

  const rankOf = (id: number) => (chainLen.get(id) ?? 1) - 1;
  const maxRank = Math.max(...habits.map((h) => rankOf(h.id)));
  const columns: Habit[][] = Array.from({ length: maxRank + 1 }, () => []);
  habits.forEach((h) => columns[rankOf(h.id)].push(h));

  const yOf = new Map<number, number>();
  const barycentre = (h: Habit) => {
    const ps = prereqsOf(h);
    if (!ps.length) return 0;
    return ps.reduce((sum, p) => sum + (yOf.get(p) ?? 0), 0) / ps.length;
  };
  for (let r = 0; r <= maxRank; r++) {
    const spineNode = columns[r].find((h) => spineIds.has(h.id));
    const others = columns[r]
      .filter((h) => !spineIds.has(h.id))
      .sort((a, b) => barycentre(a) - barycentre(b) || a.id - b.id);
    const half = Math.round(others.length / 2);
    const ordered = spineNode ? [...others.slice(0, half), spineNode, ...others.slice(half)] : others;
    const centre = spineNode ? half : (ordered.length - 1) / 2;
    ordered.forEach((h, i) => yOf.set(h.id, (i - centre) * ROW_H));
  }

  habits.forEach((h) =>
    positions.set(String(h.id), { x: rankOf(h.id) * COL_W, y: (yOf.get(h.id) ?? 0) - NODE_H / 2 }),
  );
  positions.set("now", { x: -ANCHOR_GAP - ANCHOR_W, y: -NODE_H / 2 });
  positions.set("success", { x: maxRank * COL_W + NODE_W + ANCHOR_GAP, y: -NODE_H / 2 });
  return positions;
}

/* ------------------------------------------------------------------ */
/* Organic island outlines                                             */
/* ------------------------------------------------------------------ */

/**
 * A stable blob per habit: a squircle whose rim is pushed in and out by the
 * id, smoothed into one closed curve — the native cousin of the web map's
 * seeded border-radius.
 */
function blobPath(seed: number, w: number, h: number, inset = 2): string {
  const n = 12;
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - inset;
  const ry = h / 2 - inset;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const k = 0.9 + (((seed + 3) * (i * 13 + 7)) % 11) / 100;
    pts.push({
      x: cx + rx * k * Math.sign(cos) * Math.pow(Math.abs(cos), 0.6),
      y: cy + ry * k * Math.sign(sin) * Math.pow(Math.abs(sin), 0.6),
    });
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

function HabitIsland({
  habit,
  selected,
  at,
  onPress,
}: {
  habit: Habit;
  selected: boolean;
  at: Point;
  onPress: () => void;
}) {
  const { c, isDark } = useTheme();
  const locked = habit.status === "LOCKED";
  const valid = habit.status === "VALID";
  const risk = habitRisk(habit);
  const pct = habit.requiredStreak > 0 ? Math.min(1, habit.gauge / habit.requiredStreak) : 0;
  const d = useMemo(() => blobPath(habit.id, NODE_W, NODE_H), [habit.id]);

  const border = selected
    ? tw.amber[500]
    : locked
      ? c.lineStrong
      : risk === "critical"
        ? tw.rose[500]
        : risk === "caution"
          ? "rgba(5,150,105,0.4)"
          : valid
            ? "rgba(4,120,87,0.65)"
            : "rgba(146,64,14,0.5)";
  const fill = locked ? c.surfaceSunken : isDark ? "#2a2116" : tw.amber[50];
  const liquid =
    risk === "critical"
      ? "rgba(253,164,175,0.7)"
      : risk === "caution"
        ? "rgba(167,243,208,0.5)"
        : valid
          ? "rgba(110,231,183,0.6)"
          : "rgba(252,211,77,0.6)";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${habit.status.toLowerCase()}, gauge ${habit.gauge} of ${habit.requiredStreak}`}
      style={{ position: "absolute", left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <Svg width={NODE_W} height={NODE_H}>
        <Defs>
          <ClipPath id={`island-${habit.id}`}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <Path d={d} fill={fill} />
        {!locked && pct > 0 && (
          <Rect
            x={0}
            y={NODE_H * (1 - pct)}
            width={NODE_W}
            height={NODE_H * pct}
            fill={liquid}
            clipPath={`url(#island-${habit.id})`}
          />
        )}
        <Path d={d} fill="none" stroke={border} strokeWidth={selected || risk === "critical" ? 3 : 2} />
      </Svg>
      <View
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }}>
          {locked && <Lock size={13} color={c.inkSoft} />}
          {!locked && habit.habitType === "QUIT" && <Ban size={13} color={tw.red[500]} />}
          <Txt weight="700" numberOfLines={1} color={locked ? "soft" : "ink"} style={{ fontSize: 15, flexShrink: 1 }}>
            {habit.name}
          </Txt>
        </View>
        {locked ? (
          <Txt variant="small" color="faint">
            locked
          </Txt>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {risk ? (
              <AlertTriangle size={13} color={risk === "critical" ? tw.rose[600] : tw.amber[600]} />
            ) : (
              valid && <Check size={13} color={tw.emerald[600]} />
            )}
            <Zap size={12} color={tw.amber[600]} />
            <Txt variant="small" color="soft" tabular>
              {habit.gauge}/{habit.requiredStreak}
            </Txt>
            <Txt variant="small" color="faint">
              ·
            </Txt>
            <Flame size={12} color={tw.orange[500]} />
            <Txt variant="small" color="soft" tabular>
              {habit.currentStreak}
            </Txt>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function AnchorIsland({ label, at }: { label: "now" | "success"; at: Point }) {
  const { isDark } = useTheme();
  const d = useMemo(() => blobPath(label === "now" ? 5 : 9, ANCHOR_W, NODE_H), [label]);
  const Icon = label === "now" ? Footprints : Sparkles;
  return (
    <View style={{ position: "absolute", left: at.x, top: at.y, width: ANCHOR_W, height: NODE_H }}>
      <Svg width={ANCHOR_W} height={NODE_H}>
        <Path
          d={d}
          fill={isDark ? "rgba(251,191,36,0.15)" : tw.amber[100]}
          stroke="rgba(146,64,14,0.6)"
          strokeWidth={2}
        />
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Icon size={24} color={isDark ? tw.amber[300] : tw.amber[700]} />
        <Txt weight="700" color={isDark ? tw.amber[200] : tw.amber[900]}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The map                                                             */
/* ------------------------------------------------------------------ */

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.8;
/** Below this the island names stop being readable on a phone. */
const READABLE_SCALE = 0.55;

export function IslandMap({
  habits,
  selectedId,
  onSelect,
}: {
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit) => void;
}) {
  const { c } = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Positions depend only on the graph's shape, not on gauges or selection.
  const structure = habits
    .map((h) => `${h.id}>${[...h.prerequisiteIds].sort((a, b) => a - b).join(",")}`)
    .join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const raw = useMemo(() => computeLayout(habits), [structure]);

  // Shift everything so the content starts at (PAD, PAD).
  const { positions, width, height } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    raw.forEach((p, id) => {
      const w = id === "now" || id === "success" ? ANCHOR_W : NODE_W;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + w);
      maxY = Math.max(maxY, p.y + NODE_H);
    });
    const shifted = new Map<string, Point>();
    raw.forEach((p, id) => shifted.set(id, { x: p.x - minX + PAD, y: p.y - minY + PAD }));
    return { positions: shifted, width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };
  }, [raw]);

  const edges = useMemo(
    () =>
      habits.flatMap((habit) =>
        habit.prerequisiteIds.flatMap((prereqId) => {
          const from = positions.get(String(prereqId));
          const to = positions.get(String(habit.id));
          if (!from || !to) return [];
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mid = (x2 - x1) / 2;
          const flowing = habits.find((h) => h.id === prereqId)?.status === "VALID";
          return [
            {
              id: `${prereqId}-${habit.id}`,
              d: `M ${x1} ${y1} C ${x1 + mid} ${y1} ${x2 - mid} ${y2} ${x2} ${y2}`,
              flowing,
            },
          ];
        }),
      ),
    [habits, positions],
  );

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);

  /** Where the map opens: all of it if that stays readable, else the start. */
  function framing(w: number, h: number) {
    const fit = Math.min(w / width, h / height);
    if (fit >= READABLE_SCALE) {
      const s = Math.min(fit, 1);
      return { s, x: (w - width * s) / 2, y: (h - height * s) / 2 };
    }
    // Too big to read whole: open on "now" at a readable zoom, spine centred.
    const s = READABLE_SCALE;
    const spineY = (positions.get("now")?.y ?? 0) + NODE_H / 2;
    return { s, x: 8, y: h / 2 - spineY * s };
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (size && size.w === w && size.h === h) return;
    const f = framing(w, h);
    tx.value = f.x;
    ty.value = f.y;
    sc.value = f.s;
    setSize({ w, h });
  }

  function fitAll() {
    if (!size) return;
    const s = Math.max(MIN_SCALE, Math.min(1, Math.min(size.w / width, size.h / height)));
    tx.value = withTiming((size.w - width * s) / 2);
    ty.value = withTiming((size.h - height * s) / 2);
    sc.value = withTiming(s);
  }

  function zoomBy(factor: number) {
    if (!size) return;
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sc.value * factor));
    const ratio = next / sc.value;
    const fx = size.w / 2;
    const fy = size.h / 2;
    tx.value = withTiming(fx - (fx - tx.value) * ratio);
    ty.value = withTiming(fy - (fy - ty.value) * ratio);
    sc.value = withTiming(next);
  }

  const pan = Gesture.Pan()
    .minDistance(4)
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    });

  const pinch = Gesture.Pinch().onChange((e) => {
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sc.value * e.scaleChange));
    const ratio = next / sc.value;
    tx.value = e.focalX - (e.focalX - tx.value) * ratio;
    ty.value = e.focalY - (e.focalY - ty.value) * ratio;
    sc.value = next;
  });

  const transform = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={{
        flex: 1,
        minHeight: 360,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.lineStrong,
        backgroundColor: c.surfaceSunken,
        overflow: "hidden",
      }}
    >
      {/* the dotted chart paper — fixed, the islands drift over it */}
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse">
            <Circle cx={11} cy={11} r={1.2} fill={c.lineStrong} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>

      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <View style={{ flex: 1 }} collapsable={false}>
          {size && (
            <Animated.View
              style={[{ width, height, transformOrigin: "left top" }, transform]}
            >
              <Svg width={width} height={height} style={{ position: "absolute" }}>
                {edges.map((edge) => (
                  <Path
                    key={edge.id}
                    d={edge.d}
                    fill="none"
                    stroke={edge.flowing ? tw.amber[600] : tw.stone[400]}
                    strokeWidth={edge.flowing ? 2.5 : 1.8}
                    strokeDasharray={edge.flowing ? undefined : "6 6"}
                  />
                ))}
              </Svg>
              <AnchorIsland label="now" at={positions.get("now")!} />
              <AnchorIsland label="success" at={positions.get("success")!} />
              {habits.map((habit) => (
                <HabitIsland
                  key={habit.id}
                  habit={habit}
                  selected={habit.id === selectedId}
                  at={positions.get(String(habit.id))!}
                  onPress={() => onSelect(habit)}
                />
              ))}
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <View
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
          overflow: "hidden",
        }}
      >
        {[
          { label: "Zoom in", Icon: ZoomIn, run: () => zoomBy(1.3) },
          { label: "Zoom out", Icon: ZoomOut, run: () => zoomBy(1 / 1.3) },
          { label: "Show the whole map", Icon: Maximize2, run: fitAll },
        ].map(({ label, Icon, run }, i) => (
          <Pressable
            key={label}
            onPress={run}
            accessibilityLabel={label}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              alignItems: "center",
              justifyContent: "center",
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.line,
              backgroundColor: pressed ? c.surfaceSunken : "transparent",
            })}
          >
            <Icon size={18} color={c.inkSoft} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
