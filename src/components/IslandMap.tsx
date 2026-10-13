import { useMemo, useState } from "react";
import { Platform, Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import {
  Canvas,
  ClipOp,
  Group,
  matchFont,
  PaintStyle,
  Picture,
  Points,
  Skia,
  vec,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPicture,
  type SkSVG,
} from "@shopify/react-native-skia";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react-native";
import { habitRisk, type Habit } from "@/lib/types";
import { tw, useTheme, type Palette } from "@/lib/theme";
import { MAP_ICONS, type MapIconName } from "./mapIcons";

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
/* Drawing — the whole map is recorded once into a Skia picture.       */
/* Panning and pinching only replay that picture under a new transform */
/* (reanimated shared values): no React render, no re-drawing of 80    */
/* islands and their icons on every frame.                             */
/* ------------------------------------------------------------------ */

const FONT_FAMILY = Platform.select({ ios: "Helvetica", default: "sans-serif" });

/** Shortens a label until it fits, ending it with an ellipsis. */
function fit(text: string, font: SkFont, maxWidth: number): string {
  if (font.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Lucide icons as Skia SVGs, parsed once per icon and colour for the app's lifetime. */
const iconCache = new Map<string, SkSVG | null>();
function mapIcon(name: MapIconName, color: string): SkSVG | null {
  const key = `${name}:${color}`;
  if (!iconCache.has(key)) {
    iconCache.set(key, Skia.SVG.MakeFromString(MAP_ICONS[name].replaceAll("currentColor", color)));
  }
  return iconCache.get(key) ?? null;
}

interface Fonts {
  title: SkFont;
  small: SkFont;
}

/** One piece of a centred row: an icon or a run of text. */
type RowItem = { icon: MapIconName; color: string; size: number } | { text: string; color: string };

function paintOf(color: string, stroke?: number): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  if (stroke !== undefined) {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(stroke);
  }
  return paint;
}

/** Draws an icon at (x, y) scaled from lucide's 24-unit grid to `size`. */
function drawIcon(canvas: SkCanvas, name: MapIconName, color: string, x: number, y: number, size: number) {
  const svg = mapIcon(name, color);
  if (!svg) return;
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(size / 24, size / 24);
  canvas.drawSvg(svg, 24, 24);
  canvas.restore();
}

/** Lays a row of icons and words out side by side, centred on `cx`, baseline `y`. */
function drawRow(canvas: SkCanvas, items: RowItem[], cx: number, y: number, font: SkFont) {
  const GAP = 4;
  const widths = items.map((it) => ("icon" in it ? it.size : font.measureText(it.text).width));
  const total = widths.reduce((a, b) => a + b, 0) + GAP * (items.length - 1);
  let x = cx - total / 2;
  items.forEach((it, i) => {
    if ("icon" in it) {
      // Icons sit on the text's baseline, centred on its x-height.
      drawIcon(canvas, it.icon, it.color, x, y - it.size * 0.85, it.size);
    } else {
      canvas.drawText(it.text, x, y, paintOf(it.color), font);
    }
    x += widths[i] + GAP;
  });
}

interface DrawInput {
  habits: Habit[];
  positions: Map<string, Point>;
  width: number;
  height: number;
  selectedId: number | null;
  fonts: Fonts;
  c: Palette;
  isDark: boolean;
}

function drawIsland(canvas: SkCanvas, habit: Habit, at: Point, selected: boolean, d: DrawInput) {
  const { c, isDark, fonts } = d;
  const locked = habit.status === "LOCKED";
  const valid = habit.status === "VALID";
  const risk = habitRisk(habit);
  const pct = habit.requiredStreak > 0 ? Math.min(1, habit.gauge / habit.requiredStreak) : 0;
  const blob = Skia.Path.MakeFromSVGString(blobPath(habit.id, NODE_W, NODE_H))!;

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

  canvas.save();
  canvas.translate(at.x, at.y);
  canvas.drawPath(blob, paintOf(fill));
  if (!locked && pct > 0) {
    canvas.save();
    canvas.clipPath(blob, ClipOp.Intersect, true);
    canvas.drawRect(Skia.XYWHRect(0, NODE_H * (1 - pct), NODE_W, NODE_H * pct), paintOf(liquid));
    canvas.restore();
  }
  canvas.drawPath(blob, paintOf(border, selected || risk === "critical" ? 3 : 2));

  const cx = NODE_W / 2;
  const lead: MapIconName | null = locked ? "lock" : habit.habitType === "QUIT" ? "ban" : null;
  const name = fit(habit.name, fonts.title, NODE_W - 36 - (lead ? 17 : 0));
  drawRow(
    canvas,
    [
      ...(lead ? [{ icon: lead, color: lead === "ban" ? tw.red[500] : c.inkSoft, size: 13 }] : []),
      { text: name, color: locked ? c.inkSoft : c.ink },
    ],
    cx,
    NODE_H / 2 - 3,
    fonts.title,
  );

  const stats: RowItem[] = locked
    ? [{ text: "locked", color: c.inkFaint }]
    : [
        ...(risk
          ? [{ icon: "alert" as const, color: risk === "critical" ? tw.rose[600] : tw.amber[600], size: 13 }]
          : valid
            ? [{ icon: "check" as const, color: tw.emerald[600], size: 13 }]
            : []),
        { icon: "zap", color: tw.amber[600], size: 12 },
        { text: `${habit.gauge}/${habit.requiredStreak}`, color: c.inkSoft },
        { text: "·", color: c.inkFaint },
        { icon: "flame", color: tw.orange[500], size: 12 },
        { text: String(habit.currentStreak), color: c.inkSoft },
      ];
  drawRow(canvas, stats, cx, NODE_H / 2 + 19, fonts.small);
  canvas.restore();
}

function drawAnchor(canvas: SkCanvas, label: "now" | "success", at: Point, d: DrawInput) {
  const { isDark, fonts } = d;
  const blob = Skia.Path.MakeFromSVGString(blobPath(label === "now" ? 5 : 9, ANCHOR_W, NODE_H))!;
  const color = isDark ? tw.amber[300] : tw.amber[700];
  const cx = ANCHOR_W / 2;
  canvas.save();
  canvas.translate(at.x, at.y);
  canvas.drawPath(blob, paintOf(isDark ? "rgba(251,191,36,0.15)" : tw.amber[100]));
  canvas.drawPath(blob, paintOf("rgba(146,64,14,0.6)", 2));
  drawIcon(canvas, label === "now" ? "footprints" : "sparkles", color, cx - 12, NODE_H / 2 - 30, 24);
  canvas.drawText(
    label,
    cx - fonts.title.measureText(label).width / 2,
    NODE_H / 2 + 18,
    paintOf(isDark ? tw.amber[200] : tw.amber[900]),
    fonts.title,
  );
  canvas.restore();
}

/** Records the whole map — paths, islands, labels, icons — into one picture. */
function drawMap(d: DrawInput): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, d.width, d.height));

  const flowing = paintOf(tw.amber[600], 2.5);
  const dashed = paintOf(tw.stone[400], 1.8);
  dashed.setPathEffect(Skia.PathEffect.MakeDash([6, 6], 0));
  const statusOf = new Map(d.habits.map((h) => [h.id, h.status]));
  for (const habit of d.habits) {
    const to = d.positions.get(String(habit.id));
    if (!to) continue;
    for (const prereqId of habit.prerequisiteIds) {
      const from = d.positions.get(String(prereqId));
      if (!from) continue;
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      const mid = (x2 - x1) / 2;
      const path = Skia.Path.Make();
      path.moveTo(x1, y1);
      path.cubicTo(x1 + mid, y1, x2 - mid, y2, x2, y2);
      canvas.drawPath(path, statusOf.get(prereqId) === "VALID" ? flowing : dashed);
    }
  }

  drawAnchor(canvas, "now", d.positions.get("now")!, d);
  drawAnchor(canvas, "success", d.positions.get("success")!, d);
  for (const habit of d.habits) {
    const at = d.positions.get(String(habit.id));
    if (at) drawIsland(canvas, habit, at, habit.id === d.selectedId, d);
  }
  return recorder.finishRecordingAsPicture();
}

