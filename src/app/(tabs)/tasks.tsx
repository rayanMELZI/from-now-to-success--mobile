import { Fragment, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { CircleCheckBig, Pencil, Settings2, Tag, Trash2, X } from "lucide-react-native";
import { errorMessage } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { usePerfFocus } from "@/lib/perf";
import { keys, useRefreshOnFocus, useTaskList } from "@/lib/queries";
import { groupByTag, nextTagColor, useTaskActions } from "@/lib/tasks";
import { MAX_TAGS, MAX_TAG_NAME, type TagColor, type Task, type TaskTag } from "@/lib/types";
import { tw, useTheme } from "@/lib/theme";
import { usePersistentState } from "@/lib/usePersistentState";
import { TagChip, TagChooser, TagColorSwatches, TagDot, TaskForm, TaskRow, type CreateTag } from "@/components/Tasks";
import { Banner, Card } from "@/components/ui/Card";
import { Btn, IconBtn } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Field } from "@/components/ui/Field";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonScreen } from "@/components/ui/Skeleton";
import { Txt } from "@/components/ui/Txt";

type SortBy = "date" | "tag";

export default function TasksScreen() {
  usePerfFocus("tasks");
  const user = useUser();
  if (!user.tasksEnabled) return <TasksOff />;
  return <Tasks />;
}

