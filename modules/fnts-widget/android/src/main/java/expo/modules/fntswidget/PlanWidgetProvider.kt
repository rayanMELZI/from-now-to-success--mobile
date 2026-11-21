package expo.modules.fntswidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

/** Android's entry point for the widget: placed, resized, ticked, removed. */
class PlanWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    PlanWidget.refreshAll(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      PlanWidget.ACTION_TICK, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED ->
        PlanWidget.refreshAll(context)
    }
  }

  /** The last one was taken off the home screen: nothing left to wake up. */
  override fun onDisabled(context: Context) {
    PlanWidget.cancelTick(context)
  }
}
