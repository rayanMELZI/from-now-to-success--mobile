import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { usePersistentState } from "@/lib/usePersistentState";
import { useTheme } from "@/lib/theme";
import { Txt } from "./Txt";

/** A titled section that folds away, remembering whether it was open. */
export function Disclosure({
  title,
  count,
  summary,
  storageKey,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  summary?: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const [open, setOpen] = usePersistentState(`disclosure:${storageKey}`, defaultOpen);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
      >
        <ChevronRight
          size={16}
          color={c.inkSoft}
          style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
        />
        <Txt variant="label">{title}</Txt>
        {count !== undefined && (
          <View
            style={{
              backgroundColor: c.surfaceSunken,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 1,
            }}
          >
            <Txt variant="tiny" weight="600" color="soft" tabular>
              {count}
            </Txt>
          </View>
        )}
        {summary && !open ? (
          <Txt variant="tiny" color="faint" numberOfLines={1} style={{ flex: 1 }}>
            {summary}
          </Txt>
        ) : null}
      </Pressable>
      {open && <View style={{ marginTop: 4 }}>{children}</View>}
    </View>
  );
}
