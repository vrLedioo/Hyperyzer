import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily, fontFamilyMono, waitForFonts } from "./fonts";
import { COLORS, GRADIENT_BR, SPRINGS } from "./theme";

/**
 * Hyperyzer — flagship 30s vertical ad, V2 (post growth-engine release).
 *
 * Storyboard (seconds on the master timeline, 1080×1920 design canvas):
 *   0.0– 3.6  HOOK    dark — "3 days of work." → views counter crawls to 47.
 *   3.4– 7.2  FLIP    "You find out AFTER you post." → "Hyperyzer knows BEFORE."
 *   7.0–15.0  REPORT  light — glass report card: grade ring → A·84, bars 85/75/90,
 *                     verdict types in. (Real numbers from a real production report.)
 *  14.8–21.0  FIX-IT  "It doesn't just score it. It fixes it." — rewritten hook,
 *                     ready caption, hashtag chips, best-time pill.
 *  20.8–25.4  SHARE   dark — the OG scorecard springs in. "Get graded in 10
 *                     seconds — free, no signup."
 *  25.2–30.0  CTA     logo, "Stop guessing. Start scoring.", hyperyzer.com pill.
 */

const W = 1080;
const H = 1920;

const SEC = {
  hook: { from: 0, to: 3.6 },
  flip: { from: 3.4, to: 7.2 },
  report: { from: 7.0, to: 15.0 },
  fixit: { from: 14.8, to: 21.0 },
  share: { from: 20.8, to: 25.4 },
  cta: { from: 25.2, to: 30.0 },
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ── Shared bits ───────────────────────────────────────────────────────────────

const Grad: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <span
    style={{
      background: `linear-gradient(105deg, ${COLORS.pink}, ${COLORS.orange})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      ...style,
    }}
  >
    {children}
  </span>
);

const PlayTriangle: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ marginLeft: size * 0.08 }}>
    <path d="M8 5.5v13l11-6.5z" fill="#fff" />
  </svg>
);

const BrandMark: React.FC<{ size?: number; dark?: boolean }> = ({
  size = 96,
  dark = false,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: dark ? "#fff" : COLORS.slate900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
      }}
    >
      {dark ? (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" style={{ marginLeft: size * 0.04 }}>
          <path d="M8 5.5v13l11-6.5z" fill={COLORS.slate900} />
        </svg>
      ) : (
        <PlayTriangle size={size * 0.5} />
      )}
    </div>
    <span
      style={{
        fontSize: size * 0.62,
        fontWeight: 800,
        letterSpacing: -1.5,
        color: dark ? "#fff" : COLORS.slate900,
      }}
    >
      Hyperyzer
    </span>
  </div>
);

/** Entrance + exit inside the current Sequence: rise/fade in, fade out. */
const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number; // seconds after sequence start
  out?: number; // seconds before sequence end to start fading
  durationSec: number;
  rise?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, out = 0.35, durationSec, rise = 46, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const enter = spring({
    frame: frame - delay * fps,
    fps,
    config: SPRINGS.soft,
    durationInFrames: Math.round(0.9 * fps),
  });
  const exit = interpolate(
    t,
    [durationSec - out, durationSec],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <div
      style={{
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * rise}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const useLocalT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { t: frame / fps, frame, fps };
};

/** Whole-scene exit fade (for scenes whose children manage only their entrances). */
const SceneFade: React.FC<{ durationSec: number; out?: number; children: React.ReactNode }> = ({
  durationSec,
  out = 0.4,
  children,
}) => {
  const { t } = useLocalT();
  const opacity = interpolate(t, [durationSec - out, durationSec], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// ── Scene 1 — HOOK ────────────────────────────────────────────────────────────

const SceneHook: React.FC = () => {
  const { t, frame, fps } = useLocalT();
  const dur = SEC.hook.to - SEC.hook.from;
  // Views crawl 0 → 47, deliberately pathetic.
  const views = Math.round(
    interpolate(t, [0.9, 2.6], [0, 47], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (x) => 1 - Math.pow(1 - x, 3),
    }),
  );
  const shake = t > 2.55 && t < 2.75 ? Math.sin(frame * 3.1) * 5 : 0;
  const flash = interpolate(t, [2.55, 2.62, 2.9], [0, 0.22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        transform: `translateX(${shake}px)`,
      }}
    >
      <AbsoluteFill style={{ background: COLORS.pink, opacity: flash }} />
      <Pop durationSec={dur} delay={0.1}>
        <div
          style={{
            fontSize: 46,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 10,
            textTransform: "uppercase",
          }}
        >
          3 days of filming
        </div>
      </Pop>
      <Pop durationSec={dur} delay={0.55}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <span
            style={{
              fontSize: 300,
              fontWeight: 800,
              letterSpacing: -10,
              color: "#fff",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {views}
          </span>
          <span style={{ fontSize: 76, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
            views
          </span>
        </div>
      </Pop>
      <Pop durationSec={dur} delay={2.7} rise={30}>
        <div style={{ fontSize: 58, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
          Sound familiar?
        </div>
      </Pop>
    </AbsoluteFill>
  );
};

// ── Scene 2 — FLIP ────────────────────────────────────────────────────────────

const SceneFlip: React.FC = () => {
  const { t, frame, fps } = useLocalT();
  const dur = SEC.flip.to - SEC.flip.from;
  const afterPunch = spring({
    frame: frame - Math.round(0.75 * fps),
    fps,
    config: SPRINGS.pop,
    durationInFrames: Math.round(0.7 * fps),
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 }}>
      <Pop durationSec={dur} delay={0.05}>
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -2,
            textAlign: "center",
            lineHeight: 1.16,
          }}
        >
          You find out
          <br />
          <span
            style={{
              display: "inline-block",
              color: "#f87171",
              transform: `scale(${0.6 + afterPunch * 0.4})`,
            }}
          >
            AFTER
          </span>{" "}
          you post.
        </div>
      </Pop>
      <Pop durationSec={dur} delay={1.7} rise={60}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -2,
            textAlign: "center",
            lineHeight: 1.14,
            color: "#fff",
          }}
        >
          Hyperyzer knows
          <br />
          <Grad>BEFORE.</Grad>
        </div>
      </Pop>
      <Pop durationSec={dur} delay={2.5} rise={30}>
        <BrandMark size={86} dark />
      </Pop>
    </AbsoluteFill>
  );
};

// ── Scene 3 — REPORT ──────────────────────────────────────────────────────────

const GradeRing: React.FC<{ appearAt: number }> = ({ appearAt }) => {
  const { frame, fps } = useLocalT();
  const p = spring({
    frame: frame - Math.round(appearAt * fps),
    fps,
    config: { damping: 24, mass: 1.1, stiffness: 60 },
    durationInFrames: Math.round(1.8 * fps),
  });
  const R = 118;
  const C = 2 * Math.PI * R;
  const value = Math.round(84 * p);
  return (
    <div style={{ position: "relative", width: 300, height: 300, flexShrink: 0 }}>
      <svg viewBox="0 0 300 300" width={300} height={300} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="v2grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.pink} />
            <stop offset="100%" stopColor={COLORS.orange} />
          </linearGradient>
        </defs>
        <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(15,23,42,0.09)" strokeWidth="26" />
        <circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke="url(#v2grad)"
          strokeWidth="26"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - 0.84 * p)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 108, fontWeight: 800, color: COLORS.slate900, lineHeight: 1 }}>
          {p > 0.85 ? "A" : value}
        </span>
        <span style={{ fontSize: 34, fontWeight: 700, color: COLORS.slate400 }}>
          {value}/100
        </span>
      </div>
    </div>
  );
};

const ScoreRow: React.FC<{
  label: string;
  value: number;
  color: string;
  appearAt: number;
}> = ({ label, value, color, appearAt }) => {
  const { frame, fps } = useLocalT();
  const p = spring({
    frame: frame - Math.round(appearAt * fps),
    fps,
    config: SPRINGS.bar,
    durationInFrames: Math.round(1.3 * fps),
  });
  return (
    <div style={{ opacity: Math.min(1, p * 2) }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: COLORS.slate600 }}>{label}</span>
        <span
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: COLORS.slate900,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(value * p)}
        </span>
      </div>
      <div style={{ height: 18, borderRadius: 9, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value * p}%`,
            borderRadius: 9,
            background: color,
          }}
        />
      </div>
    </div>
  );
};

