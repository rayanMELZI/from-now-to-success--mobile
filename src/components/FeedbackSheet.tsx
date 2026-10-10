import { useState } from "react";
import { View } from "react-native";
import { Check, Clock, MessageSquarePlus } from "lucide-react-native";
import { api, errorMessage } from "@/lib/api";
import { tw, useTheme } from "@/lib/theme";
import { Banner } from "./ui/Card";
import { Btn } from "./ui/Button";
import { Field } from "./ui/Field";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";

const MAX_LEN = 2000;

interface SubmitResult {
  id: number;
  delivered: boolean;
  notificationsConfigured: boolean;
}

/** Straight to the developer — the same pipeline as the web app's button. */
export function FeedbackSheet({
  open,
  onClose,
  page,
}: {
  open: boolean;
  onClose: () => void;
  page: string;
}) {
  const { tone } = useTheme();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SubmitResult | null>(null);

  function close() {
    onClose();
    setTimeout(() => {
      setMessage("");
      setError(null);
      setSent(null);
    }, 250);
  }

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setSent(
        await api<SubmitResult>("/api/feedback", {
          method: "POST",
          body: { message: message.trim(), page: `mobile:${page}` },
        }),
      );
    } catch (err) {
      setError(errorMessage(err, "Couldn't send that — try again?"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} tall>
      {sent ? (
        <View style={{ alignItems: "center", paddingVertical: 8, gap: 6 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sent.delivered ? tone.success.bg : tone.warning.bg,
            }}
          >
            {sent.delivered ? (
              <Check size={24} color={tone.success.solid} />
            ) : (
              <Clock size={24} color={tone.warning.solid} />
            )}
          </View>
          <Txt variant="heading">{sent.delivered ? "Thanks!" : "Saved!"}</Txt>
          <Txt variant="small" color="soft" center>
            {sent.delivered
              ? "Your feedback reached the developer. Good ideas make it into the app."
              : "Your feedback is safely stored. It couldn't be forwarded to the developer just yet — it'll be retried automatically."}
          </Txt>
          <Btn label="Close" onPress={close} style={{ marginTop: 10, alignSelf: "stretch" }} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MessageSquarePlus size={19} color={tw.amber[600]} />
            <Txt variant="heading">Feedback & feature ideas</Txt>
          </View>
          <Txt variant="small" color="soft">
            Bug, rough edge, or a feature you wish existed — it goes straight to the developer.
          </Txt>
          {error && <Banner>{error}</Banner>}
          <Field
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, MAX_LEN))}
            multiline
            placeholder="I'd love it if…"
            style={{ minHeight: 130 }}
            autoFocus
          />
          <Txt variant="tiny" color="faint" style={{ textAlign: "right" }}>
            {message.length}/{MAX_LEN}
          </Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label={busy ? "Sending…" : "Send feedback"} onPress={submit} loading={busy} disabled={!message.trim()} flex />
            <Btn label="Cancel" variant="ghost" onPress={close} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
