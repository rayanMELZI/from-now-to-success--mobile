import FntsWidget from "../../modules/fnts-widget";
import type { PlanDay } from "./types";

/**
 * The Android home-screen widget shows a copy of today's plan. It never
 * calls the server itself: the app hands it a fresh copy whenever the plan
 * changes, and the widget works out which line is "now" on its own.
 *
 * Nothing here depends on the query cache, so the sign-out path can clear
 * the widget without pulling the whole data layer in.
 */

/** Whether this build has a widget to keep in sync (Android release/dev builds). */
export const HAS_WIDGET = FntsWidget !== null;

/** What the widget reads — kept in step with PlanWidget.load (Kotlin). */
interface WidgetPlan {
  plannerEnabled: boolean;
  date: string;
  dayEndHour: number;
  blocks: { title: string; endMinute: number; done: boolean; habitName: string | null }[];
}

let lastSent: string | null = null;

function send(plan: WidgetPlan) {
  if (!FntsWidget) return;
  const json = JSON.stringify(plan);
  // Every cache write lands here; only an actual change redraws the widget.
  if (json === lastSent) return;
  lastSent = json;
  try {
    FntsWidget.setPlan(json);
  } catch {
    lastSent = null;
  }
}

/** Hands the widget today's plan. Any other day is ignored. */
export function pushPlanToWidget(day: PlanDay, dayEndHour: number) {
  if (day.date !== day.today) return;
  send({
    plannerEnabled: true,
    date: day.date,
    dayEndHour,
    blocks: day.blocks.map((b) => ({
      title: b.title,
      endMinute: b.endMinute,
      done: b.done,
      habitName: b.habitName,
    })),
  });
}

/** The planner was switched off: the widget says so instead of showing an old plan. */
export function pushPlannerOffToWidget(dayEndHour: number) {
  send({ plannerEnabled: false, date: "", dayEndHour, blocks: [] });
}

/** Signed out: the widget forgets the plan and asks to sign in. */
export function clearPlanWidget() {
  lastSent = null;
  try {
    FntsWidget?.clear();
  } catch {
    /* no widget module: nothing to clear */
  }
}
