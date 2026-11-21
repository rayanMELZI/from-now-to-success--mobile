package expo.modules.fntswidget

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/** Hands the widget's list its rows: one per line of today's plan. */
class PlanWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext)

  private class Factory(private val context: Context) : RemoteViewsFactory {
    private var plan: PlanWidget.State.Plan? = null

    override fun onCreate() {}

    override fun onDataSetChanged() {
      plan = PlanWidget.state(context) as? PlanWidget.State.Plan
    }

    override fun onDestroy() {
      plan = null
    }

    override fun getCount() = plan?.lines?.size ?: 0

    override fun getViewAt(position: Int): RemoteViews {
      val plan = plan
      val line = plan?.lines?.getOrNull(position)
        ?: return RemoteViews(context.packageName, R.layout.fnts_plan_widget_item)
      val current = position == plan.current

      // Colours live in the layouts, so the launcher picks light or dark.
      val layout = when {
        line.done -> R.layout.fnts_plan_widget_item_done
        current -> R.layout.fnts_plan_widget_item_current
        else -> R.layout.fnts_plan_widget_item
      }
      val dot = when {
        line.done -> R.drawable.fnts_widget_ic_done
        current -> R.drawable.fnts_widget_ic_now
        else -> R.drawable.fnts_widget_ic_todo
      }

      return RemoteViews(context.packageName, layout).apply {
        setTextViewText(R.id.fnts_item_time, PlanWidget.formatMinute(line.endMinute))
        setImageViewResource(R.id.fnts_item_dot, dot)
        setTextViewText(R.id.fnts_item_title, line.title)
        // The habit's name only when it says something the title does not.
        val habit = line.habit?.takeIf { !it.equals(line.title, ignoreCase = true) }
        setViewVisibility(R.id.fnts_item_habit, if (habit == null) View.GONE else View.VISIBLE)
        setTextViewText(R.id.fnts_item_habit, habit ?: "")
        // The template (set by PlanWidget.render) opens the plan.
        setOnClickFillInIntent(R.id.fnts_item_root, Intent())
      }
    }

    override fun getLoadingView(): RemoteViews? = null

    /** Plain, current and done rows use three layouts. */
    override fun getViewTypeCount() = 3

    override fun getItemId(position: Int) = position.toLong()

    override fun hasStableIds() = false
  }
}
