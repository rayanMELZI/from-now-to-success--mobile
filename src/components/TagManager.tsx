import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Settings2, Trash2, X } from "lucide-react-native";
import { MAX_TAGS, MAX_TAG_NAME, type TagColor, type TaskTag } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { TagColorSwatches, TagDot, nextTagColor, type CreateTag } from "./TagParts";
import { Banner } from "./ui/Card";
import { Btn, IconBtn } from "./ui/Button";
import { Field } from "./ui/Field";
import { Segmented } from "./ui/Segmented";
import { Txt } from "./ui/Txt";

export type SortBy = "date" | "tag";

/** One tag at a time narrows both lists; "All" lifts it. Then the sort and the tags sheet. */
export function TagFilter({
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
export function TagManager({
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