/* ------------------------------------------------------------------ */
/* The map                                                             */
/* ------------------------------------------------------------------ */

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.8;
/** Below this the island names stop being readable on a phone. */
const READABLE_SCALE = 0.55;
const DOT_GAP = 22;

export function IslandMap({
  habits,
  selectedId,
  onSelect,
}: {
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit) => void;
}) {
  const { c, isDark } = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const fonts = useMemo<Fonts>(
    () => ({
      title: matchFont({ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: "700" }),
      small: matchFont({ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: "400" }),
    }),
    [],
  );

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

  // The whole map as one recorded picture, rebuilt only when the data changes.
  const picture = useMemo(
    () => drawMap({ habits, positions, width, height, selectedId, fonts, c, isDark }),
    [habits, positions, width, height, selectedId, fonts, c, isDark],
  );

  // The dotted chart paper, fixed under the moving islands.
  const dots = useMemo(() => {
    if (!size) return [];
    const points = [];
    for (let x = DOT_GAP / 2; x < size.w; x += DOT_GAP) {
      for (let y = DOT_GAP / 2; y < size.h; y += DOT_GAP) points.push(vec(x, y));
    }
    return points;
  }, [size]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);

  /** Where the map opens: all of it if that stays readable, else the start. */
  function framing(w: number, h: number) {
    const fitScale = Math.min(w / width, h / height);
    if (fitScale >= READABLE_SCALE) {
      const s = Math.min(fitScale, 1);
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

  /** A tap, in map coordinates: which island (if any) is under it. */
  function hitTest(x: number, y: number) {
    const hit = habits.find((habit) => {
      const p = positions.get(String(habit.id));
      return p && x >= p.x && x <= p.x + NODE_W && y >= p.y && y <= p.y + NODE_H;
    });
    if (hit) onSelect(hit);
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

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((e, success) => {
      if (!success) return;
      runOnJS(hitTest)((e.x - tx.value) / sc.value, (e.y - ty.value) / sc.value);
    });

  const transform = useDerivedValue(() => [
    { translateX: tx.value },
    { translateY: ty.value },
    { scale: sc.value },
  ]);

  return (
    <View
      onLayout={onLayout}
      accessibilityLabel={`Roadmap map with ${habits.length} habits. Switch to the list view to read them one by one.`}
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
      <GestureDetector gesture={Gesture.Race(Gesture.Simultaneous(pan, pinch), tap)}>
        <View style={{ flex: 1 }} collapsable={false}>
          {size && (
            <Canvas style={{ flex: 1 }}>
              <Points points={dots} mode="points" color={c.lineStrong} strokeWidth={2.4} strokeCap="round" />
              <Group transform={transform}>
                <Picture picture={picture} />
              </Group>
            </Canvas>
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