const TypeLine: React.FC<{ text: string; startAt: number; cps?: number; style?: React.CSSProperties }> = ({
  text,
  startAt,
  cps = 34,
  style,
}) => {
  const { t } = useLocalT();
  const chars = Math.floor(Math.max(0, t - startAt) * cps);
  const shown = text.slice(0, chars);
  const done = chars >= text.length;
  return (
    <span style={style}>
      {shown}
      {!done && chars > 0 && <span style={{ opacity: 0.6 }}>|</span>}
    </span>
  );
};

const SceneReport: React.FC = () => {
  const dur = SEC.report.to - SEC.report.from;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
      <Pop durationSec={dur} delay={0.15}>
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            color: COLORS.slate900,
            letterSpacing: -1.5,
            textAlign: "center",
          }}
        >
          Paste your idea. <Grad>Get graded.</Grad>
        </div>
      </Pop>

      <Pop durationSec={dur} delay={0.55} rise={70}>
        <div
          style={{
            width: 920,
            borderRadius: 40,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.05)",
            boxShadow: "0 30px 80px rgba(236,72,153,0.16)",
            padding: "52px 56px",
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COLORS.pink,
              marginBottom: 14,
            }}
          >
            AI report · idea · TikTok
          </div>
          <div
            style={{
              fontSize: 50,
              fontWeight: 800,
              color: COLORS.slate900,
              letterSpacing: -1,
              marginBottom: 40,
              lineHeight: 1.2,
            }}
          >
            &ldquo;I opened a bakery with my last €500&rdquo;
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
            <GradeRing appearAt={1.1} />
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 30 }}>
              <ScoreRow label="Hook" value={85} color={COLORS.pink} appearAt={1.5} />
              <ScoreRow label="Retention" value={75} color={COLORS.emerald} appearAt={1.75} />
              <ScoreRow label="Viral" value={90} color={COLORS.orange} appearAt={2.0} />
            </div>
          </div>

          <div
            style={{
              marginTop: 44,
              padding: "30px 34px",
              borderRadius: 24,
              background: "rgba(253,242,248,0.9)",
              border: `1px solid ${COLORS.pink100}`,
              minHeight: 130,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 5,
                textTransform: "uppercase",
                color: COLORS.slate400,
                marginBottom: 10,
              }}
            >
              Verdict
            </div>
            <TypeLine
              text="Add an emotional twist to your hook to amplify curiosity."
              startAt={3.3}
              style={{ fontSize: 40, fontWeight: 700, color: COLORS.slate700, lineHeight: 1.35 }}
            />
          </div>
        </div>
      </Pop>
    </AbsoluteFill>
  );
};

