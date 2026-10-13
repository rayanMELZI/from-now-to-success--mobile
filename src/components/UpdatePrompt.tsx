import { useEffect, useState } from "react";
import { AppState, InteractionManager, View } from "react-native";
import { Download, Sparkles } from "lucide-react-native";
import {
  CURRENT_VERSION,
  UPDATES_SUPPORTED,
  autoUpdateEnabled,
  checkForUpdate,
  autoInstallUpdate,
  installUpdate,
  useUpdateState,
} from "@/lib/updater";
import { tw, useTheme } from "@/lib/theme";
import { Btn } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";

/**
 * Checks GitHub on launch and whenever the app comes back to the foreground.
 * With automatic updates on (the default) a new version installs straight
 * away; otherwise a sheet offers it, once per version per session.
 */
export function UpdatePrompt() {
  const { tone } = useTheme();
  const update = useUpdateState();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [auto, setAuto] = useState(autoUpdateEnabled);

  useEffect(() => {
    if (!UPDATES_SUPPORTED) return;
    const run = async () => {
      const autoOn = autoUpdateEnabled();
      setAuto(autoOn);
      const release = await checkForUpdate();
      if (release && autoOn) void autoInstallUpdate();
    };
    // Never ahead of the first screen: the check waits until it is drawn.
    const task = InteractionManager.runAfterInteractions(() => void run());
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void run();
    });
    return () => {
      task.cancel();
      sub.remove();
    };
  }, []);

  if (!UPDATES_SUPPORTED || !update.latest) return null;
  const busy = update.phase === "downloading" || update.phase === "installing" || update.phase === "waiting";

  // Automatic: a slim progress strip while it downloads.
  if (auto && busy) {
    return (
      <View
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 70,
          zIndex: 60,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          backgroundColor: tone.accent.bg,
          borderWidth: 1,
          borderColor: tone.accent.border,
        }}
      >
        <Download size={15} color={tone.accent.text} />
        <Txt variant="small" weight="600" color={tone.accent.text} style={{ flex: 1 }}>
          {update.phase === "downloading"
            ? `Updating to v${update.latest.version}… ${Math.round(update.progress * 100)}%`
            : update.phase === "waiting"
              ? "Confirm the update in Android's dialog"
              : "Installing the update…"}
        </Txt>
      </View>
    );
  }

  const open = !auto || update.phase === "failed";
  return (
    <Sheet open={open && dismissed !== update.latest.version} onClose={() => setDismissed(update.latest!.version)}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Sparkles size={20} color={tw.amber[500]} />
          <Txt variant="heading">Version {update.latest.version} is out</Txt>
        </View>
        <Txt variant="small" color="soft">
          You have {CURRENT_VERSION}. The update keeps all your data — it lives on the server. The first
          time, Android asks you to allow updates from this app.
        </Txt>
        {update.latest.notes ? (
          <Txt variant="small" numberOfLines={12}>
            {update.latest.notes}
          </Txt>
        ) : null}
        {update.error && (
          <Txt variant="small" color={tone.danger.text}>
            {update.error}
          </Txt>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn
            label={
              update.phase === "downloading"
                ? `Downloading… ${Math.round(update.progress * 100)}%`
                : update.phase === "installing" || update.phase === "waiting"
                  ? "Installing…"
                  : "Update now"
            }
            icon={<Download size={15} color="#fff" />}
            onPress={() => void installUpdate()}
            loading={update.phase === "installing"}
            disabled={busy}
            flex
          />
          <Btn label="Later" variant="ghost" onPress={() => setDismissed(update.latest!.version)} />
        </View>
      </View>
    </Sheet>
  );
}
