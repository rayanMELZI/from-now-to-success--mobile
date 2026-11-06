import { ScrollView, View } from "react-native";
import { Archive, ArchiveRestore, List, Map as MapIcon } from "lucide-react-native";
import { archivedBranches, type Habit } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { usePersistentState } from "@/lib/usePersistentState";
import { IslandMap } from "./IslandMap";
import { Btn } from "./ui/Button";
import { Card } from "./ui/Card";
import { Disclosure } from "./ui/Disclosure";
import { Segmented } from "./ui/Segmented";
import { Txt } from "./ui/Txt";

type View_ = "map" | "list";

/** The archive's map is a peek, shorter than the roadmap's. */
const MAP_HEIGHT = 260;

/**
 * What was put away, under the roadmap: a graph of the archived habits, or
 * one card per archived branch with its Restore button.
 */
export function ArchivedSection({
  habits,
  selectedId,
  onSelect,
  onRestore,
  listMaxHeight,
}: {
  /** Every habit, archived or not: a branch may wait on one still archived. */
  habits: Habit[];
  selectedId: number | null;
  onSelect: (habit: Habit) => void;
  onRestore: (habit: Habit) => void;
  /** Scrolls the list on its own when the screen around it does not scroll. */
  listMaxHeight?: number;
}) {
  const { c } = useTheme();
  // Its own switch, remembered apart from the roadmap's.
  const [view, setView] = usePersistentState<View_>("archivedView", "map");
  const archived = habits.filter((h) => h.archivedAt);
  if (archived.length === 0) return null;
  const branches = archivedBranches(habits);

  const list = (
    <View style={{ gap: 8 }}>
      {branches.map(({ root, members }) => {
        const waitingOn = habits.find((h) => h.archivedAt && root.prerequisiteIds.includes(h.id));
        return (
          <Card key={root.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt weight="600" numberOfLines={1} onPress={() => onSelect(root)}>
                {root.name}
              </Txt>
              <Txt variant="tiny" color="faint" numberOfLines={2}>
                {members.length > 0 ? `with ${members.map((m) => m.name).join(", ")}` : "on its own"}
                {waitingOn && ` · needs "${waitingOn.name}" back first`}
              </Txt>
            </View>
            <Btn
              label="Restore"
              variant="ghost"
              size="sm"
              icon={<ArchiveRestore size={14} color={waitingOn ? c.inkFaint : c.ink} />}
              disabled={!!waitingOn}
              onPress={() => onRestore(root)}
              accessibilityLabel={waitingOn ? `Restore "${waitingOn.name}" first` : `Restore "${root.name}"`}
            />
          </Card>
        );
      })}
    </View>
  );

  return (
    <Disclosure
      title="Archived"
      icon={<Archive size={14} color={c.inkFaint} />}
      count={archived.length}
      summary="put away for now, progress kept"
      storageKey="roadmap-archived"
    >
      <View style={{ gap: 10 }}>
        <View style={{ alignItems: "flex-end" }}>
          <Segmented
            size="sm"
            stretch={false}
            value={view}
            onChange={setView}
            options={[
              { value: "map", label: "Map", icon: <MapIcon size={14} color={view === "map" ? c.ink : c.inkSoft} /> },
              { value: "list", label: "List", icon: <List size={14} color={view === "list" ? c.ink : c.inkSoft} /> },
            ]}
          />
        </View>
        {view === "map" ? (
          <IslandMap
            habits={archived}
            selectedId={selectedId}
            onSelect={onSelect}
            bookends={false}
            height={MAP_HEIGHT}
          />
        ) : listMaxHeight ? (
          <ScrollView style={{ maxHeight: listMaxHeight }} nestedScrollEnabled>
            {list}
          </ScrollView>
        ) : (
          list
        )}
      </View>
    </Disclosure>
  );
}
