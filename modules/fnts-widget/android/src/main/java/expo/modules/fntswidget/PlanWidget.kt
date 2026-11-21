package expo.modules.fntswidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

/**
 * The "Daily plan" widget: what it knows, and how it draws it.
 *
 * The widget never talks to the server. The app hands it a copy of today's
 * plan every time that plan changes (see src/lib/widget.ts), and the widget
 * works out on its own which line is "now" — so it stays right as the day
 * goes by, and says so when its copy belongs to a day that is over.
 */
object PlanWidget {
  private const val PREFS = "fnts_widget"
  private const val KEY_PLAN = "plan"
  private const val DAY_MINUTES = 24 * 60

  const val URL_PLAN = "fnts://plan"
  const val URL_ADD = "fnts://plan?add=1"
  const val ACTION_TICK = "expo.modules.fntswidget.TICK"

  data class Line(val title: String, val endMinute: Int, val done: Boolean, val habit: String?)

  data class Snapshot(
    val plannerEnabled: Boolean,
    /** The user's logical day this copy is of, yyyy-MM-dd. */
    val date: String,
    /** The hour the user's day ends (and the next begins). */
    val dayEndHour: Int,
    val lines: List<Line>,
  )

  /** What the widget can show right now. */
  sealed class State {
    object SignedOut : State()
    object PlannerOff : State()
    /** The copy is of a day that has ended — the app has not been opened since. */
    object Stale : State()
    object Empty : State()
    data class Plan(val lines: List<Line>, val current: Int, val nowMinute: Int) : State()
  }

  // --- storage -------------------------------------------------------------

