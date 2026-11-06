import { useCallback, useState } from "react";
import { usePerfFocus } from "@/lib/perf";
import { Alert, View } from "react-native";
import { List, Map as MapIcon, Plus } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dependentCount, type Habit, type HabitRequest } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { invalidate, keys, useHabits, useRefreshOnFocus } from "@/lib/queries";
import { queryClient } from "@/lib/queryClient";
import { usePersistentState } from "@/lib/usePersistentState";
import { ArchivedSection } from "@/components/ArchivedSection";
import { HabitDetails } from "@/components/HabitDetails";
import { HabitForm } from "@/components/HabitForm";
import { HabitList } from "@/components/HabitList";
import { IslandMap } from "@/components/IslandMap";
import { Banner } from "@/components/ui/Card";
import { Btn, IconBtn } from "@/components/ui/Button";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { SkeletonScreen } from "@/components/ui/Skeleton";
import { Txt } from "@/components/ui/Txt";

type View_ = "map" | "list";
type Mode = "closed" | "view" | "create" | "edit";

export default function RoadmapScreen() {
  usePerfFocus("roadmap");
  const { c } = useTheme();
  const { refreshUser } = useAuth();
  const habitsQuery = useHabits();
  useRefreshOnFocus(keys.habits);
  const habits = habitsQuery.data ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("closed");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = usePersistentState<View_>("roadmapView", "map");
  const [notice, setNotice] = useState<string | null>(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  const reload = () => habitsQuery.refetch();

  const selected = habits?.find((h) => h.id === selectedId) ?? null;

  async function createHabit(request: HabitRequest) {
    await api("/api/habits", { method: "POST", body: request });
    setMode("closed");
    // Habits feed the check-in and the plan too.
    await invalidate(keys.habits, keys.today);
  }

  async function updateHabit(request: HabitRequest) {
    if (!selected) return;
    await api(`/api/habits/${selected.id}`, { method: "PUT", body: request });
    setMode("view");
    await invalidate(keys.habits, keys.today);
  }

  function deleteHabit() {
    if (!selected) return;
    Alert.alert("Delete habit?", `"${selected.name}" and all its history will be gone for good.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/habits/${selected.id}`, { method: "DELETE" });
            setMode("closed");
            setSelectedId(null);
            await Promise.all([invalidate(keys.habits, keys.today), refreshUser()]);
          } catch (err) {
            setError(errorMessage(err));
          }
        },
      },
    ]);
  }

  /** Shows the list the server answers with, and refreshes what it feeds. */
  async function showHabits(data: Habit[]) {
    queryClient.setQueryData(keys.habits, data);
    // Archived habits leave the check-in and the plan picker too.
    await Promise.all([invalidate(keys.today), refreshUser()]);
  }

  /** Puts the selected habit away, along with everything that depends on it. */
  function archiveHabit() {
    if (!selected || !habits) return;
    const dependents = dependentCount(
      selected,
      habits.filter((h) => !h.archivedAt),
    );
    const branch =
      dependents === 0
        ? `"${selected.name}"`
        : `"${selected.name}" and the ${dependents} habit${dependents === 1 ? "" : "s"} that depend on it`;
    Alert.alert(
      "Archive habit?",
      `Archive ${branch}? They leave the map and the check-in, keep their progress, and come back whenever you restore them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: async () => {
            try {
              const data = await api<Habit[]>(`/api/habits/${selected.id}/archive`, { method: "POST" });
              setMode("closed");
              setError(null);
              setNotice(`Archived ${branch}. Find it under Archived to bring it back.`);
              await showHabits(data);
            } catch (err) {
              setMode("closed");
              setError(errorMessage(err, "Could not archive"));
            }
          },
        },
      ],
    );
  }

  async function restoreHabit(habit: Habit) {
    try {
      const data = await api<Habit[]>(`/api/habits/${habit.id}/restore`, { method: "POST" });
      const back = (habits ?? []).filter(
        (h) => h.archivedAt && !data.find((d) => d.id === h.id)?.archivedAt,
      ).length;
      setMode("closed");
      setError(null);
      setNotice(
        back > 1
          ? `"${habit.name}" and ${back - 1} more are back on your roadmap.`
          : `"${habit.name}" is back on your roadmap.`,
      );
      await showHabits(data);
    } catch (err) {
      // The server says why ("restore X first"): show it as is.
      setMode("closed");
      setError(errorMessage(err, "Could not restore"));
    }
  }

  if (!habits) {
    return habitsQuery.error ? (
      <Screen onRefresh={reload}>
        <Banner>{errorMessage(habitsQuery.error)}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen />
    );
  }

  // Archived habits keep their place in the data but leave the roadmap.
  const inUse = habits.filter((h) => !h.archivedAt);
  const hasArchived = inUse.length < habits.length;

  const openNew = () => {
    setSelectedId(null);
    setMode("create");
  };
  const open = (habit: Habit) => {
    setSelectedId(habit.id);
    setMode("view");
  };

  const header = (
    <ScreenHeader
      title="Your roadmap"
      subtitle="Validate habits to unlock the next ones on the path to success."
      actions={
        <IconBtn label="New habit" onPress={openNew} size={44} style={{ backgroundColor: c.accent }}>
          <Plus size={22} color="#fff" />
        </IconBtn>
      }
    />
  );

  const viewSwitch = inUse.length > 0 && (
    <Segmented
      size="sm"
      value={view}
      onChange={setView}
      options={[
        { value: "map", label: "Map", icon: <MapIcon size={14} color={view === "map" ? c.ink : c.inkSoft} /> },
        { value: "list", label: "List", icon: <List size={14} color={view === "list" ? c.ink : c.inkSoft} /> },
      ]}
    />
  );

  const sheets = (
    <>
      <Sheet open={mode === "create"} onClose={() => setMode("closed")} tall>
        <HabitForm allHabits={inUse} onSubmit={createHabit} onCancel={() => setMode("closed")} />
      </Sheet>
      <Sheet open={mode === "edit" && !!selected} onClose={() => setMode("view")} tall>
        {selected && (
          <HabitForm
            key={selected.id}
            // An archived habit keeps its archived prerequisites.
            allHabits={selected.archivedAt ? habits : inUse}
            initial={selected}
            onSubmit={updateHabit}
            onCancel={() => setMode("view")}
          />
        )}
      </Sheet>
      <Sheet open={mode === "view" && !!selected} onClose={() => setMode("closed")}>
        {selected && (
          <HabitDetails
            habit={selected}
            onEdit={() => setMode("edit")}
            onDelete={deleteHabit}
            onArchive={archiveHabit}
            onRestore={() => restoreHabit(selected)}
          />
        )}
      </Sheet>
      <Toast open={!!notice} onClose={closeNotice}>
        <Txt weight="600">{notice}</Txt>
      </Toast>
    </>
  );

  const archive = (listMaxHeight?: number) =>
    hasArchived && (
      <ArchivedSection
        habits={habits}
        selectedId={selected?.archivedAt ? selected.id : null}
        onSelect={open}
        onRestore={restoreHabit}
        listMaxHeight={listMaxHeight}
      />
    );

  if (inUse.length === 0) {
    return (
      <Screen onRefresh={reload} overlay={sheets}>
        {header}
        {error && <Banner>{error}</Banner>}
        <View
          style={{
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: c.lineStrong,
            borderRadius: 16,
            padding: 28,
            alignItems: "center",
            gap: 8,
          }}
        >
          <Txt color="soft" center>
            {hasArchived
              ? "Every habit is archived. Restore one below, or add a new one —"
              : "Your map is empty. Add your first basic habit —"}
          </Txt>
          <Txt variant="small" color="soft" center>
            start small: “5 prayers”, “make my bed”, “read 10 minutes”.
          </Txt>
          <Btn label="New habit" icon={<Plus size={16} color="#fff" />} onPress={openNew} style={{ marginTop: 6 }} />
        </View>
        {archive()}
      </Screen>
    );
  }

  // The map is a canvas of its own; it gets the screen without a scroll view.
  if (view === "map") {
    return (
      <Screen scroll={false} overlay={sheets}>
        {header}
        {error && <Banner>{error}</Banner>}
        {viewSwitch}
        <IslandMap
          habits={inUse}
          selectedId={selected?.archivedAt ? null : selectedId}
          onSelect={open}
          minHeight={hasArchived ? 220 : undefined}
        />
        {archive(220)}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload} overlay={sheets}>
      {header}
      {error && <Banner>{error}</Banner>}
      {viewSwitch}
      <HabitList habits={inUse} onSelect={open} />
      {archive()}
    </Screen>
  );
}
