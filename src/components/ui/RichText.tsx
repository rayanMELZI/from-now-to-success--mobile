import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextInputProps,
  type TextInputSelectionChangeEventData,
  type TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Bold, Italic, Palette, RemoveFormatting, Strikethrough, Underline, X } from "lucide-react-native";
import {
  diffText,
  isPlainStyle,
  parseRich,
  rangeHas,
  replaceRange,
  restyleRange,
  runsText,
  serializeRich,
  styleAt,
  type RichStyle,
  type Run,
  type ToggleKey,
} from "@/lib/richText";
import { TAG_COLORS, type TagColor } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { TAG_SHADES } from "../TagParts";
import { Field } from "./Field";
import { Txt } from "./Txt";

type TxtProps = React.ComponentProps<typeof Txt>;

/** The shade a coloured word is drawn in: the tag palette's text tones. */
function useRunColor() {
  const { isDark } = useTheme();
  return useCallback((color: TagColor) => (isDark ? TAG_SHADES[color].darkText : TAG_SHADES[color].text), [isDark]);
}

/** What one run looks like; `strike` keeps a done task's line through it. */
function runStyle(style: RichStyle, color: (c: TagColor) => string, strike = false): TextStyle {
  const lines = [style.underline && "underline", (style.strike || strike) && "line-through"].filter(Boolean);
  return {
    ...(style.bold && { fontWeight: "700" }),
    ...(style.italic && { fontStyle: "italic" }),
    ...(lines.length > 0 && { textDecorationLine: lines.join(" ") as TextStyle["textDecorationLine"] }),
    ...(style.color && { color: color(style.color) }),
  };
}

/** A formatted string, drawn with its bold, italics, lines and colours. */
export function RichText({ source, strike, ...rest }: TxtProps & { source: string }) {
  const color = useRunColor();
  const runs = useMemo(() => parseRich(source), [source]);
  return (
    <Txt strike={strike} {...rest}>
      {runs.map((run, i) =>
        isPlainStyle(run.style) ? (
          run.text
        ) : (
          <Text key={i} style={runStyle(run.style, color, strike)}>
            {run.text}
          </Text>
        ),
      )}
    </Txt>
  );
}

type Selection = { start: number; end: number };

const TOGGLES: { key: ToggleKey; label: string; Icon: typeof Bold }[] = [
  { key: "bold", label: "Bold", Icon: Bold },
  { key: "italic", label: "Italic", Icon: Italic },
  { key: "strike", label: "Strikethrough", Icon: Strikethrough },
  { key: "underline", label: "Underline", Icon: Underline },
];

/**
 * A text field whose words can be made bold, italic, struck, underlined or
 * coloured: select some text (or just place the cursor, for what comes next)
 * and tap a button of the bar shown under it while it has focus. The value
 * in and out is the stored markup string; `maxLength` caps that string.
 */
