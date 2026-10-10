import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

/**
 * A bottom sheet — what the web app's Modal already turned into on a phone.
 * Tapping the dimmed backdrop or the system back button closes it.
 */
export function Sheet({
  open,
  onClose,
  children,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Forms with a keyboard want the room; details sheets do not. */
  tall?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.fill}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <Animated.View
          entering={SlideInDown.duration(260)}
          style={[
            styles.panel,
            {
              backgroundColor: c.surface,
              borderColor: c.line,
              maxHeight: tall ? "94%" : "88%",
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.lineStrong }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 12) + 12,
            }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(12,10,9,0.5)" },
  panel: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 6,
  },
});