// ── Scene 4 — FIX-IT ──────────────────────────────────────────────────────────

const FixCard: React.FC<{
  appearAt: number;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}> = ({ appearAt, label, children, accent = false }) => {
  const { frame, fps } = useLocalT();
  const p = spring({
    frame: frame - Math.round(appearAt * fps),
    fps,
    config: SPRINGS.soft,
    durationInFrames: Math.round(0.9 * fps),
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * 60}px)`,
        width: 920,
        borderRadius: 30,
        background: accent ? "rgba(253,242,248,0.95)" : "rgba(255,255,255,0.94)",
        border: accent ? `2px solid ${COLORS.pink100}` : "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 22px 60px rgba(236,72,153,0.12)",
        padding: "34px 42px",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 5,
          textTransform: "uppercase",
          color: accent ? COLORS.pink : COLORS.slate400,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
};

const Chip: React.FC<{ text: string; appearAt: number }> = ({ text, appearAt }) => {
  const { frame, fps } = useLocalT();
  const p = spring({
    frame: frame - Math.round(appearAt * fps),
    fps,
    config: SPRINGS.pop,
    durationInFrames: Math.round(0.6 * fps),
  });
  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${p})`,
        fontSize: 34,
        fontWeight: 700,
        color: COLORS.pink700,
        background: "rgba(252,231,243,0.9)",
        border: `1px solid ${COLORS.pink100}`,
        borderRadius: 14,
        padding: "10px 22px",
      }}
    >
      {text}
    </span>
  );
};

