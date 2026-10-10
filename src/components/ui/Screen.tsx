import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";
import { Txt } from "./Txt";

/**
 * A scrolling tab screen with pull-to-refresh. `overlay` is drawn above the
 * scroll view (toasts, floating bars) so it stays put while the list moves.
 */
export function Screen({
  children,
  onRefresh,
  overlay,
  contentStyle,
  scroll = true,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ padding: 16, paddingBottom: 96, gap: 14 }, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.accent}
            colors={[c.accent]}
            progressBackgroundColor={c.surface}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } catch {
                /* the screen shows its own error */
              } finally {
                setRefreshing(false);
              }
            }}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: 16, gap: 14 }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {body}
      {overlay}
    </View>
  );
}

/** Title, a line under it, and the screen's actions on the right. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="title">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" color="soft" style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actions ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{actions}</View> : null}
    </View>
  );
}