  fun save(context: Context, json: String?) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    if (json == null) prefs.remove(KEY_PLAN) else prefs.putString(KEY_PLAN, json)
    prefs.apply()
  }

  fun load(context: Context): Snapshot? {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PLAN, null) ?: return null
    return try {
      val obj = JSONObject(raw)
      val blocks = obj.optJSONArray("blocks")
      val lines = (0 until (blocks?.length() ?: 0)).map { i ->
        val b = blocks!!.getJSONObject(i)
        Line(
          title = b.optString("title"),
          endMinute = b.optInt("endMinute"),
          done = b.optBoolean("done"),
          habit = if (b.isNull("habitName")) null else b.optString("habitName").ifBlank { null },
        )
      }
      Snapshot(
        plannerEnabled = obj.optBoolean("plannerEnabled", true),
        date = obj.optString("date"),
        dayEndHour = obj.optInt("dayEndHour", 0),
        lines = lines,
      )
    } catch (_: Exception) {
      null
    }
  }

  // --- time ----------------------------------------------------------------

  private fun nowMinute(now: Calendar) = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

  /** Same as minuteOfUserDay in src/lib/types.ts: 01:00 sorts after 23:00 when the day ends at 04:00. */
  fun position(minute: Int, dayEndHour: Int) = Math.floorMod(minute - dayEndHour * 60, DAY_MINUTES)

  /** The user's logical today: before the hour their day ends, it is still yesterday. */
  private fun logicalToday(now: Calendar, dayEndHour: Int): String {
    val day = now.clone() as Calendar
    day.add(Calendar.HOUR_OF_DAY, -dayEndHour)
    return String.format(
      Locale.ROOT, "%04d-%02d-%02d",
      day.get(Calendar.YEAR), day.get(Calendar.MONTH) + 1, day.get(Calendar.DAY_OF_MONTH),
    )
  }

  fun formatMinute(minute: Int): String {
    val m = Math.floorMod(minute, DAY_MINUTES)
    return String.format(Locale.ROOT, "%02d:%02d", m / 60, m % 60)
  }

  fun state(context: Context, now: Calendar = Calendar.getInstance()): State {
    val snap = load(context) ?: return State.SignedOut
    if (!snap.plannerEnabled) return State.PlannerOff
    if (snap.date != logicalToday(now, snap.dayEndHour)) return State.Stale
    if (snap.lines.isEmpty()) return State.Empty
    val lines = snap.lines.sortedBy { position(it.endMinute, snap.dayEndHour) }
    val minute = nowMinute(now)
    val nowPos = position(minute, snap.dayEndHour)
    val current = lines.indexOfFirst { position(it.endMinute, snap.dayEndHour) > nowPos }
    return State.Plan(lines, current, minute)
  }

  // --- drawing -------------------------------------------------------------

  private fun ids(context: Context): IntArray =
    AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, PlanWidgetProvider::class.java))

  /** Redraws every placed widget and plans the next redraw. */
  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = ids(context)
    if (ids.isEmpty()) return
    for (id in ids) manager.updateAppWidget(id, render(context, id))
    @Suppress("DEPRECATION")
    manager.notifyAppWidgetViewDataChanged(ids, R.id.fnts_widget_list)
    scheduleTick(context)
  }

  fun render(context: Context, widgetId: Int): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.fnts_plan_widget)
    val state = state(context)

    // Tapping the widget opens the plan; the + opens it with a new line started.
    views.setOnClickPendingIntent(R.id.fnts_widget_root, openApp(context, URL_PLAN, 0))
    views.setOnClickPendingIntent(R.id.fnts_widget_header, openApp(context, URL_PLAN, 0))
    views.setOnClickPendingIntent(R.id.fnts_widget_add, openApp(context, URL_ADD, 1))

    // The list is filled by PlanWidgetService; a unique data URI per widget
    // keeps Android from handing two widgets the same adapter.
    val service = Intent(context, PlanWidgetService::class.java)
      .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
    service.data = Uri.parse(service.toUri(Intent.URI_INTENT_SCHEME))
    @Suppress("DEPRECATION")
    views.setRemoteAdapter(R.id.fnts_widget_list, service)
    views.setEmptyView(R.id.fnts_widget_list, R.id.fnts_widget_empty)
    views.setPendingIntentTemplate(R.id.fnts_widget_list, openApp(context, URL_PLAN, 2))

    val res = context.resources
    when (state) {
      is State.Plan -> {
        val done = state.lines.count { it.done }
        val total = state.lines.size
        views.setViewVisibility(R.id.fnts_widget_progress, View.VISIBLE)
        views.setProgressBar(R.id.fnts_widget_progress, total, done, false)
        val current = state.lines.getOrNull(state.current)
        views.setTextViewText(
          R.id.fnts_widget_subtitle,
          when {
            done == total -> res.getString(R.string.fnts_widget_all_done, total)
            current != null -> res.getString(R.string.fnts_widget_now, current.title, formatMinute(current.endMinute))
            else -> res.getString(R.string.fnts_widget_day_over, done, total)
          },
        )
        views.setTextViewText(R.id.fnts_widget_empty, "")
      }
      else -> {
        views.setViewVisibility(R.id.fnts_widget_progress, View.GONE)
        views.setTextViewText(R.id.fnts_widget_subtitle, "")
        views.setTextViewText(
          R.id.fnts_widget_empty,
          res.getString(
            when (state) {
              State.SignedOut -> R.string.fnts_widget_signed_out
              State.PlannerOff -> R.string.fnts_widget_planner_off
              State.Stale -> R.string.fnts_widget_stale
              else -> R.string.fnts_widget_empty
            },
          ),
        )
      }
    }
    return views
  }

  /**
   * Opens the app's own screen for a fnts:// link. The intent names the app's
   * launcher activity outright, so it reaches this app and no other.
   */
  private fun openApp(context: Context, url: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
      setPackage(context.packageName)
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.component?.let { component = it }
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return PendingIntent.getActivity(
      context, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // --- the clock -----------------------------------------------------------

  private fun tickIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context, 0,
      Intent(context, PlanWidgetProvider::class.java).setAction(ACTION_TICK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /**
   * Wakes the widget when "now" moves to the next line, or when the user's
   * day turns over. A plain RTC alarm: it waits for the phone to be awake,
   * which is the only time anyone looks at a home screen anyway.
   */
  fun scheduleTick(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val now = Calendar.getInstance()
    val snap = load(context)
    val dayEndHour = snap?.dayEndHour ?: 0
    val nowPos = position(nowMinute(now), dayEndHour)
    val next = (state(context, now) as? State.Plan)
      ?.let { plan -> plan.lines.getOrNull(plan.current) }
      ?.let { position(it.endMinute, dayEndHour) }
      ?: DAY_MINUTES
    val waitMinutes = (next - nowPos).coerceAtLeast(1)
    val at = Calendar.getInstance().apply {
      timeInMillis = now.timeInMillis
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      add(Calendar.MINUTE, waitMinutes)
    }
    alarms.set(AlarmManager.RTC, at.timeInMillis, tickIntent(context))
  }

  fun cancelTick(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    alarms.cancel(tickIntent(context))
  }
}
