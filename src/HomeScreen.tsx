import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { colors, radii } from "./theme";
import { getCurrentUser, launchScenario, getRoadmap, completeRoadmapStop } from "./api";
import { TranslateGameScreen } from "./TranslateGameScreen";
import { GuidedGamesScreen } from "./GuidedGamesScreen";

type Props = {
  user: User;
  onOpenConversation: (sessionId: string) => void;
};

type TabKey = "home" | "scenarios" | "games";
type StopKind = "done" | "checkpoint" | "current" | "locked";

type RoadmapStop = {
  id: string;
  kind: StopKind;
  title: string;
  he: string;
  fmt: string;
};

type ThemeItem = {
  id: string;
  title: string;
  he: string;
  heChar: string;
  band: string;
  blurb: string;
  palette: {
    warm: string;
    deep: string;
    tint: string;
  };
  locked?: boolean;
  cts: Array<{
    id: string;
    title: string;
    variations: Array<{
      id: string;
      label: string;
      situation: string;
    }>;
  }>;
};

type DetailState =
  | {
      kind: "roadmap";
      title: string;
      eyebrow: string;
      body: string;
      action: string;
    }
  | {
      kind: "game";
      title: string;
      eyebrow: string;
      body: string;
      action: string;
    };

const PATH_OFFSETS = [0, 30, 50, 20];

const ROADMAP_STOPS: RoadmapStop[] = [
  { id: "s1", kind: "current", title: "Falafel Stand", he: "דּוּכַן פָּלָאפֶל", fmt: "Roleplay" },
  { id: "s2", kind: "locked", title: "Greeting a Neighbor", he: "שָׁכֵן", fmt: "Roleplay" },
  { id: "s3", kind: "locked", title: "Numbers, 1–20", he: "מִסְפָּרִים", fmt: "Drill" },
  { id: "cp1", kind: "checkpoint", title: "Checkpoint", he: "מִבְחָן", fmt: "Pick a format" },
  { id: "s4", kind: "locked", title: "At the Supermarket", he: "בַּסּוּפֶּר", fmt: "Roleplay" },
  { id: "s5", kind: "locked", title: "Asking for Help", he: "מְבַקֵּשׁ עֶזְרָה", fmt: "Roleplay" },
  { id: "s6", kind: "locked", title: "Café Order", he: "בְּבֵית קָפֶה", fmt: "Roleplay" },
  { id: "tl1", kind: "locked", title: "Past Tense, men.", he: "עָבָר", fmt: "Tutor" },
  { id: "cp2", kind: "locked", title: "Checkpoint", he: "מִבְחָן", fmt: "Pick a format" }
];

const THEMES: ThemeItem[] = [
  {
    id: "supermarket",
    title: "Supermarket",
    he: "בַּסּוּפֶּר",
    heChar: "ס",
    band: "A2–B1",
    blurb: "Bright lights, plastic bags, and the strange social music of buying tomatoes.",
    palette: { warm: "#E8B4A0", deep: "#B8462C", tint: "rgba(184,70,44,0.10)" },
    cts: [
      {
        id: "big-salad",
        title: "Big salad for dinner",
        variations: [
          { id: "calm-tuesday", label: "Calm Tuesday", situation: "A quiet Tuesday evening. The produce section is well-stocked and the staff have time to chat." },
          { id: "friday-rush", label: "Friday rush", situation: "Friday afternoon before Shabbat. The produce section is picked-over and busy; some common items are sold out." },
          { id: "chatty-elder", label: "Chatty shopper", situation: "Mid-morning. An elderly woman ahead of the learner is chatting at length with the produce worker about today's tomatoes. The learner is patient — no rush." },
          { id: "rainy-sunday", label: "Rainy Sunday", situation: "A rainy Sunday. The store is unusually quiet and the produce worker is restocking, happy to chat about what looks good today." }
        ]
      }
    ]
  },
  {
    id: "cafe",
    title: "Café",
    he: "בֵּית קָפֶה",
    heChar: "ק",
    band: "A1–A2",
    blurb: "Slow mornings, oat milk, and the espresso machine doing its theatrical hiss.",
    palette: { warm: "#D9A35E", deep: "#8E5C28", tint: "rgba(217,163,94,0.14)" },
    cts: [
      {
        id: "order",
        title: "Ordering a drink + pastry",
        variations: [
          { id: "menu-overhead", label: "Menu only overhead", situation: "The menu is overhead on a chalkboard. The learner has to read fast or ask." },
          { id: "sold-out", label: "The croissants are out", situation: "The croissants are gone. Yossi suggests alternatives." },
          { id: "free-pour", label: "Barista's choice", situation: "Yossi suggests today's special — a single-origin pour-over." }
        ]
      }
    ]
  },
  {
    id: "shuk",
    title: "Friday market",
    he: "הַשּׁוּק",
    heChar: "ש",
    band: "B1",
    blurb: "Voices yelling, oranges piled high, three kinds of olives, and a man selling halva on a wager.",
    palette: { warm: "#C9B68A", deep: "#6B7A45", tint: "rgba(107,122,69,0.12)" },
    cts: [
      {
        id: "haggle",
        title: "Haggling at the spice stall",
        variations: [
          { id: "classic-game", label: "Classic dance", situation: "Friendly back-and-forth. The vendor enjoys the negotiation." },
          { id: "firm", label: "Firm vendor", situation: "Today's prices are tight. Small movement possible only." },
          { id: "fish-out-water", label: "Tourist tax", situation: "The vendor assumes tourist and prices accordingly. The learner has to push back." }
        ]
      }
    ]
  },
  {
    id: "ministry",
    title: "Interior Ministry",
    he: "מִשְׂרַד הַפְּנִים",
    heChar: "מ",
    band: "B1–B2",
    blurb: "Numbered tickets, sticky chairs, and a clerk behind glass with a stamp older than you.",
    palette: { warm: "#A8B5C5", deep: "#3F4A78", tint: "rgba(63,74,120,0.10)" },
    locked: true
    ,
    cts: [
      {
        id: "renew-id",
        title: "Renewing an ID",
        variations: [
          { id: "smooth", label: "Smooth", situation: "Quick day." },
          { id: "missing-doc", label: "Missing doc", situation: "You forgot a document." },
          { id: "wrong-window", label: "Wrong window", situation: "Sent to a different counter." }
        ]
      }
    ]
  }
];

