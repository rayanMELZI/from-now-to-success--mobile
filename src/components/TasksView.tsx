import { Fragment, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { CircleCheckBig, Tag, Trash2 } from "lucide-react-native";
import { errorMessage } from "@/lib/api";
import { invalidate, keys, useRefreshOnFocus, useTaskList } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { usePersistentState } from "@/lib/usePersistentState";
import { TagChip, TagChooser, groupByTag, type CreateTag } from "./TagParts";
import { TagFilter, TagManager, type SortBy } from "./TagManager";
import { TaskEditor, TaskQuickAdd, TaskRow, taskActions, type TagOptions } from "./TaskParts";
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
  const [taggingId, setTaggingId] = useState<number | null>(null);
  const [filterId, setFilterId] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<SortBy>("tasks-sort", "date");
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
  // A filter on a tag that has since been deleted simply falls away.
  const filter = list.tags.find((t) => t.id === filterId) ?? null;
  const matches = (task: Task) => filter === null || task.tags.some((t) => t.id === filter.id);
  const open = list.open.filter(matches);
  const done = list.done.filter(matches);
  const groups =
    sortBy === "tag" && list.tags.length > 0 ? groupByTag(open, list.tags) : [{ tag: null, tasks: open }];
  const showHeads = groups.length > 1 || (sortBy === "tag" && groups[0]?.tag != null);
  // Read from the list, so the checklist follows each tick as it lands.
  const tagging = list.open.find((t) => t.id === taggingId) ?? null;

  const createTag: CreateTag = async (name, color) => {
    setError(null);
    const made = await taskActions.addTag(name, color);
    if (made.error) setError(made.error);
    return made.tag;
  };
  const tagOptions: TagOptions = {
    tags: list.tags,
    onCreate: createTag,
    error,
    onDismissError: () => setError(null),
  };
  // A sheet covers the screen's banner: it shows the error itself.
  const sheetOpen = editing !== null || tagging !== null || managing;

  return (
    <Screen
      onRefresh={reload}
      overlay={
        <>
          <Sheet open={editing !== null} onClose={() => setEditing(null)}>
            {editing && (
              <View style={{ gap: 12 }}>
                <TaskEditor
                  key={editing.id}
                  task={editing}
                  today={list.today}
                  tagOptions={tagOptions}
                  onCancel={() => setEditing(null)}
                  onDelete={() => remove(editing)}
                  onSave={async (title, dueDate, tagIds) => {
                    if (await run(taskActions.update(editing.id, title, dueDate, tagIds))) setEditing(null);
                  }}
                />
                {error && <Banner onClose={() => setError(null)}>{error}</Banner>}
              </View>
            )}
          </Sheet>
          <TagChooser
            open={tagging !== null}
            onClose={() => setTaggingId(null)}
            title={tagging ? `Tag “${tagging.title}”` : "Tags"}
            tags={list.tags}
            selected={tagging?.tags.map((t) => t.id) ?? []}
            onChange={(ids) => {
              if (tagging) void run(taskActions.setTags(tagging, ids));
            }}
            onCreate={createTag}
            error={error}
            onDismissError={() => setError(null)}
          />
          <Sheet open={managing} onClose={() => setManaging(false)} tall>
            <TagManager
              tags={list.tags}
              error={error}
              onDismissError={() => setError(null)}
              onCreate={createTag}
              onUpdate={(id, name, color) => run(taskActions.updateTag(id, name, color))}
              onRemove={(id) => run(taskActions.removeTag(id))}
              onClose={() => setManaging(false)}
            />
          </Sheet>
        </>
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

      {error && !sheetOpen && <Banner onClose={() => setError(null)}>{error}</Banner>}

      <Card>
        <TaskQuickAdd
          today={list.today}
          tagOptions={tagOptions}
          onAdd={(title, dueDate, tagIds) => run(taskActions.add(title, dueDate, tagIds))}
        />
      </Card>

      {list.tags.length > 0 && (
        <TagFilter
          tags={list.tags}
          value={filter?.id ?? null}
          onChange={setFilterId}
          sortBy={sortBy}
          onSort={setSortBy}
          onManage={() => setManaging(true)}
        />
      )}

      {open.length > 0 ? (
        <Card style={{ paddingVertical: 6 }}>
          {groups.map(({ tag, tasks }, groupIndex) => (
            <Fragment key={tag?.id ?? "none"}>
              {showHeads && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingTop: groupIndex === 0 ? 6 : 14,
                    paddingBottom: 2,
                  }}
                >
                  {tag ? <TagChip tag={tag} /> : <Txt variant="label">No tag</Txt>}
                  <Txt variant="tiny" weight="600" color="faint" tabular>
                    {tasks.length}
                  </Txt>
                </View>
              )}
              {tasks.map((task, index) => (
                <View key={task.id} style={index > 0 ? { borderTopWidth: 1, borderTopColor: c.line } : undefined}>
                  <TaskRow
                    task={task}
                    today={list.today}
                    onToggle={() => void run(taskActions.toggleDone(task))}
                    onPress={() => setEditing(task)}
                  >
                    <IconBtn label={`Tag ${task.title}`} onPress={() => setTaggingId(task.id)} size={34}>
                      <Tag size={15} color={c.inkFaint} />
                    </IconBtn>
                    <IconBtn label={`Delete ${task.title}`} onPress={() => remove(task)} size={34}>
                      <Trash2 size={15} color={c.inkFaint} />
                    </IconBtn>
                  </TaskRow>
                </View>
              ))}
            </Fragment>
          ))}
        </Card>
      ) : filter !== null && list.open.length > 0 ? (
        <Card style={{ alignItems: "center", padding: 22 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Txt variant="small" color="soft">
              Nothing open is tagged
            </Txt>
            <TagChip tag={filter} />
          </View>
        </Card>
      ) : (
        <Card style={{ alignItems: "center", gap: 8, padding: 22 }}>
          <CircleCheckBig size={28} color={tw.emerald[500]} />
          <Txt variant="small" color="soft" center>
            All clear. Add something above when it comes to mind.
          </Txt>
        </Card>
      )}

      {done.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          <Disclosure title="Finished" count={done.length} storageKey="tasks-finished">
            {done.map((task, index) => (
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
