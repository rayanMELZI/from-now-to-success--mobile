import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Field } from "./Field";
import { Sheet } from "./Sheet";
import { Txt } from "./Txt";

type Mode = "date" | "time" | "datetime";

const pad = (n: number) => String(n).padStart(2, "0");

function format(value: Date, mode: Mode): string {
  const date = value.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return mode === "date" ? date : mode === "time" ? time : `${date} · ${time}`;
}

/**
 * The phone's own date/time picker. Android opens it as dialogs (date, then
 * time for "datetime"); iOS shows its compact inline control.
 */
export function DateTimeInput({
  value,
  onChange,
  mode,
  minimumDate,
  maximumDate,
  accessibilityLabel,
  compact,
}: {
  value: Date;
  onChange: (value: Date) => void;
  mode: Mode;
  minimumDate?: Date;
  maximumDate?: Date;
  accessibilityLabel: string;
  compact?: boolean;
}) {
  const { c, isDark } = useTheme();

  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale="en-GB"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        themeVariant={isDark ? "dark" : "light"}
        accentColor={c.accent}
        onChange={(_, picked) => picked && onChange(picked)}
        style={{ alignSelf: "flex-start" }}
      />
    );
  }

  const open = () => {
    const first: "date" | "time" = mode === "time" ? "time" : "date";
    DateTimePickerAndroid.open({
      value,
      mode: first,
      is24Hour: true,
      minimumDate,
      maximumDate,
      onChange: (event, picked) => {
        if (event.type !== "set" || !picked) return;
        if (mode !== "datetime") {
          onChange(picked);
          return;
        }
        DateTimePickerAndroid.open({
          value: picked,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type !== "set" || !time) return;
            const merged = new Date(picked);
            merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(merged);
          },
        });
      },
    });
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        minHeight: compact ? 40 : 46,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.lineStrong,
        backgroundColor: pressed ? c.surfaceSunken : c.field,
        paddingHorizontal: 12,
        justifyContent: "center",
      })}
    >
      <Txt tabular weight="500">
        {format(value, mode)}
      </Txt>
    </Pressable>
  );
}

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * A select: shows the current choice, opens a sheet of options. Long lists
 * (timezones) get a search box.
 */
export function SelectField<T extends string | number>({
  value,
  options,
  onChange,
  title,
  searchable,
  icon,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  title: string;
  searchable?: boolean;
  icon?: ReactNode;
}) {
  const { c, tone } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? value}`}
        style={({ pressed }) => ({
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.lineStrong,
          backgroundColor: pressed ? c.surfaceSunken : c.field,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        })}
      >
        {icon}
        <Txt style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ?? String(value)}
        </Txt>
        <ChevronDown size={16} color={c.inkFaint} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)} tall={searchable}>
        <Txt variant="heading" style={{ marginBottom: 10 }}>
          {title}
        </Txt>
        {searchable && (
          <View style={{ marginBottom: 8 }}>
            <Field
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              autoCorrect={false}
              icon={<Search size={15} color={c.inkFaint} />}
            />
          </View>
        )}
        {shown.slice(0, 400).map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                setQuery("");
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: on ? tone.accent.bg : pressed ? c.surfaceSunken : "transparent",
              })}
            >
              <View style={{ flex: 1 }}>
                <Txt weight={on ? "600" : "400"} color={on ? tone.accent.text : "ink"}>
                  {option.label}
                </Txt>
                {option.hint ? (
                  <Txt variant="tiny" color="faint">
                    {option.hint}
                  </Txt>
                ) : null}
              </View>
              {on && <Check size={16} color={tone.accent.text} />}
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}