const GAMES = [
  { id: "translate", color: "#5B4B8A", he: "תַּרְגֵּם", titleA: "Switch", titleB: "tongues", sub: "Read a word. Pick the right translation." },
  { id: "tf", color: colors.terracotta, he: "נָכוֹן אוֹ לֹא", titleA: "True", titleB: "or false", sub: "10 sentences. 30 seconds each." },
  { id: "echo", color: colors.olive, he: "הֵד", titleA: "Hear it,", titleB: "echo it", sub: "Hear it. Repeat it. Score it." },
  { id: "verbs", color: colors.gold, he: "פֹּעַל", titleA: "Match", titleB: "the verb", sub: "Match conjugations under pressure." },
  { id: "words", color: "#7BABC0", he: "מִלָּה", titleA: "Catch", titleB: "the word", sub: "Fill in the missing word in the sentence." }
];

const HERO_DETAILS: Record<string, { title: string; he: string; watermark: string; copy: string }> = {
  s1: {
    title: "Falafel Stand",
    he: "דּוּכַן פָּלָאפֶל",
    watermark: "פ",
    copy: "Order a hot falafel. Ask for tahini. Pay with coins. 4 micro-steps."
  },
  s2: {
    title: "Greeting a Neighbor",
    he: "שָׁכֵן",
    watermark: "ש",
    copy: "Say hello. Introduce yourself. Ask how they are. 4 micro-steps."
  },
  s3: {
    title: "Numbers, 1–20",
    he: "מִסְפָּרִים",
    watermark: "מ",
    copy: "Count the items. Practice pronunciation under pressure. 4 micro-steps."
  },
  s4: {
    title: "At the supermarket",
    he: "בַּסּוּפֶּר",
    watermark: "ס",
    copy: "Find the eggs. Ask the price. Pay with cash. 5 micro-steps."
  },
  s5: {
    title: "Asking for Help",
    he: "מְבַקֵּשׁ עֶזְרָה",
    watermark: "ע",
    copy: "Get directions. Ask where to find the bus stop. 4 micro-steps."
  },
  s6: {
    title: "Café Order",
    he: "בְּבֵית קָפֶה",
    watermark: "ק",
    copy: "Order a cappuccino. Choose oat milk. Pick a pastry. 4 micro-steps."
  },
  tl1: {
    title: "Past Tense, men.",
    he: "עָבָר",
    watermark: "ע",
    copy: "Learn standard male conjugations in past tense with a tutor."
  }
};

