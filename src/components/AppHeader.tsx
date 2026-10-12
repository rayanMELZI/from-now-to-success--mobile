import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudOff, MessageSquarePlus, Moon, Star, Sun } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/offline";
import { tw, useTheme } from "@/lib/theme";
import { Txt } from "./ui/Txt";

/**
 * The web app's top bar, shrunk for a phone: logo, feedback, the theme
 * switch and the point total — plus the offline strip under it.
 */
export function AppHeader({ onFeedback }: { onFeedback: () => void }) {
  const { c, tone, isDark, setPreference } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const online = useOnline();

  return (
    <View style={{ backgroundColor: c.surface, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: c.lineStrong }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 56 }}>
        <Image source={require("@/assets/images/logo.png")} style={{ width: 30, height: 30 }} />
        <Txt weight="700" style={{ fontSize: 16, letterSpacing: -0.2 }}>
          FN<Txt weight="700" color={tw.amber[600]} style={{ fontSize: 16 }}>T</Txt>S
        </Txt>
        <View style={{ flex: 1 }} />

        <Pressable
          onPress={onFeedback}
          accessibilityLabel="Send feedback"
          hitSlop={4}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.lineStrong,
            paddingHorizontal: 10,
            height: 34,
            backgroundColor: pressed ? c.surfaceSunken : "transparent",
          })}
        >
          <MessageSquarePlus size={15} color={c.inkSoft} />
          <Txt variant="tiny" weight="600" color="soft">
            Feedback
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => setPreference(isDark ? "light" : "dark")}
          accessibilityLabel="Toggle dark mode"
          hitSlop={4}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          {isDark ? <Sun size={18} color={c.inkSoft} /> : <Moon size={18} color={c.inkSoft} />}
        </Pressable>

        {profile && (
          <View
            accessibilityLabel={`${profile.totalPoints} points, level ${profile.level}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: tone.accent.bg,
              borderRadius: 999,
              paddingHorizontal: 10,
              height: 32,
            }}
          >
            <Star size={13} color={tone.accent.text} fill={tone.accent.text} />
            <Txt variant="small" weight="700" color={tone.accent.text} tabular>
              {profile.totalPoints}
            </Txt>
            <Txt variant="tiny" weight="600" color={tone.accent.text}>
              · Lv {profile.level}
            </Txt>
          </View>
        )}
      </View>

      {!online && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 6,
            backgroundColor: tone.warning.bg,
          }}
        >
          <CloudOff size={13} color={tone.warning.text} />
          <Txt variant="tiny" weight="600" color={tone.warning.text}>
            Offline — showing what this phone last saw
          </Txt>
        </View>
      )}

    </View>
  );
}
