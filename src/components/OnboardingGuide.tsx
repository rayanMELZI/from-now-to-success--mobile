import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import {
  Ban,
  Bell,
  Check,
  ListChecks,
  Lock,
  Map as MapIcon,
  MessageSquarePlus,
  Snowflake,
  Sprout,
  Zap,
} from "lucide-react-native";
import { loadJson, saveJson } from "@/lib/storage";
import { tw, useTheme } from "@/lib/theme";
import { Btn } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { Txt } from "./ui/Txt";
import { GaugeBar } from "./GaugeBar";

interface Step {
  icon: (color: string) => ReactNode;
  bg: [string, string];
  fg: [string, string];
  title: string;
  body: ReactNode;
}

const B = ({ children }: { children: ReactNode }) => <Txt weight="700" variant="small" color="ink">{children}</Txt>;

const steps: Step[] = [
  {
    icon: (c) => <MapIcon size={26} color={c} />,
    bg: [tw.amber[100], "rgba(251,191,36,0.15)"],
    fg: [tw.amber[700], tw.amber[300]],
    title: "Your habits, as a roadmap",
    body: (
      <Txt variant="small" color="soft" center>
        Every habit is a stop on the map from <B>now</B> to <B>success</B>. Start with a few basic habits — advanced
        ones stay locked until the habits they depend on are validated.
      </Txt>
    ),
  },
  {
    icon: (c) => <Zap size={26} color={c} />,
    bg: [tw.emerald[100], "rgba(52,211,153,0.15)"],
    fg: [tw.emerald[700], tw.emerald[300]],
    title: "The gauge is everything",
    body: (
      <View style={{ gap: 10, alignSelf: "stretch" }}>
        <Txt variant="small" color="soft" center>
          Each habit has a gauge. Doing it fills the gauge by one; missing it drains one. A{" "}
          <B>full gauge validates the habit</B> and unlocks whatever comes next — a couple of missed days won&apos;t
          undo it, but let it sink far enough and the habit gets demoted.
        </Txt>
        <GaugeBar gauge={4} max={6} valid={false} />
        <Txt variant="small" color="soft" center>
          The little tick is that demotion line. When a validated habit slips down onto it, it turns red everywhere in
          the app — that one needs you today.
        </Txt>
        <GaugeBar gauge={4} max={6} valid />
      </View>
    ),
  },
  {
    icon: (c) => <ListChecks size={26} color={c} />,
    bg: [tw.sky[100], "rgba(56,189,248,0.15)"],
    fg: [tw.sky[700], tw.sky[300]],
    title: "Check in the moment you know",
    body: (
      <Txt variant="small" color="soft" center>
        No need to wait for the end of the day — answer each habit as soon as you&apos;ve done it (or not). Habits can
        run <B>daily</B>, <B>weekly</B> or <B>monthly</B>, and you can set exactly how many times per period.
      </Txt>
    ),
  },
  {
    icon: (c) => <Snowflake size={26} color={c} />,
    bg: [tw.rose[100], "rgba(251,113,133,0.15)"],
    fg: [tw.rose[700], tw.rose[300]],
    title: "Misses, reasons & freezes",
    body: (
      <Txt variant="small" color="soft" center>
        A miss costs points — but writing a reason halves the loss. Out of control? Spend a <B>freeze</B> (3 per
        month, for daily and weekly habits) to protect your gauge and streak completely. Monthly habits get a single
        rare <B>Deep Freeze</B> every 3 months.
      </Txt>
    ),
  },
  {
    icon: (c) => <Sprout size={26} color={c} />,
    bg: [tw.lime[100], "rgba(190,242,100,0.15)"],
    fg: [tw.lime[700], tw.lime[300]],
    title: "Build good ones, quit bad ones",
    body: (
      <View style={{ gap: 8, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Sprout size={14} color={tw.emerald[600]} />
            <Txt variant="small" weight="600">Build</Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ban size={14} color={tw.red[500]} />
            <Txt variant="small" weight="600">Quit</Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Lock size={13} color={tw.stone[500]} />
            <Txt variant="small" weight="600">Locked</Txt>
          </View>
        </View>
        <Txt variant="small" color="soft" center>
          Build habits track something you want to start doing; quit habits track something you&apos;re avoiding.
          Link a habit to prerequisites and it stays locked until they&apos;re all validated.
        </Txt>
      </View>
    ),
  },
  {
    icon: (c) => <Bell size={26} color={c} />,
    bg: [tw.violet[100], "rgba(196,181,253,0.15)"],
    fg: [tw.violet[700], tw.violet[300]],
    title: "Make it yours",
    body: (
      <Txt variant="small" color="soft" center>
        Turn on reminders in Settings for a nudge on days you haven&apos;t checked in, pick when your day and week
        start, and switch to dark mode any time. You can replay this guide from Settings whenever you like.
      </Txt>
    ),
  },
  {
    icon: (c) => <MessageSquarePlus size={26} color={c} />,
    bg: [tw.amber[100], "rgba(251,191,36,0.15)"],
    fg: [tw.amber[700], tw.amber[300]],
    title: "Shape what comes next",
    body: (
      <Txt variant="small" color="soft" center>
        See the speech-bubble button in the top bar? Tap it any time to send an idea, a bug, or a feature you wish
        existed — it goes straight to the developer. This app grows from what its users ask for.
      </Txt>
    ),
  },
];

const OnboardingContext = createContext<{ show: () => void }>({ show: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);

/** Shows the tour once per account, and on demand from Settings. */
export function OnboardingProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const key = `fnts_guide_seen_${userId}`;
  const [open, setOpen] = useState(() => loadJson<boolean>(key) !== true);

  const close = useCallback(() => {
    setOpen(false);
    saveJson(key, true);
  }, [key]);

  const show = useCallback(() => setOpen(true), []);

  return (
    <OnboardingContext.Provider value={{ show }}>
      {children}
      <OnboardingGuide open={open} onClose={close} />
    </OnboardingContext.Provider>
  );
}

function OnboardingGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c, isDark } = useTheme();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const mode = isDark ? 1 : 0;

  function close() {
    setIndex(0);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close}>
      <View style={{ alignItems: "center", gap: 12, paddingTop: 6 }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: step.bg[mode],
          }}
        >
          {step.icon(step.fg[mode])}
        </View>
        <Txt variant="heading" center>
          {step.title}
        </Txt>
        {step.body}

        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          {steps.map((s, i) => (
            <View
              key={s.title}
              style={{
                height: 6,
                width: i === index ? 20 : 6,
                borderRadius: 3,
                backgroundColor: i === index ? tw.amber[500] : c.lineStrong,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch", marginTop: 6 }}>
          {!last && (
            <Pressable onPress={close} hitSlop={8} style={{ paddingHorizontal: 6, paddingVertical: 10 }}>
              <Txt variant="small" color="faint">
                Skip
              </Txt>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {index > 0 && <Btn label="Back" variant="ghost" onPress={() => setIndex(index - 1)} />}
          <Btn
            label={last ? "Get started" : "Next"}
            icon={last ? <Check size={15} color="#fff" /> : undefined}
            onPress={() => (last ? close() : setIndex(index + 1))}
          />
        </View>
      </View>
    </Sheet>
  );
}