export function HomeScreen({ user, onOpenConversation }: Props) {
  const [tab, setTab] = React.useState<TabKey>("home");
  const [detail, setDetail] = React.useState<DetailState | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = React.useState("Dana");
  const [activeGame, setActiveGame] = React.useState<null | "translate" | "tf" | "echo" | "verbs" | "words">(null);
  const [roadmapStops, setRoadmapStops] = React.useState<RoadmapStop[]>(ROADMAP_STOPS);

  React.useEffect(() => {
    let active = true;

    async function loadRoadmap() {
      try {
        const stops = await getRoadmap(user);
        if (active) {
          setRoadmapStops(stops);
        }
      } catch (err) {
        console.error("Failed to load roadmap:", err);
      }
    }

    void loadRoadmap();

    return () => {
      active = false;
    };
  }, [user]);
  const todayThemeId = React.useMemo(() => {
    const day = Math.floor(Date.now() / 86400000);
    const ids = THEMES.filter((theme) => !theme.locked).map((theme) => theme.id);
    return ids[day % ids.length];
  }, []);

  const todayTheme = THEMES.find((theme) => theme.id === todayThemeId) || THEMES[0];
  const otherThemes = THEMES.filter((theme) => theme.id !== todayTheme.id);

  React.useEffect(() => {
    let active = true;

    async function hydrateVoice() {
      try {
        const profile = await getCurrentUser(user);
        const voiceId = profile.onboarding?.voice;

        if (!active) {
          return;
        }

        if (voiceId === "noam") {
          setSelectedVoiceName("Noam");
        } else if (voiceId === "shira") {
          setSelectedVoiceName("Shira");
        } else {
          setSelectedVoiceName("Dana");
        }
      } catch {
        if (active) {
          setSelectedVoiceName("Dana");
        }
      }
    }

    void hydrateVoice();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleThemeTap(theme: ThemeItem) {
    if (theme.locked) {
      setDetail({
        kind: "roadmap",
        eyebrow: "PRO WORLD",
        title: theme.title,
        body: "This world is locked in the prototype flow. Upgrade handling can plug in here next.",
        action: "Close"
      });
      return;
    }

    try {
      const response = await launchScenario(user, theme.id, "gemini");
      setSelectedVoiceName(response.tutorVoice.name);
      onOpenConversation(response.sessionId);
    } catch {
      setDetail({
        kind: "roadmap",
        eyebrow: "SCENARIO ERROR",
        title: theme.title,
        body: "The scene could not be opened right now. Try again once the backend is reachable.",
        action: "Close"
      });
    }
  }
  function handleRoadmapTap(stop: RoadmapStop) {
    if (stop.kind === "current") {
      setDetail({
        kind: "roadmap",
        eyebrow: "NEXT LESSON",
        title: stop.title,
        body: `This is the current active lesson in the path with ${selectedVoiceName}. The next production step would be to connect it to the conversation screen.`,
        action: "Resume"
      });
      return;
    }

    if (stop.kind === "checkpoint") {
      setDetail({
        kind: "roadmap",
        eyebrow: "MILESTONE",
        title: stop.title,
        body: "Checkpoint screens are the next branch to wire. This slot is ready for a format picker or recap handoff.",
        action: "Continue"
      });
      return;
    }

    if (stop.kind === "locked") {
      setDetail({
        kind: "roadmap",
        eyebrow: "LOCKED",
        title: stop.title,
        body: "This stop is visible in the journey path but not yet unlocked for interaction.",
        action: "Close"
      });
      return;
    }

    setDetail({
      kind: "roadmap",
      eyebrow: stop.fmt.toUpperCase(),
      title: stop.title,
      body: "Completed stop. This can later open recap, review, or replay behavior.",
      action: "Review"
    });
  }

  function handleGameTap(game: (typeof GAMES)[number]) {
    if (game.id === "translate" || game.id === "tf" || game.id === "echo" || game.id === "verbs" || game.id === "words") {
      setActiveGame(game.id);
      return;
    }

    setDetail({
      kind: "game",
      eyebrow: "GUIDED GAME",
      title: `${game.titleA} ${game.titleB}`,
      body: game.sub,
      action: "Start"
    });
  }



  if (activeGame === "translate") {
    return <TranslateGameScreen onExit={() => setActiveGame(null)} />;
  }

  if (activeGame === "tf" || activeGame === "echo" || activeGame === "verbs" || activeGame === "words") {
    return <GuidedGamesScreen gameId={activeGame} onExit={() => setActiveGame(null)} />;
  }

  const currentStop = roadmapStops.find((s) => s.kind === "current") || roadmapStops[0];
  const heroDetail = HERO_DETAILS[currentStop.id] || HERO_DETAILS.s1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>דַּבֵּר</Text>
        <View style={styles.topBarSpacer} />
        <StatBadge tone="terracotta" symbol="✦" value="7" />
        <StatBadge tone="gold" symbol="✦" value="240" />
        <Pressable style={styles.proPill}>
          <Text style={styles.proPillSymbol}>✦</Text>
          <Text style={styles.proPillText}>PRO</Text>
        </Pressable>
      </View>

      <View style={styles.contentArea}>
        {tab === "home" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.heroWrap}>
              <View style={styles.heroCard}>
                <Text style={styles.heroWatermark}>{heroDetail.watermark}</Text>
                <Text style={styles.heroEyebrow}>NEXT · 4 MIN</Text>
                <Text style={styles.heroHebrew}>{heroDetail.he}</Text>
                <Text style={styles.heroTitle}>{heroDetail.title}</Text>
                <Text style={styles.heroCopy}>
                  {heroDetail.copy.replace("micro-steps.", `micro-steps with ${selectedVoiceName}.`)}
                </Text>
                <Pressable style={styles.heroButton} onPress={() => handleRoadmapTap(currentStop)}>
                  <Text style={styles.heroButtonText}>Resume</Text>
                  <Text style={styles.heroButtonText}>→</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionMono}>SECTION 02</Text>
              <View style={styles.sectionRule} />
              <Text style={styles.sectionMeta}>A2 · DAILY LIFE</Text>
            </View>

            <View style={styles.sectionBodyWrap}>
              <Text style={styles.sectionTitle}>Errands & encounters.</Text>
              <Text style={styles.sectionCopy}>9 stops. 3 done. 1 in progress.</Text>
            </View>

            <View style={styles.pathWrap}>
              {roadmapStops.map((stop, index) => (
                <PathStop
                  key={stop.id}
                  stop={stop}
                  index={index}
                  last={index === roadmapStops.length - 1}
                  onPress={() => handleRoadmapTap(stop)}
                />
              ))}
            </View>

            <Pressable style={styles.profileNote} onPress={() => void signOut(auth)}>
              <Text style={styles.profileNoteEyebrow}>SIGNED IN</Text>
              <Text style={styles.profileNoteText}>{user.email || user.uid}</Text>
              <Text style={styles.profileNoteAction}>Tap to sign out</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {tab === "scenarios" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.scenariosHeader}>
              <Text style={styles.sectionMono}>SCENARIOS</Text>
              <Text style={styles.scenariosTitle}>
                Worlds to <Text style={styles.scenariosItalic}>step into.</Text>
              </Text>
              <Text style={styles.scenariosCopy}>
                Pick a world and start talking. Every visit feels a little different — same place, different day.
              </Text>
            </View>

            <View style={styles.featuredThemeWrap}>
              <Pressable style={styles.featuredThemeCard} onPress={() => handleThemeTap(todayTheme)}>
                <Text style={[styles.featuredThemeWatermark, { color: todayTheme.palette.warm }]}>{todayTheme.heChar}</Text>
                <View style={styles.featuredThemeTopRow}>
                  <View style={[styles.featuredThemeDot, { backgroundColor: todayTheme.palette.warm }]} />
                  <Text style={[styles.featuredThemeToday, { color: todayTheme.palette.warm }]}>TODAY</Text>
                </View>

                <View>
                  <Text style={styles.featuredThemeHebrew}>{todayTheme.he}</Text>
                  <Text style={styles.featuredThemeTitle}>{todayTheme.title}</Text>
                  <Text style={styles.featuredThemeBlurb}>{todayTheme.blurb}</Text>
                </View>

                <View style={[styles.featuredThemeButton, { backgroundColor: todayTheme.palette.warm }]}>
                  <Text style={styles.featuredThemeButtonText}>Step in with {selectedVoiceName}</Text>
                  <Text style={styles.featuredThemeButtonText}>→</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.themeRowsWrap}>
              {otherThemes.map((theme) => (
                <Pressable key={theme.id} style={styles.themeRow} onPress={() => handleThemeTap(theme)}>
                  <Text style={[styles.themeRowWatermark, { color: theme.palette.tint }]}>{theme.heChar}</Text>
                  <View style={[styles.themeRowDot, { backgroundColor: theme.palette.deep }]} />
                  <View style={styles.themeRowBody}>
                    <Text style={styles.themeRowHebrew}>{theme.he}</Text>
                    <Text style={styles.themeRowTitle}>{theme.title}</Text>
                    <Text style={styles.themeRowBlurb} numberOfLines={1}>{theme.blurb}</Text>
                  </View>
                  {theme.locked ? (
                    <View style={styles.themeRowProPill}>
                      <Text style={styles.themeRowProText}>PRO</Text>
                    </View>
                  ) : (
                    <Text style={styles.themeRowArrow}>→</Text>
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {tab === "games" ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.gamesHeader}>
              <Text style={styles.sectionMono}>GUIDED GAMES · ARCADE</Text>
              <Text style={styles.gamesTitle}>
                Quick reps,{"\n"}
                <Text style={styles.gamesItalic}>fast feedback.</Text>
              </Text>
              <Text style={styles.gamesCopy}>Four bite-sized drills. Each ends in 2–3 minutes.</Text>
            </View>

            <View style={styles.gamesList}>
              {GAMES.map((game) => (
                <Pressable key={game.id} style={[styles.gameCard, { backgroundColor: game.color }]} onPress={() => handleGameTap(game)}>
                  <Text style={styles.gameWatermark}>{game.he.charAt(0)}</Text>
                  <View style={styles.gameIcon}>
                    <Text style={styles.gameIconText}>✦</Text>
                  </View>
                  <View style={styles.gameBody}>
                    <Text style={styles.gameHebrew}>{game.he}</Text>
                    <Text style={styles.gameTitle}>{game.titleA} {game.titleB}</Text>
                    <Text style={styles.gameSub}>{game.sub}</Text>
                  </View>
                  <Text style={styles.gameArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <TabButton label="Path" icon="⌂" active={tab === "home"} onPress={() => setTab("home")} />
        <TabButton label="Scenarios" icon="◫" active={tab === "scenarios"} onPress={() => setTab("scenarios")} />
        <TabButton label="Games" icon="✦" active={tab === "games"} onPress={() => setTab("games")} />
      </View>

      {detail ? (
        <DetailOverlay
          detail={detail}
          onClose={() => setDetail(null)}
          onAction={async () => {
            setDetail(null);
            if (detail.action === "Resume" || detail.action === "Continue") {
              const supermarketTheme = THEMES.find((theme) => theme.id === "supermarket");
              if (supermarketTheme) {
                await handleThemeTap(supermarketTheme);
              }
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function StatBadge({ tone, symbol, value }: { tone: "terracotta" | "gold"; symbol: string; value: string }) {
  const isGold = tone === "gold";

  return (
    <View style={[styles.badge, isGold ? styles.badgeGold : styles.badgeTerracotta]}>
      <Text style={[styles.badgeSymbol, isGold ? styles.badgeSymbolGold : styles.badgeSymbolTerracotta]}>{symbol}</Text>
      <Text style={[styles.badgeValue, isGold ? styles.badgeValueGold : styles.badgeValueTerracotta]}>{value}</Text>
    </View>
  );
}

function WavyConnector({
  x1,
  x2,
  y2,
  isCompleted,
  isTransition
}: {
  x1: number;
  x2: number;
  y2: number;
  isCompleted: boolean;
  isTransition: boolean;
}) {
  if (isCompleted) {
    // Solid green S-curve using 2 curved views
    const dx = x2 - x1;
    const xMid = (x1 + x2) / 2;
    const yMid = y2 / 2;

    if (Math.abs(dx) < 1) {
      return (
        <View
          style={{
            position: "absolute",
            left: x1 - 2.5,
            top: 0,
            width: 5,
            height: y2,
            backgroundColor: colors.olive,
            borderRadius: 2.5
          }}
        />
      );
    }

    if (dx > 0) {
      // Curving right
      const w = dx / 2;
      return (
        <>
          {/* Top Half Bend */}
          <View
            style={{
              position: "absolute",
              left: x1,
              top: 0,
              width: w + 5,
              height: yMid,
              borderLeftWidth: 5,
              borderBottomWidth: 5,
              borderColor: colors.olive,
              borderBottomLeftRadius: yMid,
              backgroundColor: "transparent"
            }}
          />
          {/* Bottom Half Bend */}
          <View
            style={{
              position: "absolute",
              left: xMid - 5,
              top: yMid - 5,
              width: w + 10,
              height: yMid + 5,
              borderRightWidth: 5,
              borderTopWidth: 5,
              borderColor: colors.olive,
              borderTopRightRadius: yMid,
              backgroundColor: "transparent"
            }}
          />
        </>
      );
    } else {
      // Curving left
      const w = Math.abs(dx) / 2;
      return (
        <>
          {/* Top Half Bend */}
          <View
            style={{
              position: "absolute",
              left: xMid,
              top: 0,
              width: w + 5,
              height: yMid,
              borderRightWidth: 5,
              borderBottomWidth: 5,
              borderColor: colors.olive,
              borderBottomRightRadius: yMid,
              backgroundColor: "transparent"
            }}
          />
          {/* Bottom Half Bend */}
          <View
            style={{
              position: "absolute",
              left: x2,
              top: yMid - 5,
              width: w + 5,
              height: yMid + 5,
              borderLeftWidth: 5,
              borderTopWidth: 5,
              borderColor: colors.olive,
              borderTopLeftRadius: yMid,
              backgroundColor: "transparent"
            }}
          />
        </>
      );
    }
  }

  if (isTransition) {
    // Transition connector: Top half is solid terracotta red, bottom half is grey dots
    const dx = x2 - x1;
    const xMid = (x1 + x2) / 2;
    const yMid = y2 / 2;

    // Render top half solid red
    let topHalfSolid = null;
    if (Math.abs(dx) < 1) {
      topHalfSolid = (
        <View
          style={{
            position: "absolute",
            left: x1 - 2.5,
            top: 0,
            width: 5,
            height: yMid,
            backgroundColor: colors.terracotta,
            borderRadius: 2.5
          }}
        />
      );
    } else if (dx > 0) {
      const w = dx / 2;
      topHalfSolid = (
        <View
          style={{
            position: "absolute",
            left: x1,
            top: 0,
            width: w + 5,
            height: yMid,
            borderLeftWidth: 5,
            borderBottomWidth: 5,
            borderColor: colors.terracotta,
            borderBottomLeftRadius: yMid,
            backgroundColor: "transparent"
          }}
        />
      );
    } else {
      const w = Math.abs(dx) / 2;
      topHalfSolid = (
        <View
          style={{
            position: "absolute",
            left: xMid,
            top: 0,
            width: w + 5,
            height: yMid,
            borderRightWidth: 5,
            borderBottomWidth: 5,
            borderColor: colors.terracotta,
            borderBottomRightRadius: yMid,
            backgroundColor: "transparent"
          }}
        />
      );
    }

    // Render bottom half as grey dots along the second half of the bezier curve (t = 0.5 to 1.0)
    const dots = [];
    const numDots = 6;
    for (let i = 0; i <= numDots; i++) {
      const t = 0.5 + (i / numDots) * 0.5;
      const angle = t * Math.PI;
      const factor = (1 - Math.cos(angle)) / 2;
      const xPos = x1 + (x2 - x1) * factor;
      const yPos = t * y2;

      dots.push(
        <View
          key={`dot-${i}`}
          style={{
            position: "absolute",
            left: xPos - 3,
            top: yPos - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "rgba(26, 20, 16, 0.24)"
          }}
        />
      );
    }

    return (
      <>
        {topHalfSolid}
        {dots}
      </>
    );
  }

  // Locked stop connector: entirely grey dots along the curve (t = 0 to 1.0)
  const dots = [];
  const numDots = 12;
  for (let i = 0; i <= numDots; i++) {
    const t = i / numDots;
    const angle = t * Math.PI;
    const factor = (1 - Math.cos(angle)) / 2;
    const xPos = x1 + (x2 - x1) * factor;
    const yPos = t * y2;

    dots.push(
      <View
        key={`dot-locked-${i}`}
        style={{
          position: "absolute",
          left: xPos - 3,
          top: yPos - 3,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(26, 20, 16, 0.16)"
        }}
      />
    );
  }

  return <>{dots}</>;
}

function PathStop({
  stop,
  index,
  last,
  onPress
}: {
  stop: RoadmapStop;
  index: number;
  last: boolean;
  onPress: () => void;
}) {
  const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];
  const nextOffset = PATH_OFFSETS[(index + 1) % PATH_OFFSETS.length];

  const x1 = offset + 32;
  const x2 = nextOffset + 32;
  const y2 = 94; // Row height (88) + marginBottom (6)

  // Determine line style
  // - Completed: all lines up to the transition between current and locked (which is at index 4 to 5)
  // - Transition (index === 4): from current (At the Supermarket) to locked (Asking for Help). Half solid terracotta red, half grey dashed.
  // - Locked: index > 4. Entirely grey dashed.
  const isTransition = index === 4;
  const isCompleted = index < 4;

  return (
    <View style={styles.pathStopShell}>
      {!last && (
        <View style={styles.connectorSvgWrap}>
          <WavyConnector
            x1={x1}
            x2={x2}
            y2={y2}
            isCompleted={isCompleted}
            isTransition={isTransition}
          />
        </View>
      )}

      {stop.kind === "checkpoint" ? (
        <Pressable style={[styles.pathRow, { paddingLeft: offset }]} onPress={onPress}>
          <View style={styles.markerContainer}>
            <View style={styles.checkpointMarker}>
              <Text style={styles.checkpointMarkerInner}>✦</Text>
            </View>
          </View>
          <View style={styles.pathText}>
            <Text style={[styles.pathLabel, styles.pathLabelMilestone]}>MILESTONE</Text>
            <View style={styles.pathTitleRow}>
              <Text style={styles.pathTitle}>
                {stop.title} — {stop.fmt}
              </Text>
              <Text style={styles.pathHebrew}>{stop.he}</Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable style={[styles.pathRow, { paddingLeft: offset }]} onPress={onPress}>
          <View style={styles.markerContainer}>
            {stop.kind === "current" && (
              <View style={styles.activeGlowHalo} />
            )}
            <View
              style={[
                styles.pathMarker,
                stop.kind === "done" ? styles.pathMarkerDone : null,
                stop.kind === "current" ? styles.pathMarkerCurrent : null,
                stop.kind === "locked" ? styles.pathMarkerLocked : null
              ]}
            >
              <Text style={[styles.pathMarkerText, stop.kind === "locked" ? styles.pathMarkerTextLocked : null]}>
                {stop.kind === "done" ? "✓" : stop.kind === "current" ? "▶" : "🔒"}
              </Text>
            </View>
          </View>
          <View style={[styles.pathText, stop.kind === "locked" ? styles.pathTextLocked : null]}>
            <Text style={[styles.pathLabel, stop.kind === "current" ? styles.pathLabelCurrent : null]}>
              {stop.fmt.toUpperCase()}{stop.kind === "current" ? " · NEXT" : ""}
            </Text>
            <View style={styles.pathTitleRow}>
              <Text style={[styles.pathTitle, stop.kind === "locked" ? styles.pathTitleLocked : null]}>
                {stop.title}
              </Text>
              <Text style={[styles.pathHebrew, stop.kind === "locked" ? styles.pathHebrewLocked : null]}>
                {stop.he}
              </Text>
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabIcon, active ? styles.tabIconActive : null]}>{icon}</Text>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function DetailOverlay({
  detail,
  onClose,
  onAction
}: {
  detail: DetailState;
  onClose: () => void;
  onAction?: () => void;
}) {
  return (
    <View style={styles.detailOverlay}>
      <Pressable style={styles.detailBackdrop} onPress={onClose} />
      <View style={styles.detailCard}>
        <Text style={styles.detailEyebrow}>{detail.eyebrow}</Text>
        <Text style={styles.detailTitle}>{detail.title}</Text>
        <Text style={styles.detailBody}>{detail.body}</Text>
        <Pressable style={styles.detailButton} onPress={onAction || onClose}>
          <Text style={styles.detailButtonText}>{detail.action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bone
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 12
  },
  wordmark: {
    fontSize: 22,
    color: colors.ink,
    fontWeight: "700"
  },
  topBarSpacer: {
    flex: 1
  },
  badge: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  badgeTerracotta: {
    backgroundColor: "rgba(184,70,44,0.1)"
  },
  badgeGold: {
    backgroundColor: "rgba(217,163,94,0.18)"
  },
  badgeSymbol: {
    fontSize: 12
  },
  badgeSymbolTerracotta: {
    color: colors.terracotta
  },
  badgeSymbolGold: {
    color: colors.gold
  },
  badgeValue: {
    fontSize: 12,
    fontWeight: "600"
  },
  badgeValueTerracotta: {
    color: colors.terracotta
  },
  badgeValueGold: {
    color: colors.ink
  },
  proPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  proPillSymbol: {
    color: colors.gold,
    fontSize: 11
  },
  proPillText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1
  },
  contentArea: {
    flex: 1
  },
  heroWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20
  },
  heroCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    paddingHorizontal: 22,
    paddingVertical: 20,
    overflow: "hidden"
  },
  heroWatermark: {
    position: "absolute",
    right: -10,
    top: -30,
    fontSize: 200,
    color: "rgba(244,236,222,0.06)",
    lineHeight: 200
  },
  heroEyebrow: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8
  },
  heroHebrew: {
    color: colors.bone,
    fontSize: 28,
    marginBottom: 4
  },
  heroTitle: {
    color: colors.bone,
    fontSize: 26,
    fontStyle: "italic",
    marginBottom: 12
  },
  heroCopy: {
    color: "rgba(244,236,222,0.65)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 280
  },
  heroButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.terracotta,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroButtonText: {
    color: colors.bone,
    fontSize: 14,
    fontWeight: "600"
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sectionMono: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line
  },
  sectionMeta: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 1
  },
  sectionBodyWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 28,
    marginBottom: 6
  },
  sectionCopy: {
    color: colors.inkMute,
    fontSize: 13
  },
  pathWrap: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36
  },
  pathStopShell: {
    position: "relative",
    minHeight: 88,
    marginBottom: 6
  },
  connectorSvgWrap: {
    position: "absolute",
    top: 32,
    left: 0,
    right: 0,
    height: 94,
    zIndex: -1
  },
  connectorSvg: {
    width: "100%",
    height: 94
  },
  markerContainer: {
    position: "relative",
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center"
  },
  activeGlowHalo: {
    position: "absolute",
    left: -12,
    top: -12,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(184, 70, 44, 0.20)"
  },
  pathTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2
  },
  pathTitleLocked: {
    color: colors.inkMute,
    opacity: 0.6
  },
  pathHebrewLocked: {
    color: colors.inkFaint,
    opacity: 0.6
  },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  pathMarker: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  pathMarkerDone: {
    backgroundColor: colors.olive
  },
  pathMarkerCurrent: {
    backgroundColor: colors.terracotta,
    shadowColor: colors.terracotta,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  pathMarkerLocked: {
    backgroundColor: "rgba(26,20,16,0.04)",
    borderWidth: 1,
    borderColor: colors.lineStrong
  },
  pathMarkerText: {
    color: colors.bone,
    fontSize: 18,
    fontWeight: "700"
  },
  pathMarkerTextLocked: {
    color: colors.inkFaint
  },
  checkpointMarker: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  checkpointMarkerInner: {
    color: colors.gold,
    fontSize: 22,
    transform: [{ rotate: "-45deg" }]
  },
  pathText: {
    flex: 1
  },
  pathTextLocked: {
    opacity: 0.5
  },
  pathLabel: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 2
  },
  pathLabelCurrent: {
    color: colors.terracotta
  },
  pathLabelMilestone: {
    color: colors.gold
  },
  pathTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500"
  },
  pathHebrew: {
    color: colors.inkMute,
    fontSize: 18,
    textAlign: "right"
  },
  profileNote: {
    marginHorizontal: 24,
    marginBottom: 28,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper
  },
  profileNoteEyebrow: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 4
  },
  profileNoteText: {
    color: colors.ink,
    fontSize: 14
  },
  profileNoteAction: {
    color: colors.terracotta,
    fontSize: 12,
    marginTop: 6
  },
  scenariosHeader: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 22
  },
  scenariosTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 34,
    marginTop: 8
  },
  scenariosItalic: {
    fontStyle: "italic"
  },
  scenariosCopy: {
    fontSize: 13.5,
    color: colors.inkMute,
    marginTop: 10,
    lineHeight: 20,
    maxWidth: 320
  },
  featuredThemeWrap: {
    paddingHorizontal: 18,
    paddingBottom: 14
  },
  featuredThemeCard: {
    minHeight: 200,
    borderRadius: 28,
    backgroundColor: colors.ink,
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: "space-between",
    overflow: "hidden"
  },
  featuredThemeWatermark: {
    position: "absolute",
    right: -22,
    top: -44,
    fontSize: 280,
    lineHeight: 280,
    opacity: 0.1,
    fontWeight: "700"
  },
  featuredThemeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  featuredThemeDot: {
    width: 6,
    height: 6,
    borderRadius: 999
  },
  featuredThemeToday: {
    fontSize: 11,
    letterSpacing: 2
  },
  featuredThemeHebrew: {
    color: colors.bone,
    fontSize: 38,
    fontWeight: "700",
    lineHeight: 38
  },
  featuredThemeTitle: {
    color: colors.bone,
    fontSize: 30,
    fontStyle: "italic",
    lineHeight: 30,
    marginTop: 4
  },
  featuredThemeBlurb: {
    color: "rgba(244,236,222,0.68)",
    fontSize: 14.5,
    lineHeight: 20,
    marginTop: 12,
    fontStyle: "italic",
    maxWidth: 320
  },
  featuredThemeButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  featuredThemeButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500"
  },
  themeRowsWrap: {
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 10
  },
  themeRow: {
    minHeight: 88,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden"
  },
  themeRowWatermark: {
    position: "absolute",
    right: -8,
    top: "50%",
    fontSize: 130,
    lineHeight: 130,
    marginTop: -55,
    fontWeight: "700"
  },
  themeRowDot: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  themeRowBody: {
    flex: 1
  },
  themeRowHebrew: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "700"
  },
  themeRowTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 23,
    marginTop: 2,
    fontStyle: "italic"
  },
  themeRowBlurb: {
    color: colors.inkMute,
    fontSize: 12.5,
    lineHeight: 16,
    marginTop: 6
  },
  themeRowArrow: {
    color: colors.inkMute,
    fontSize: 18
  },
  themeRowProPill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    justifyContent: "center"
  },
  themeRowProText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  gamesHeader: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20
  },
  gamesTitle: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 36,
    marginTop: 6
  },
  gamesItalic: {
    fontStyle: "italic"
  },
  gamesCopy: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8
  },
  gamesList: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12
  },
  gameCard: {
    minHeight: 110,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    overflow: "hidden"
  },
  gameWatermark: {
    position: "absolute",
    right: -14,
    top: -36,
    fontSize: 150,
    color: "rgba(244,236,222,0.08)"
  },
  gameIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(244,236,222,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  gameIconText: {
    color: colors.bone,
    fontSize: 18
  },
  gameBody: {
    flex: 1
  },
  gameHebrew: {
    color: colors.bone,
    fontSize: 22,
    marginBottom: 2
  },
  gameTitle: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "500"
  },
  gameSub: {
    color: "rgba(244,236,222,0.85)",
    fontSize: 12,
    marginTop: 4
  },
  gameArrow: {
    color: colors.bone,
    fontSize: 20,
    fontWeight: "700"
  },
  detailOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end"
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,20,16,0.36)"
  },
  detailCard: {
    backgroundColor: colors.bone,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: colors.line
  },
  detailEyebrow: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 10
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 30,
    marginBottom: 10
  },
  detailBody: {
    color: colors.inkMute,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18
  },
  detailButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  detailButtonText: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "600"
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: "rgba(255,253,247,0.94)"
  },
  tabButton: {
    flex: 1,
    minHeight: 66,
    alignItems: "center",
    justifyContent: "center"
  },
  tabIcon: {
    color: colors.inkMute,
    fontSize: 16,
    marginBottom: 2
  },
  tabIconActive: {
    color: colors.ink
  },
  tabLabel: {
    color: colors.inkMute,
    fontSize: 12,
    fontWeight: "500"
  },
  tabLabelActive: {
    color: colors.ink
  }
});

