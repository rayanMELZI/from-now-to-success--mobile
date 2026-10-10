import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/lib/api";
import { tw, useTheme } from "@/lib/theme";
import { Banner, Card } from "./ui/Card";
import { Btn } from "./ui/Button";
import { Field, Labeled } from "./ui/Field";
import { Txt } from "./ui/Txt";

/** Login and register are the same card with one field more or less. */
export function AuthForm({
  mode,
  onSubmit,
}: {
  mode: "login" | "register";
  onSubmit: (values: { username: string; email: string; password: string }) => Promise<void>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit() {
    if (!email.trim() || !password || (register && !username.trim())) {
      setError("Fill in every field first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ username: username.trim(), email: email.trim(), password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: c.page }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <Card style={{ padding: 24, gap: 16 }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 72, height: 72, alignSelf: "center" }} />
          <View style={{ gap: 4 }}>
            <Txt variant="title" center>
              fromNow<Txt variant="title" color={tw.amber[600]}>To</Txt>Success
            </Txt>
            <Txt variant="small" color="soft" center>
              {register ? "Start your roadmap from where you are now." : "Welcome back. Your roadmap is waiting."}
            </Txt>
          </View>

          {error && <Banner>{error}</Banner>}

          {register && (
            <Labeled label="Username">
              <Field value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="username" maxLength={50} />
            </Labeled>
          )}
          <Labeled label="Email">
            <Field
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </Labeled>
          <Labeled label="Password" hint={register ? "At least 8 characters." : undefined}>
            <Field
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={register ? "new-password" : "current-password"}
              textContentType={register ? "newPassword" : "password"}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </Labeled>

          <Btn
            label={busy ? (register ? "Creating your account…" : "Signing in…") : register ? "Create account" : "Sign in"}
            onPress={submit}
            loading={busy}
          />

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
            <Txt variant="small" color="soft">
              {register ? "Already have an account?" : "No account?"}
            </Txt>
            <Link href={register ? "/login" : "/register"} replace>
              <Txt variant="small" weight="600" color={tw.amber[700]}>
                {register ? "Sign in" : "Register"}
              </Txt>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