function Tasks() {
  const { c } = useTheme();
  const query = useTaskList(true);
  const list = query.data ?? null;
  useRefreshOnFocus(keys.tasks);
  const {
    error,
    setError,
    reload,
    add,
    update,
    remove,
    clearDone,
    toggleDone,
    setTags,
    addTag,
    updateTag,
    removeTag,
  } = useTaskActions();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [taggingId, setTaggingId] = useState<number | null>(null);
  const [filterId, setFilterId] = useState<number | null>(null);
  const [managing, setManaging] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<SortBy>("tasks-sort", "date");

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
  const editing = list.open.find((t) => t.id === editingId) ?? null;
  const tagging = list.open.find((t) => t.id === taggingId) ?? null;

  const confirmDelete = (task: Task) =>
    Alert.alert("Delete this task?", task.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove(task.id) },
    ]);

  const confirmClear = () =>
    Alert.alert("Clear finished tasks?", `${list.done.length} finished task${list.done.length === 1 ? "" : "s"} will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => void clearDone() },
    ]);

  const overlay = (
    <>
      <Sheet open={editing !== null} onClose={() => setEditingId(null)} tall>
        {editing && (
          <View style={{ gap: 12 }}>
            <Txt variant="heading">Edit task</Txt>
            <TaskForm
              key={editing.id}
              mode="edit"
              initial={editing}
              tags={list.tags}
              onCreateTag={addTag}
              error={error}
              onDismissError={() => setError(null)}
              onCancel={() => setEditingId(null)}
              onSubmit={async (title, dueDate, tagIds) => {
                const ok = await update(editing.id, title, dueDate, tagIds);
                if (ok) setEditingId(null);
                return ok;
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
        onChange={(ids) => tagging && void setTags(tagging, ids)}
        onCreate={addTag}
        error={error}
        onDismissError={() => setError(null)}
      />
      <Sheet open={managing} onClose={() => setManaging(false)} tall>
        <TagManager
          tags={list.tags}
          error={error}
          onDismissError={() => setError(null)}
          onCreate={addTag}
          onUpdate={updateTag}
          onRemove={removeTag}
          onClose={() => setManaging(false)}
        />
      </Sheet>
    </>
  );

  return (
    <Screen onRefresh={reload} overlay={overlay}>
      <ScreenHeader
        title="Tasks"
        subtitle={
          list.open.length === 0
            ? "Nothing waiting on you."
            : `${list.open.length} to get done${overdue > 0 ? ` · ${overdue} overdue` : ""}`
        }
      />

      {error && !editing && !tagging && !managing && <Banner onClose={() => setError(null)}>{error}</Banner>}

      <Card>
        <TaskForm mode="add" tags={list.tags} onCreateTag={addTag} onSubmit={add} error={error} onDismissError={() => setError(null)} />
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
        <Card style={{ paddingVertical: 4 }}>
          {groups.map(({ tag, tasks }, groupIndex) => (
            <Fragment key={tag?.id ?? "none"}>
              {showHeads && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingTop: groupIndex === 0 ? 8 : 14,
                    paddingBottom: 4,
                  }}
                >
                  {tag ? <TagChip tag={tag} /> : <Txt variant="label">No tag</Txt>}
                  <Txt variant="tiny" weight="600" color="faint" tabular>
                    {tasks.length}
                  </Txt>
                </View>
              )}
              {tasks.map((task, index) => (
                <View key={task.id} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
                  <TaskRow task={task} today={list.today} onToggle={() => void toggleDone(task)}>
                    <IconBtn label={`Tag ${task.title}`} onPress={() => setTaggingId(task.id)} size={36}>
                      <Tag size={17} color={c.inkSoft} />
                    </IconBtn>
                    <IconBtn label={`Edit ${task.title}`} onPress={() => setEditingId(task.id)} size={36}>
                      <Pencil size={16} color={c.inkSoft} />
                    </IconBtn>
                    <IconBtn label={`Delete ${task.title}`} onPress={() => confirmDelete(task)} size={36}>
                      <Trash2 size={16} color={c.inkSoft} />
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
        <Disclosure title="Finished" count={done.length} storageKey="tasks-finished">
          <Card style={{ paddingVertical: 4 }}>
            {done.map((task, index) => (
              <View key={task.id} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
                <TaskRow task={task} today={list.today} onToggle={() => void toggleDone(task)}>
                  <IconBtn label={`Delete ${task.title}`} onPress={() => confirmDelete(task)} size={36}>
                    <Trash2 size={16} color={c.inkSoft} />
                  </IconBtn>
                </TaskRow>
              </View>
            ))}
            <Btn size="sm" variant="plain" label="Clear finished tasks" onPress={confirmClear} style={{ marginVertical: 4 }} />
          </Card>
        </Disclosure>
      )}
    </Screen>
  );
}

/** One tag at a time narrows both lists; "All" lifts it. Then the sort and the tags sheet. */
function TagFilter({
  tags,
  value,
  onChange,
  sortBy,
  onSort,
  onManage,
}: {
  tags: TaskTag[];
  value: number | null;
  onChange: (id: number | null) => void;
  sortBy: SortBy;
  onSort: (sortBy: SortBy) => void;
  onManage: () => void;
}) {
  const { c } = useTheme();
  const chip = (key: string, active: boolean, label: string, onPress: () => void, dot?: TagColor) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        maxWidth: 180,
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? c.ink : c.surfaceSunken,
        borderWidth: 1,
        borderColor: active ? c.ink : c.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {dot && <TagDot color={dot} size={8} />}
      <Txt variant="small" weight="600" color={active ? c.surface : c.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter by tag"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 6, paddingRight: 8 }}
        >
          {chip("all", value === null, "All", () => onChange(null))}
          {tags.map((tag) =>
            chip(String(tag.id), value === tag.id, tag.name, () => onChange(value === tag.id ? null : tag.id), tag.color),
          )}
        </ScrollView>
        <IconBtn label="Edit tags" onPress={onManage} size={36}>
          <Settings2 size={18} color={c.inkSoft} />
        </IconBtn>
      </View>
      <Segmented
        size="sm"
        value={sortBy}
        onChange={onSort}
        options={[
          { value: "date", label: "By date", accessibilityLabel: "By date: deadlines first" },
          { value: "tag", label: "By tag", accessibilityLabel: "By tag: grouped under their tags" },
        ]}
      />
    </View>
  );
}

/** Rename, recolour, delete or add tags; each change is saved as it is made. */
function TagManager({
  tags,
  error,
  onDismissError,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}: {
  tags: TaskTag[];
  error: string | null;
  onDismissError: () => void;
  onCreate: CreateTag;
  onUpdate: (id: number, name: string, color: TagColor) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Txt variant="heading" style={{ flex: 1 }}>
          Tags
        </Txt>
        <IconBtn label="Close" onPress={onClose} size={36}>
          <X size={18} color={c.inkSoft} />
        </IconBtn>
      </View>
      {error && <Banner onClose={onDismissError}>{error}</Banner>}
      {tags.length === 0 ? (
        <Txt variant="small" color="soft">
          No tags yet.
        </Txt>
      ) : (
        tags.map((tag, index) => (
          <View key={tag.id} style={{ paddingTop: index === 0 ? 0 : 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
            <TagEditorRow tag={tag} onUpdate={onUpdate} onRemove={onRemove} />
          </View>
        ))
      )}
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
        <NewTagForm tags={tags} onCreate={onCreate} />
      </View>
      <Txt variant="tiny" color="faint">
        Renaming or recolouring a tag changes it on every task; deleting it takes it off them.
      </Txt>
    </View>
  );
}

/** Name and colour for a new tag, made from the tags sheet. */
function NewTagForm({ tags, onCreate }: { tags: TaskTag[]; onCreate: CreateTag }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>(() => nextTagColor(tags));
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const tag = await onCreate(trimmed, color);
    setBusy(false);
    if (!tag) return;
    setName("");
    setColor(nextTagColor([...tags, tag]));
  }

  if (tags.length >= MAX_TAGS) {
    return (
      <Txt variant="tiny" color="faint">
        {MAX_TAGS} tags at most.
      </Txt>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Field
          value={name}
          onChangeText={setName}
          maxLength={MAX_TAG_NAME}
          placeholder="New tag"
          accessibilityLabel="New tag name"
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void create()}
          style={{ flex: 1 }}
        />
        <Btn label="Add" onPress={() => void create()} disabled={!name.trim()} loading={busy} />
      </View>
      <TagColorSwatches value={color} onChange={setColor} />
    </View>
  );
}

function TagEditorRow({
  tag,
  onUpdate,
  onRemove,
}: {
  tag: TaskTag;
  onUpdate: (id: number, name: string, color: TagColor) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
}) {
  const { c } = useTheme();
  const [name, setName] = useState(tag.name);
  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(tag.name);
    else if (trimmed !== tag.name) void onUpdate(tag.id, trimmed, tag.color);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TagDot color={tag.color} size={12} />
        <Field
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          maxLength={MAX_TAG_NAME}
          returnKeyType="done"
          accessibilityLabel={`Name of the ${tag.name} tag`}
          style={{ flex: 1 }}
        />
        <IconBtn
          label={`Delete the ${tag.name} tag`}
          onPress={() =>
            Alert.alert(`Delete the “${tag.name}” tag?`, "Tasks keep everything else.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => void onRemove(tag.id) },
            ])
          }
          size={36}
        >
          <Trash2 size={16} color={c.inkSoft} />
        </IconBtn>
      </View>
      <TagColorSwatches
        value={tag.color}
        onChange={(color) => {
          if (color !== tag.color) void onUpdate(tag.id, name.trim() || tag.name, color);
        }}
      />
    </View>
  );
}

/** Reached with the setting off — explain, then point at the switch. */
function TasksOff() {
  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 8, padding: 24, marginTop: 24 }}>
        <CircleCheckBig size={32} color={tw.amber[600]} />
        <Txt weight="600">Tasks are off</Txt>
        <Txt variant="small" color="soft" center>
          Turn them on to keep a list of one-off things to get done.
        </Txt>
        <Btn label="Open settings" onPress={() => router.navigate("/settings")} style={{ marginTop: 6, alignSelf: "stretch" }} />
      </Card>
    </Screen>
  );
}