const SceneFixit: React.FC = () => {
  const dur = SEC.fixit.to - SEC.fixit.from;
  return (
    <SceneFade durationSec={dur} out={0.6}>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
      <Pop durationSec={dur} delay={0.15}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: COLORS.slate900,
            letterSpacing: -1.5,
            textAlign: "center",
            lineHeight: 1.18,
          }}
        >
          It doesn&rsquo;t just score it.
          <br />
          <Grad>It fixes it.</Grad>
        </div>
      </Pop>

      <FixCard appearAt={0.8} label="Stronger hook — ready to say" accent>
        <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.slate900, lineHeight: 1.35 }}>
          &ldquo;What if I told you I risked my last €500 on a bakery — and everyone
          said it would fail?&rdquo;
        </div>
      </FixCard>

      <FixCard appearAt={1.7} label="Ready-to-post caption">
        <div style={{ fontSize: 38, fontWeight: 600, color: COLORS.slate700, lineHeight: 1.4 }}>
          Day one. Last €500. A line out the door. Would you risk it? 👇
        </div>
      </FixCard>

      <FixCard appearAt={2.5} label="Best hashtags + best time">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <Chip text="#bakery" appearAt={2.8} />
          <Chip text="#smallbusiness" appearAt={2.95} />
          <Chip text="#storytime" appearAt={3.1} />
          <Chip text="#fyp" appearAt={3.25} />
          <span
            style={{
              display: "inline-block",
              fontSize: 34,
              fontWeight: 800,
              color: "#fff",
              background: GRADIENT_BR,
              borderRadius: 14,
              padding: "12px 26px",
              marginLeft: 8,
            }}
          >
            Post Tue · 6 PM
          </span>
        </div>
      </FixCard>
    </AbsoluteFill>
    </SceneFade>
  );
};

// ── Scene 5 — SHARE / TEASER ──────────────────────────────────────────────────

const MiniScore: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", width: 170 }}>
    <span style={{ fontSize: 26, fontWeight: 700, color: "#94a3b8" }}>{label}</span>
    <span style={{ fontSize: 54, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{value}</span>
    <div style={{ width: 150, height: 10, borderRadius: 5, background: "#334155" }}>
      <div
        style={{
          width: (value / 100) * 150,
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(90deg, ${COLORS.pink}, ${COLORS.orange})`,
        }}
      />
    </div>
  </div>
);

const SceneShare: React.FC = () => {
  const { t, frame, fps } = useLocalT();
  const dur = SEC.share.to - SEC.share.from;
  const cardIn = spring({
    frame: frame - Math.round(0.5 * fps),
    fps,
    config: SPRINGS.gentle,
    durationInFrames: Math.round(1.1 * fps),
  });
  const float = Math.sin(t * 1.8) * 8;
  return (
    <SceneFade durationSec={dur} out={0.4}>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
      <Pop durationSec={dur} delay={0.1}>
        <div
          style={{
            fontSize: 74,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -1.5,
            textAlign: "center",
            lineHeight: 1.18,
          }}
        >
          Get graded in <Grad>10 seconds.</Grad>
          <br />
          <span style={{ fontSize: 52, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
            Free. No signup. Share your grade.
          </span>
        </div>
      </Pop>

      <div
        style={{
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 120 + float}px) rotate(${(1 - cardIn) * -7 - 1.5}deg)`,
          width: 940,
          borderRadius: 36,
          background: "#0b1222",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
          padding: "48px 54px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>
            Hyperyzer
          </span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: "#f9a8d4",
            }}
          >
            AI video report
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginTop: 40 }}>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 110,
              background: GRADIENT_BR,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 100, fontWeight: 800, color: "#fff", lineHeight: 1 }}>A</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
              84/100
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: "#fff", lineHeight: 1.25 }}>
              I opened a bakery with my last €500
            </span>
            <div style={{ display: "flex", gap: 34 }}>
              <MiniScore label="Hook" value={85} />
              <MiniScore label="Retention" value={75} />
              <MiniScore label="Viral" value={90} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
    </SceneFade>
  );
};

// ── Scene 6 — CTA ─────────────────────────────────────────────────────────────

