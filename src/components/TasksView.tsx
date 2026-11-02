import { useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { CircleCheckBig, Trash2 } from "lucide-react-native";
import { errorMessage } from "@/lib/api";
import { invalidate, keys, useRefreshOnFocus, useTaskList } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { TaskEditor, TaskQuickAdd, TaskRow, taskActions } from "./TaskParts";
import { Banner, Card } from "./ui/Card";
import { Btn, IconBtn } from "./ui/Button";
import { Disclosure } from "./ui/Disclosure";
import { Screen, ScreenHeader } from "./ui/Screen";
import { Sheet } from "./ui/Sheet";
import { SkeletonScreen } from "./ui/Skeleton";
import { Txt } from "./ui/Txt";

/** The whole list: quick add, what is open, what is finished. */
export function TasksView() {
  const { c } = useTheme();
  const query = useTaskList();
  const list = query.data ?? null;
  useRefreshOnFocus(keys.tasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => invalidate(keys.tasks);

  /** Runs one change and says whether it went through. */
  async function run(action: Promise<string | null>): Promise<boolean> {
    setError(null);
    const failed = await action;
    if (failed) setError(failed);
    return failed === null;
  }

  function remove(task: Task) {
    Alert.alert("Delete this task?", task.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setEditing(null);
          void run(taskActions.remove(task.id));
        },
      },
    ]);
  }

  function clearDone() {
    Alert.alert("Clear finished tasks?", "They are removed for good.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => void run(taskActions.clearDone()) },
    ]);
  }

  if (!list) {
    return query.error ? (
      <Screen onRefresh={reload}>
        <Banner>{errorMessage(query.error, "Could not load your tasks")}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen cards={4} />
    );
  }

  const overdue = list.open.filter((t) => t.dueDate !== null && t.dueDate < list.today).length;

  return (
    <Screen
      onRefresh={reload}
      overlay={
        <Sheet open={editing !== null} onClose={() => setEditing(null)}>
          {editing && (
            <TaskEditor
              key={editing.id}
              task={editing}
              today={list.today}
              onCancel={() => setEditing(null)}
              onDelete={() => remove(editing)}
              onSave={async (title, dueDate) => {
                if (await run(taskActions.update(editing.id, title, dueDate))) setEditing(null);
              }}
            />
          )}
        </Sheet>
      }
    >
      <ScreenHeader
        title="Tasks"
        subtitle={
          list.open.length === 0
            ? "Nothing waiting on you."
            : `${list.open.length} to get done${overdue > 0 ? ` · ${overdue} overdue` : ""}`
        }
      />

      {error && <Banner onClose={() => setError(null)}>{error}</Banner>}

      <Card>
        <TaskQuickAdd today={list.today} onAdd={(title, dueDate) => run(taskActions.add(title, dueDate))} />
      </Card>

      {list.open.length > 0 ? (
        <Card style={{ paddingVertical: 6 }}>
          {list.open.map((task, index) => (
            <View key={task.id} style={index > 0 ? { borderTopWidth: 1, borderTopColor: c.line } : undefined}>
              <TaskRow
                task={task}
                today={list.today}
                onToggle={() => void run(taskActions.toggleDone(task))}
                onPress={() => setEditing(task)}
              >
                <IconBtn label={`Delete ${task.title}`} onPress={() => remove(task)} size={34}>
                  <Trash2 size={15} color={c.inkFaint} />
                </IconBtn>
              </TaskRow>
            </View>
          ))}
        </Card>
      ) : (
        <Card style={{ alignItems: "center", gap: 8, padding: 22 }}>
          <CircleCheckBig size={28} color={tw.emerald[500]} />
          <Txt variant="small" color="soft" center>
            All clear. Add something above when it comes to mind.
          </Txt>
        </Card>
      )}

      {list.done.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          <Disclosure title="Finished" count={list.done.length} storageKey="tasks-finished">
            {list.done.map((task, index) => (
              <View key={task.id} style={index > 0 ? { borderTopWidth: 1, borderTopColor: c.line } : undefined}>
                <TaskRow task={task} today={list.today} onToggle={() => void run(taskActions.toggleDone(task))}>
                  <IconBtn label={`Delete ${task.title}`} onPress={() => remove(task)} size={34}>
                    <Trash2 size={15} color={c.inkFaint} />
                  </IconBtn>
                </TaskRow>
              </View>
            ))}
            <Btn variant="ghost" size="sm" label="Clear finished tasks" onPress={clearDone} style={{ marginTop: 6, marginBottom: 8 }} />
          </Disclosure>
        </Card>
      )}
    </Screen>
  );
}

/** Reached with the setting off — explain, then point at the switch. */
export function TasksOff() {
  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 8, padding: 24, marginTop: 24 }}>
        <CircleCheckBig size={32} color={tw.amber[600]} />
        <Txt weight="600">Tasks are off</Txt>
        <Txt variant="small" color="soft" center>
          Turn them on to keep a list of one-off things to get done, and pull them straight into your daily plan.
        </Txt>
        <Btn label="Open settings" onPress={() => router.navigate("/settings")} style={{ marginTop: 6, alignSelf: "stretch" }} />
      </Card>
    </Screen>
  );
}
