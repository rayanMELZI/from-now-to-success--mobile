package expo.modules.fntswidget

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app's side of the widget: hand it today's plan, or take it back. */
class FntsWidgetModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FntsWidget")

    /** Today's plan as JSON (see src/lib/widget.ts); redraws the widgets at once. */
    Function("setPlan") { json: String ->
      PlanWidget.save(context, json)
      PlanWidget.refreshAll(context)
    }

    /** Signed out: the widget forgets the plan and asks to sign in. */
    Function("clear") {
      PlanWidget.save(context, null)
      PlanWidget.refreshAll(context)
    }
  }
}