const SceneCta: React.FC = () => {
  const { t, frame, fps } = useLocalT();
  const dur = SEC.cta.to - SEC.cta.from;
  const pulse = 1 + Math.sin(t * 3.4) * 0.02;
  const btnIn = spring({
    frame: frame - Math.round(1.5 * fps),
    fps,
    config: SPRINGS.pop,
    durationInFrames: Math.round(0.8 * fps),
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
      <Pop durationSec={dur} delay={0.15} out={0.15}>
        <BrandMark size={110} dark />
      </Pop>
      <Pop durationSec={dur} delay={0.6} out={0.15}>
        <div
          style={{
            fontSize: 100,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -2.5,
            textAlign: "center",
            lineHeight: 1.14,
          }}
        >
          Stop guessing.
          <br />
          <Grad>Start scoring.</Grad>
        </div>
      </Pop>
      <div
        style={{
          opacity: btnIn,
          transform: `scale(${btnIn * pulse})`,
          background: GRADIENT_BR,
          borderRadius: 32,
          padding: "40px 84px",
          boxShadow: `0 24px 70px rgba(236,72,153,0.5)`,
        }}
      >
        <span
          style={{
            fontFamily: fontFamilyMono,
            fontSize: 62,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: -1,
          }}
        >
          hyperyzer.com
        </span>
      </div>
      <Pop durationSec={dur} delay={2.0} out={0.15} rise={24}>
        <div style={{ fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>
          Free to start · 10 credits · no card
        </div>
      </Pop>
    </AbsoluteFill>
  );
};

// ── Backdrop (dark ↔ light morphs on the master timeline) ─────────────────────

const Backdrop: React.FC = () => {
  const { t } = useLocalT();
  const bg = interpolateColors(
    t,
    [0, 6.2, 7.0, 20.2, 21.2, 30],
    ["#070709", "#070709", COLORS.bg, COLORS.bg, "#070709", "#070709"],
  );
  const glow = clamp01(interpolate(t, [6.4, 7.4, 20.2, 21.0], [0, 1, 1, 0]));
  return (
    <AbsoluteFill style={{ background: bg }}>
      {/* Soft brand blobs, only visible on the light section */}
      <div
        style={{
          position: "absolute",
          top: -300,
          left: -260,
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.22), transparent 65%)",
          opacity: glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -320,
          right: -240,
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.18), transparent 65%)",
          opacity: glow,
        }}
      />
      {/* Faint gradient pulse on the dark sections */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 55% at 50% 45%, rgba(236,72,153,0.14), transparent 70%)",
          opacity: 1 - glow,
        }}
      />
    </AbsoluteFill>
  );
};

// ── Composition root ──────────────────────────────────────────────────────────

const seq = (win: { from: number; to: number }, fps: number) => ({
  from: Math.round(win.from * fps),
  durationInFrames: Math.round((win.to - win.from) * fps),
});

export const HyperyzerAdV2: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const [handle] = React.useState(() => delayRender("fonts"));
  React.useEffect(() => {
    waitForFonts().then(() => continueRender(handle));
  }, [handle]);

  // Letterbox the 1080×1920 design into whatever the composition size is.
  const scale = Math.min(width / W, height / H);

  return (
    <AbsoluteFill style={{ background: "#070709", fontFamily }}>
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          left: (width - W * scale) / 2,
          top: (height - H * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Backdrop />
        <Sequence {...seq(SEC.hook, fps)} name="hook">
          <SceneHook />
        </Sequence>
        <Sequence {...seq(SEC.flip, fps)} name="flip">
          <SceneFlip />
        </Sequence>
        <Sequence {...seq(SEC.report, fps)} name="report">
          <SceneReport />
        </Sequence>
        <Sequence {...seq(SEC.fixit, fps)} name="fixit">
          <SceneFixit />
        </Sequence>
        <Sequence {...seq(SEC.share, fps)} name="share">
          <SceneShare />
        </Sequence>
        <Sequence {...seq(SEC.cta, fps)} name="cta">
          <SceneCta />
        </Sequence>
      </div>
      <Audio src={staticFile("soundtrack.wav")} />
    </AbsoluteFill>
  );
};
