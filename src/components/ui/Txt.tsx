import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/lib/theme";

type Variant = "title" | "heading" | "body" | "small" | "tiny" | "label";

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  tiny: { fontSize: 11.5 },
  // the uppercase captions over fields and stats
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
};

interface TxtProps extends TextProps {
  variant?: Variant;
  /** "soft" and "faint" are the secondary greys; any other string is a colour. */
  color?: "ink" | "soft" | "faint" | (string & {});
  weight?: TextStyle["fontWeight"];
  center?: boolean;
  tabular?: boolean;
  strike?: boolean;
}

export function Txt({
  variant = "body",
  color = "ink",
  weight,
  center,
  tabular,
  strike,
  style,
  ...rest
}: TxtProps) {
  const { c } = useTheme();
  const resolved =
    color === "ink"
      ? c.ink
      : color === "soft"
        ? c.inkSoft
        : color === "faint"
          ? variant === "label"
            ? c.inkSoft
            : c.inkFaint
          : color;

  return (
    <Text
      {...rest}
      style={[
        VARIANTS[variant],
        { color: variant === "label" && color === "ink" ? c.inkSoft : resolved },
        weight !== undefined && { fontWeight: weight },
        center && { textAlign: "center" },
        tabular && { fontVariant: ["tabular-nums"] },
        strike && { textDecorationLine: "line-through" },
        style,
      ]}
    />
  );
}
