import { usePerfFocus } from "@/lib/perf";
import { useUser } from "@/lib/auth";
import { TasksOff, TasksView } from "@/components/TasksView";

export default function TasksScreen() {
  usePerfFocus("tasks");
  const user = useUser();
  if (!user.tasksEnabled) return <TasksOff />;
  return <TasksView />;
}
