import { useState } from "react";
import { usePerfFocus } from "@/lib/perf";
import { Alert, View } from "react-native";
import { List, Map as MapIcon, Plus } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Habit, HabitRequest } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { invalidate, keys, useHabits, useRefreshOnFocus } from "@/lib/queries";
import { usePersistentState } from "@/lib/usePersistentState";
import { HabitDetails } from "@/components/HabitDetails";
import { HabitForm } from "@/components/HabitForm";
import { HabitList } from "@/components/HabitList";
import { IslandMap } from "@/components/IslandMap";
import { Banner } from "@/components/ui/Card";
import { Btn, IconBtn } from "@/components/ui/Button";
import { Screen, ScreenHeader } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
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

  if (!habits) {
    return habitsQuery.error ? (
      <Screen onRefresh={reload}>
        <Banner>{errorMessage(habitsQuery.error)}</Banner>
      </Screen>
    ) : (
      <SkeletonScreen />
    );
  }

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

  const viewSwitch = habits.length > 0 && (
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
        <HabitForm allHabits={habits} onSubmit={createHabit} onCancel={() => setMode("closed")} />
      </Sheet>
      <Sheet open={mode === "edit" && !!selected} onClose={() => setMode("view")} tall>
        {selected && (
          <HabitForm
            key={selected.id}
            allHabits={habits}
            initial={selected}
            onSubmit={updateHabit}
            onCancel={() => setMode("view")}
          />
        )}
      </Sheet>
      <Sheet open={mode === "view" && !!selected} onClose={() => setMode("closed")}>
        {selected && <HabitDetails habit={selected} onEdit={() => setMode("edit")} onDelete={deleteHabit} />}
      </Sheet>
    </>
  );

  if (habits.length === 0) {
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
            Your map is empty. Add your first basic habit —
          </Txt>
          <Txt variant="small" color="soft" center>
            start small: “5 prayers”, “make my bed”, “read 10 minutes”.
          </Txt>
          <Btn label="New habit" icon={<Plus size={16} color="#fff" />} onPress={openNew} style={{ marginTop: 6 }} />
        </View>
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
        <IslandMap habits={habits} selectedId={selectedId} onSelect={open} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload} overlay={sheets}>
      {header}
      {error && <Banner>{error}</Banner>}
      {viewSwitch}
      <HabitList habits={habits} onSelect={open} />
    </Screen>
  );
}