export function RichField({
  value,
  onChangeText,
  maxLength,
  onFocus,
  onBlur,
  ...rest
}: Omit<TextInputProps, "value" | "onChangeText" | "children" | "selection"> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { c } = useTheme();
  const color = useRunColor();
  const [runs, setRuns] = useState<Run[]>(() => parseRich(value));
  const [focused, setFocused] = useState(false);
  const [choosingColor, setChoosingColor] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  // Put back after a restyle, which redraws the text under the cursor.
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>();
  // A style picked with nothing selected: it applies to what is typed next, there.
  const [pending, setPending] = useState<{ at: number; style: RichStyle } | null>(null);
  const emitted = useRef(value);

  // A value set from outside (cleared after adding, say) replaces the text.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setRuns(parseRich(value));
      setPending(null);
    }
  }, [value]);

  const emit = (next: Run[]) => {
    setRuns(next);
    const out = serializeRich(next);
    emitted.current = out;
    onChangeText(out);
  };

  function handleText(next: string) {
    const prev = runsText(runs);
    if (next === prev) return;
    const { start, end, inserted } = diffText(prev, next);
    const style =
      pending && pending.at === start && start === end
        ? pending.style
        : start < end
          ? styleAt(runs, start)
          : start > 0
            ? styleAt(runs, start - 1)
            : styleAt(runs, 0);
    setPending(null);
    emit(replaceRange(runs, start, end, inserted, style));
  }

  function handleSelection(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) {
    const sel = e.nativeEvent.selection;
    setSelection(sel);
    setForcedSelection(undefined);
    if (pending && (sel.start !== sel.end || sel.start !== pending.at)) setPending(null);
  }

  const collapsed = selection.start === selection.end;
  const caretStyle = pending?.style ?? styleAt(runs, selection.start - 1);
  const isOn = (key: ToggleKey) =>
    collapsed ? !!caretStyle[key] : rangeHas(runs, selection.start, selection.end, key);
  const activeColor = collapsed ? caretStyle.color : styleAt(runs, selection.start).color;

  function restyle(patch: (style: RichStyle) => RichStyle) {
    void Haptics.selectionAsync().catch(() => {});
    if (collapsed) {
      setPending({ at: selection.start, style: patch(caretStyle) });
      return;
    }
    emit(restyleRange(runs, selection.start, selection.end, patch));
    setForcedSelection(selection);
  }

  const toggle = (key: ToggleKey) => {
    const on = !isOn(key);
    restyle((s) => ({ ...s, [key]: on }));
  };
  const paint = (next: TagColor | undefined) => {
    restyle((s) => ({ ...s, color: next }));
    setChoosingColor(false);
  };
  const clear = () => restyle(() => ({}));

  const stored = serializeRich(runs).length;
  const over = maxLength !== undefined && stored > maxLength;

  return (
    <View style={{ gap: 6 }}>
      <Field
        {...rest}
        // The words alone can never be longer than what is stored.
        maxLength={maxLength}
        selection={forcedSelection}
        onChangeText={handleText}
        onSelectionChange={handleSelection}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          setChoosingColor(false);
          onBlur?.(e);
        }}
      >
        {runs.map((run, i) => (
          <Text key={i} style={runStyle(run.style, color)}>
            {run.text}
          </Text>
        ))}
      </Field>
      {focused && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 4,
            padding: 4,
            borderRadius: 10,
            backgroundColor: c.surfaceSunken,
          }}
        >
          {choosingColor ? (
            <>
              <ToolButton label="Default colour" onPress={() => paint(undefined)} active={!activeColor}>
                <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.ink }} />
              </ToolButton>
              {TAG_COLORS.map((name) => (
                <ToolButton key={name} label={`Colour ${name}`} onPress={() => paint(name)} active={activeColor === name}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color(name) }} />
                </ToolButton>
              ))}
              <ToolButton label="Close colours" onPress={() => setChoosingColor(false)}>
                <X size={16} color={c.inkSoft} />
              </ToolButton>
            </>
          ) : (
            <>
              {TOGGLES.map(({ key, label, Icon }) => (
                <ToolButton key={key} label={label} onPress={() => toggle(key)} active={isOn(key)}>
                  <Icon size={16} color={isOn(key) ? c.accentInk : c.inkSoft} strokeWidth={isOn(key) ? 2.75 : 2} />
                </ToolButton>
              ))}
              <ToolButton label="Text colour" onPress={() => setChoosingColor(true)} active={!!activeColor}>
                <Palette size={16} color={activeColor ? color(activeColor) : c.inkSoft} />
              </ToolButton>
              <ToolButton label="Clear formatting" onPress={clear}>
                <RemoveFormatting size={16} color={c.inkSoft} />
              </ToolButton>
              <View style={{ flex: 1 }} />
              <Txt variant="tiny" color="faint" tabular style={{ paddingRight: 6 }}>
                {collapsed ? "Select text to format it" : `${selection.end - selection.start} selected`}
              </Txt>
            </>
          )}
        </View>
      )}
      {over && (
        <Txt variant="tiny" color="#e11d48">
          Too long with its formatting ({stored}/{maxLength}) — shorten it or remove some styles.
        </Txt>
      )}
    </View>
  );
}

/** One square button of the formatting bar, tinted while its style is on. */
function ToolButton({
  label,
  onPress,
  active = false,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? c.accentSoft : pressed ? c.line : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}
