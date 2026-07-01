import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
} from "remotion";
import { fontFamily, fontFamilyMono, waitForFonts } from "./fonts";
import { DESIGN_WIDTH, DESIGN_HEIGHT, SCENES } from "./lib/timing";

/**
 * Hyperyzer — 30s vertical social ad. Faithful Remotion port of the design
 * handoff (`design_handoff_hyperyzer_ad/animations.jsx`). The prototype's
 * timeline engine (Stage/Sprite/Easing/interpolate) is reproduced here, driven
 * by `useCurrentFrame()` instead of requestAnimationFrame. Web-Audio bed and
 * the tap-to-start gate from the prototype are intentionally dropped (the gate
 * is meaningless offline; audio is a separate deliverable).
 *
 * Picture-pictograms from the prototype (🕑 ⚡ ✦) are redrawn as inline SVG so
 * they survive a headless render (the render browser has no emoji font).
 */

// ── Brand tokens (lifted from the handoff `HZ` object) ───────────────────────
const HZ = {
  pink: "#ec4899",
  pinkDeep: "#db2777",
  orange: "#f97316",
  orangeDeep: "#ea580c",
  slate: "#0f172a",
  light: "#FDF2F8",
  dark: "#070709",
  font: fontFamily,
  mono: fontFamilyMono,
  grad: "linear-gradient(105deg, #ec4899 0%, #f97316 100%)",
} as const;

// ── Easing (hand-rolled, matching the prototype exactly) ─────────────────────
type EaseFn = (t: number) => number;
const Easing: Record<string, EaseFn> = {
  linear: (t) => t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuad: (t) => t * t,
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// Popmotion-style keyframe interpolation: interpolate(input, output, ease)(t).
function interpolate(
  input: number[],
  output: number[],
  ease: EaseFn = Easing.linear,
): (t: number) => number {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        return output[i] + (output[i + 1] - output[i]) * ease(local);
      }
    }
    return output[output.length - 1];
  };
}

function lerpColor(a: number[], b: number[], t: number): string {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

// ── Timeline + sprite context (mirrors the prototype) ────────────────────────
type TimelineCtx = { time: number };
const TimelineContext = React.createContext<TimelineCtx>({ time: 0 });
const useTime = () => React.useContext(TimelineContext).time;

type SpriteCtx = { localTime: number; progress: number; duration: number };
const SpriteContext = React.createContext<SpriteCtx>({
  localTime: 0,
  progress: 0,
  duration: 0,
});
const useSprite = () => React.useContext(SpriteContext);

const Sprite: React.FC<{ start: number; end: number; children: React.ReactNode }> = ({
  start,
  end,
  children,
}) => {
  const time = useTime();
  if (time < start || time > end) return null;
  const duration = end - start;
  const localTime = Math.max(0, time - start);
  const progress = duration > 0 ? clamp(localTime / duration, 0, 1) : 0;
  return (
    <SpriteContext.Provider value={{ localTime, progress, duration }}>
      {children}
    </SpriteContext.Provider>
  );
};

// ── Gradient text ────────────────────────────────────────────────────────────
const Grad: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <span
    style={{
      background: HZ.grad,
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

// ── Inline icons (replace emoji so they render headless) ─────────────────────
const IconClock: React.FC<{ size: number; color?: string }> = ({
  size,
  color = "#fff",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9.25" stroke={color} strokeWidth="1.8" />
    <path
      d="M12 6.75V12l3.5 2.1"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconZap: React.FC<{ size: number; color?: string }> = ({
  size,
  color = "#fff",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2 4.5 13.2H11l-1.4 8.8L20 10.2h-6.6L13 2Z" />
  </svg>
);

const IconSparkle: React.FC<{ size: number; color?: string }> = ({
  size,
  color = HZ.pinkDeep,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7Z" />
  </svg>
);

// ── BrandMark: rounded slate square + white play triangle, optional glow ─────
const BrandMark: React.FC<{ size?: number; glow?: number; t?: number }> = ({
  size = 200,
  glow = 0,
  t = 0,
}) => {
  const tri = size * 0.34;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {glow > 0 && (
        <div
          style={{
            position: "absolute",
            inset: -size * 0.5,
            background: `radial-gradient(circle, rgba(236,72,153,${0.55 * glow}) 0%, rgba(249,115,22,${0.32 * glow}) 35%, transparent 68%)`,
            filter: `blur(${size * 0.12}px)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: size * 0.26,
          background: HZ.slate,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 ${size * 0.08}px ${size * 0.16}px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.18)`,
          transform: `rotate(${Math.sin(t * 0.6) * 1.5}deg)`,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: `${tri * 0.62}px solid transparent`,
            borderBottom: `${tri * 0.62}px solid transparent`,
            borderLeft: `${tri}px solid #fff`,
            marginLeft: size * 0.06,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))",
          }}
        />
      </div>
    </div>
  );
};

// ── Morphing dark↔light backdrop ─────────────────────────────────────────────
const Backdrop: React.FC = () => {
  const time = useTime();
  const light = interpolate(
    [0, 7, 8, 25.4, 26.4, 30],
    [0, 0, 1, 1, 0, 0],
    Easing.easeInOutCubic,
  )(time);
  const dark = 1 - light;
  const drift = (a: number, b: number, sp: number) => ({
    x: Math.sin(time * sp + a) * b,
    y: Math.cos(time * sp * 0.8 + a) * b,
  });
  const d1 = drift(0, 60, 0.25);
  const d2 = drift(2, 80, 0.18);
  const d3 = drift(4, 50, 0.3);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: HZ.dark }}>
      {/* DARK layer */}
      <div style={{ position: "absolute", inset: 0, opacity: dark }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(120% 80% at 50% 18%, #15121c 0%, #070709 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-20%",
            right: "-20%",
            bottom: 0,
            top: "52%",
            backgroundImage:
              "linear-gradient(rgba(236,72,153,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.12) 1px, transparent 1px)",
            backgroundSize: "90px 90px",
            transform: "perspective(600px) rotateX(62deg)",
            transformOrigin: "center bottom",
            maskImage: "linear-gradient(to bottom, transparent, #000 40%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 40%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 540 + d1.x,
            top: 520 + d1.y,
            width: 700,
            height: 700,
            marginLeft: -350,
            marginTop: -350,
            background: "radial-gradient(circle, rgba(236,72,153,0.5) 0%, transparent 62%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 540 + d2.x,
            top: 1280 + d2.y,
            width: 760,
            height: 760,
            marginLeft: -380,
            marginTop: -380,
            background: "radial-gradient(circle, rgba(249,115,22,0.34) 0%, transparent 62%)",
            filter: "blur(48px)",
          }}
        />
      </div>

      {/* LIGHT layer */}
      <div style={{ position: "absolute", inset: 0, opacity: light, background: HZ.light }}>
        <div
          style={{
            position: "absolute",
            left: 200 + d1.x,
            top: 360 + d1.y,
            width: 760,
            height: 760,
            marginLeft: -380,
            marginTop: -380,
            background: "radial-gradient(circle, rgba(244,114,182,0.45) 0%, transparent 60%)",
            filter: "blur(60px)",
            mixBlendMode: "multiply",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 900 + d2.x,
            top: 760 + d2.y,
            width: 800,
            height: 800,
            marginLeft: -400,
            marginTop: -400,
            background: "radial-gradient(circle, rgba(251,146,60,0.4) 0%, transparent 60%)",
            filter: "blur(70px)",
            mixBlendMode: "multiply",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 480 + d3.x,
            top: 1480 + d3.y,
            width: 820,
            height: 820,
            marginLeft: -410,
            marginTop: -410,
            background: "radial-gradient(circle, rgba(236,72,153,0.32) 0%, transparent 62%)",
            filter: "blur(80px)",
            mixBlendMode: "multiply",
          }}
        />
      </div>

      {/* grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          mixBlendMode: light > 0.5 ? "multiply" : "screen",
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E")',
        }}
      />
    </div>
  );
};

// ── Entrance/exit "pop" wrapper ──────────────────────────────────────────────
const Pop: React.FC<{
  delay?: number;
  inDur?: number;
  outAt?: number | null;
  outDur?: number;
  y?: number;
  scaleFrom?: number;
  blurMax?: number;
  layer?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({
  delay = 0,
  inDur = 0.42,
  outAt = null,
  outDur = 0.32,
  y = 44,
  scaleFrom = 0.82,
  blurMax = 10,
  layer = false,
  children,
  style,
}) => {
  const { localTime, duration } = useSprite();
  const lt = localTime - delay;
  let op = 0;
  let sc = scaleFrom;
  let ty = y;
  let blur = blurMax;
  if (lt >= 0) {
    const t = clamp(lt / inDur, 0, 1);
    const e = Easing.easeOutBack(t);
    const e2 = Easing.easeOutCubic(t);
    op = e2;
    sc = scaleFrom + (1 - scaleFrom) * e;
    ty = y * (1 - e2);
    blur = blurMax * (1 - e2);
  }
  const oS = outAt == null ? duration - outDur : outAt;
  if (localTime > oS) {
    const t = clamp((localTime - oS) / outDur, 0, 1);
    const e = Easing.easeInCubic(t);
    op *= 1 - e;
    sc *= 1 - 0.05 * e;
    ty -= 18 * e;
    blur = Math.max(blur, 7 * e);
  }
  const base: React.CSSProperties = layer
    ? {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 90px",
      }
    : {};
  return (
    <div
      style={{
        ...base,
        opacity: clamp(op, 0, 1),
        transform: `translateY(${ty}px) scale(${sc})`,
        filter: blur > 0.4 ? `blur(${blur}px)` : "none",
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const CountUp: React.FC<{ to: number; start?: number; dur?: number; ease?: EaseFn }> = ({
  to,
  start = 0,
  dur = 1.6,
  ease = Easing.easeOutCubic,
}) => {
  const { localTime } = useSprite();
  const t = clamp((localTime - start) / dur, 0, 1);
  return <>{Math.round(to * ease(t))}</>;
};

const kicker: React.CSSProperties = {
  fontFamily: HZ.font,
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: "0.32em",
  textTransform: "uppercase",
};

// ── SCENE 1 · HOOK ────────────────────────────────────────────────────────────
const SceneHook: React.FC = () => (
  <Sprite start={SCENES.hook.start} end={SCENES.hook.end}>
    <Pop layer delay={0} outAt={1.42} outDur={0.28} y={30}>
      <div style={{ ...kicker, color: "rgba(255,255,255,0.45)", marginBottom: 18 }}>
        You spent
      </div>
      <div
        style={{
          fontFamily: HZ.font,
          fontSize: 200,
          fontWeight: 800,
          lineHeight: 0.86,
          whiteSpace: "nowrap",
        }}
      >
        <Grad>6&nbsp;HOURS</Grad>
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 70, fontWeight: 600, color: "#fff", marginTop: 24 }}>
        editing this video.
      </div>
    </Pop>
    <Pop layer delay={1.7} inDur={0.26} scaleFrom={1.25} y={0} blurMax={14}>
      <div style={{ fontFamily: HZ.font, fontSize: 132, fontWeight: 800, color: "#fff", lineHeight: 0.95 }}>
        It flopped
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 132, fontWeight: 800, color: "#fb7185", lineHeight: 1.0, marginTop: 6 }}>
        in 5 seconds.
      </div>
    </Pop>
  </Sprite>
);

// ── SCENE 2 · PROBLEM ─────────────────────────────────────────────────────────
const ProblemRow: React.FC<{ delay: number; text: string }> = ({ delay, text }) => {
  const { localTime } = useSprite();
  const lt = localTime - delay;
  const e = Easing.easeOutBack(clamp(lt / 0.34, 0, 1));
  const op = clamp(lt / 0.28, 0, 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "26px 38px",
        borderRadius: 26,
        background: "rgba(251,113,133,0.1)",
        border: "1.5px solid rgba(251,113,133,0.35)",
        opacity: op,
        transform: `translateX(${(1 - e) * -60}px)`,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          flexShrink: 0,
          background: "rgba(251,113,133,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fb7185",
          fontSize: 40,
          fontWeight: 800,
          fontFamily: HZ.font,
        }}
      >
        ×
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 64, fontWeight: 700, color: "#fff", textAlign: "left" }}>
        {text}
      </div>
    </div>
  );
};

const SceneProblem: React.FC = () => {
  const reasons = [
    { d: 0.0, t: "Weak hook" },
    { d: 0.55, t: "Wrong hashtags" },
    { d: 1.1, t: "Posted at 3 A.M." },
  ];
  return (
    <Sprite start={SCENES.problem.start} end={SCENES.problem.end}>
      <Pop layer delay={0} inDur={0.3} outAt={2.0} outDur={0.4} y={0} scaleFrom={1}>
        <div style={{ ...kicker, color: "rgba(255,255,255,0.4)", marginBottom: 56 }}>
          Why it died
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 34, alignItems: "stretch", width: 760 }}>
          {reasons.map((r) => (
            <ProblemRow key={r.t} delay={r.d} text={r.t} />
          ))}
        </div>
      </Pop>
    </Sprite>
  );
};

// ── SCENE 3 · BRAND REVEAL ────────────────────────────────────────────────────
const RevealWordmark: React.FC = () => {
  const time = useTime();
  const l = clamp(interpolate([6.4, 7.6], [0, 1], Easing.easeInOutCubic)(time), 0, 1);
  return (
    <div
      style={{
        fontFamily: HZ.font,
        fontSize: 128,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: lerpColor([255, 255, 255], [15, 23, 42], l),
        marginTop: 56,
      }}
    >
      Hyperyzer
    </div>
  );
};

const RevealTagline: React.FC = () => {
  const time = useTime();
  const l = clamp(interpolate([6.8, 7.8], [0, 1], Easing.easeInOutCubic)(time), 0, 1);
  return (
    <div style={{ ...kicker, fontSize: 34, color: lerpColor([249, 168, 212], [190, 24, 93], l), marginTop: 14 }}>
      AI growth toolkit for creators
    </div>
  );
};

const RevealMark: React.FC = () => {
  const { localTime } = useSprite();
  const glow = interpolate([0, 0.5, 1.4, 2.35], [0, 1, 0.85, 0.7], Easing.easeOutCubic)(localTime);
  return <BrandMark size={300} glow={glow} t={localTime} />;
};

const SceneReveal: React.FC = () => (
  <Sprite start={SCENES.reveal.start} end={SCENES.reveal.end}>
    <Pop layer delay={0} inDur={0.5} scaleFrom={0.55} blurMax={16} y={0}>
      <RevealMark />
      <Pop delay={0.55} inDur={0.4} y={28} layer={false}>
        <RevealWordmark />
      </Pop>
      <Pop delay={0.95} inDur={0.4} y={20} layer={false}>
        <RevealTagline />
      </Pop>
    </Pop>
  </Sprite>
);

// ── SCENE 4 · PRODUCT DEMO ────────────────────────────────────────────────────
const SCORES = [
  { label: "Hook", value: 88, color: HZ.pink, revealAt: 0.9, countStart: 0.9 },
  { label: "Retention", value: 74, color: "#10b981", revealAt: 1.4, countStart: 2.1 },
  { label: "Viral", value: 91, color: HZ.orange, revealAt: 1.9, countStart: 3.3 },
];
const TAGS = ["#minecraft", "#hardcore", "#100days", "#gaming", "#fyp"];

const ScoreTile: React.FC<{
  label: string;
  value: number;
  color: string;
  revealAt: number;
  countStart: number;
}> = ({ label, value, color, revealAt, countStart }) => {
  const { localTime } = useSprite();
  const e = Easing.easeOutBack(clamp((localTime - revealAt) / 0.4, 0, 1));
  const op = clamp((localTime - revealAt) / 0.3, 0, 1);
  const cp = Easing.easeOutCubic(clamp((localTime - countStart) / 0.8, 0, 1));
  return (
    <div
      style={{
        flex: 1,
        padding: "30px 24px",
        borderRadius: 30,
        background: "#fff",
        border: "1.5px solid rgba(15,23,42,0.07)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
        opacity: op,
        transform: `translateY(${(1 - e) * 30}px) scale(${0.9 + 0.1 * e})`,
      }}
    >
      <div style={{ ...kicker, fontSize: 22, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontFamily: HZ.font, fontWeight: 800, color: HZ.slate, lineHeight: 1, marginTop: 12 }}>
        <span style={{ fontSize: 108 }}>
          <CountUp to={value} start={countStart} dur={0.8} />
        </span>
        <span style={{ fontSize: 40, color: "#cbd5e1" }}>/100</span>
      </div>
      <div style={{ marginTop: 18, height: 12, borderRadius: 8, background: "rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 8, background: color, width: `${value * cp}%` }} />
      </div>
    </div>
  );
};

const Chip: React.FC<{ delay: number; text: string }> = ({ delay, text }) => {
  const { localTime } = useSprite();
  const e = Easing.easeOutBack(clamp((localTime - delay) / 0.32, 0, 1));
  const op = clamp((localTime - delay) / 0.24, 0, 1);
  return (
    <span
      style={{
        fontFamily: HZ.font,
        fontSize: 36,
        fontWeight: 700,
        color: HZ.pinkDeep,
        padding: "12px 24px",
        borderRadius: 16,
        background: "rgba(236,72,153,0.1)",
        border: "1.5px solid rgba(236,72,153,0.25)",
        opacity: op,
        transform: `scale(${0.5 + 0.5 * e})`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

const SceneDemo: React.FC = () => (
  <Sprite start={SCENES.demo.start} end={SCENES.demo.end}>
    <Pop layer delay={0.15} inDur={0.5} outAt={7.9} outDur={0.4} y={60} scaleFrom={0.9}>
      <div style={{ ...kicker, fontSize: 30, color: HZ.pinkDeep, marginBottom: 26 }}>
        In seconds, you get
      </div>
      <div
        style={{
          width: 940,
          padding: 56,
          borderRadius: 52,
          textAlign: "left",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: "0 40px 100px rgba(190,24,93,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        {/* title row */}
        <Pop delay={0.45} inDur={0.4} y={20} scaleFrom={0.96} blurMax={6}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              paddingBottom: 30,
              borderBottom: "2px solid rgba(15,23,42,0.07)",
            }}
          >
            <div style={{ fontFamily: HZ.font, fontSize: 42, fontWeight: 700, color: HZ.slate, lineHeight: 1.12 }}>
              &ldquo;I Survived 100 Days
              <br />
              in Hardcore Minecraft&rdquo;
            </div>
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                borderRadius: 16,
                background: "rgba(236,72,153,0.12)",
                border: "1.5px solid rgba(236,72,153,0.25)",
                color: HZ.pinkDeep,
                fontFamily: HZ.font,
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              <IconSparkle size={26} /> AI
            </div>
          </div>
        </Pop>

        {/* score tiles */}
        <div style={{ display: "flex", gap: 24, marginTop: 34 }}>
          {SCORES.map((s) => (
            <ScoreTile key={s.label} {...s} />
          ))}
        </div>

        {/* hashtags */}
        <Pop delay={4.5} inDur={0.4} y={24} scaleFrom={0.96} blurMax={5}>
          <div style={{ marginTop: 34, padding: 32, borderRadius: 30, background: "rgba(248,250,252,0.8)", border: "1.5px solid rgba(15,23,42,0.06)" }}>
            <div style={{ ...kicker, fontSize: 24, color: "#94a3b8", marginBottom: 20 }}># Best hashtags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {TAGS.map((tg, i) => (
                <Chip key={tg} delay={4.62 + i * 0.13} text={tg} />
              ))}
            </div>
          </div>
        </Pop>

        {/* best time */}
        <Pop delay={6.3} inDur={0.45} y={28} scaleFrom={0.95} blurMax={6}>
          <div style={{ marginTop: 24, padding: "30px 34px", borderRadius: 30, display: "flex", alignItems: "center", gap: 26, background: HZ.grad }}>
            <IconClock size={60} />
            <div>
              <div style={{ ...kicker, fontSize: 22, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                Best time to post
              </div>
              <div style={{ fontFamily: HZ.font, fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                Tue &amp; Thu · 6&ndash;9 PM
              </div>
            </div>
          </div>
        </Pop>
      </div>
    </Pop>
  </Sprite>
);

// ── SCENE 5 · STUDIO ──────────────────────────────────────────────────────────
const SCRIPT_LINES = [
  { d: 1.0, label: "HOOK", c: HZ.pink, t: "“Day 1: if I die, I delete the channel.”" },
  { d: 1.5, label: "BEAT", c: HZ.orange, t: "Night one almost ends the whole run." },
  { d: 2.0, label: "TWIST", c: "#10b981", t: "Diamond armor by Day 30 — then disaster." },
  { d: 2.5, label: "CTA", c: HZ.pinkDeep, t: "“Comment the day I should quit.”" },
];

const TypeLine: React.FC<{ d: number; label: string; c: string; t: string }> = ({
  d,
  label,
  c,
  t,
}) => {
  const { localTime } = useSprite();
  const chars = Math.max(0, Math.floor((localTime - d) / 0.016));
  const shown = localTime > d ? t.slice(0, chars) : "";
  const typing = localTime > d && chars < t.length;
  const op = clamp((localTime - d) / 0.15, 0, 1);
  return (
    <div style={{ opacity: op, display: "flex", gap: 18, alignItems: "flex-start" }}>
      <span style={{ fontFamily: HZ.mono, fontSize: 26, fontWeight: 700, color: c, flexShrink: 0, paddingTop: 8 }}>
        {label}
      </span>
      <span style={{ fontFamily: HZ.font, fontSize: 40, fontWeight: 600, color: HZ.slate, lineHeight: 1.4 }}>
        {shown}
        {typing && <span style={{ color: HZ.pink }}>▋</span>}
      </span>
    </div>
  );
};

const OptStat: React.FC<{ delay: number; l: string; f: number; t: number }> = ({
  delay,
  l,
  f,
  t,
}) => {
  const { localTime } = useSprite();
  const passed = localTime > delay;
  const e = Easing.easeOutBack(clamp((localTime - delay) / 0.4, 0, 1));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 22px",
        borderRadius: 16,
        background: passed ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.05)",
        border: `1.5px solid ${passed ? "rgba(16,185,129,0.4)" : "rgba(15,23,42,0.1)"}`,
        transform: `scale(${passed ? 1 + 0.12 * (1 - e) : 1})`,
      }}
    >
      <span style={{ fontFamily: HZ.font, fontSize: 28, fontWeight: 700, color: "#64748b" }}>{l}</span>
      <span style={{ fontFamily: HZ.font, fontSize: 36, fontWeight: 800, color: passed ? "#059669" : HZ.slate }}>
        {passed ? `${t} ▲` : f}
      </span>
    </div>
  );
};

const OptimizeStrip: React.FC<{ delay: number }> = ({ delay }) => {
  const { localTime } = useSprite();
  const op = clamp((localTime - delay + 0.2) / 0.35, 0, 1);
  const stats = [
    { l: "Hook", f: 88, t: 96 },
    { l: "Retention", f: 74, t: 90 },
    { l: "Viral", f: 91, t: 97 },
  ];
  return (
    <div style={{ marginTop: 36, opacity: op, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 26px",
          borderRadius: 18,
          background: HZ.grad,
          color: "#fff",
          fontFamily: HZ.font,
          fontWeight: 800,
          fontSize: 34,
        }}
      >
        <IconZap size={32} /> One-Click Optimize
      </div>
      {stats.map((s) => (
        <OptStat key={s.l} delay={delay} {...s} />
      ))}
    </div>
  );
};

const SceneStudio: React.FC = () => (
  <Sprite start={SCENES.studio.start} end={SCENES.studio.end}>
    <Pop layer delay={0.2} inDur={0.45} outAt={5.8} outDur={0.4} y={50} scaleFrom={0.92}>
      <div style={{ ...kicker, fontSize: 30, color: HZ.pinkDeep, marginBottom: 20 }}>
        Pro · The Studio
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 92, fontWeight: 800, color: HZ.slate, lineHeight: 1.04, marginBottom: 44 }}>
        Don&rsquo;t just score it &mdash;
        <br />
        <Grad>it writes it for you.</Grad>
      </div>
      <Pop delay={0.7} inDur={0.45} y={30} scaleFrom={0.95} blurMax={6}>
        <div
          style={{
            width: 940,
            padding: 44,
            borderRadius: 44,
            textAlign: "left",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1.5px solid rgba(255,255,255,0.9)",
            boxShadow: "0 40px 100px rgba(190,24,93,0.16)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: HZ.grad }} />
            <div style={{ ...kicker, fontSize: 24, color: "#94a3b8" }}>AI Script Writer</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {SCRIPT_LINES.map((l) => (
              <TypeLine key={l.label} {...l} />
            ))}
          </div>
          <OptimizeStrip delay={3.5} />
        </div>
      </Pop>
    </Pop>
  </Sprite>
);

// ── SCENE 6 · PRICING ─────────────────────────────────────────────────────────
const TIERS = [
  { name: "Free", price: "€0", sub: "10 credits", hot: true, d: 0.3 },
  { name: "Creator", price: "€14", sub: "150 / mo", hot: false, d: 0.8 },
  { name: "Pro", price: "€39", sub: "800 / mo + Studio", hot: false, d: 1.3 },
];

const TierCard: React.FC<{
  name: string;
  price: string;
  sub: string;
  hot: boolean;
  d: number;
}> = ({ name, price, sub, hot, d }) => {
  const { localTime } = useSprite();
  const e = Easing.easeOutBack(clamp((localTime - d) / 0.4, 0, 1));
  const op = clamp((localTime - d) / 0.3, 0, 1);
  return (
    <div
      style={{
        width: 290,
        padding: "40px 30px",
        borderRadius: 36,
        position: "relative",
        background: hot ? HZ.grad : "rgba(255,255,255,0.85)",
        border: hot ? "none" : "1.5px solid rgba(15,23,42,0.08)",
        boxShadow: hot ? "0 30px 70px rgba(236,72,153,0.35)" : "0 14px 40px rgba(15,23,42,0.06)",
        opacity: op,
        transform: `translateY(${(1 - e) * 50}px) scale(${0.85 + 0.15 * e})`,
      }}
    >
      {hot && (
        <div
          style={{
            position: "absolute",
            top: -22,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 20px",
            borderRadius: 999,
            background: "#fff",
            color: HZ.pinkDeep,
            fontFamily: HZ.font,
            fontWeight: 800,
            fontSize: 24,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          }}
        >
          START HERE
        </div>
      )}
      <div style={{ fontFamily: HZ.font, fontSize: 40, fontWeight: 700, color: hot ? "#fff" : HZ.slate }}>{name}</div>
      <div style={{ fontFamily: HZ.font, fontSize: 96, fontWeight: 800, lineHeight: 1, marginTop: 8, color: hot ? "#fff" : HZ.slate }}>
        {price}
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 32, fontWeight: 600, marginTop: 12, color: hot ? "rgba(255,255,255,0.9)" : "#94a3b8" }}>
        {sub}
      </div>
    </div>
  );
};

const ScenePricing: React.FC = () => (
  <Sprite start={SCENES.pricing.start} end={SCENES.pricing.end}>
    <Pop layer delay={0.2} inDur={0.45} outAt={3.8} outDur={0.35} y={50} scaleFrom={0.92}>
      <div style={{ fontFamily: HZ.font, fontSize: 150, fontWeight: 800, lineHeight: 0.95 }}>
        <Grad>Start free.</Grad>
      </div>
      <div style={{ fontFamily: HZ.font, fontSize: 56, fontWeight: 600, color: HZ.slate, marginTop: 22, marginBottom: 64 }}>
        10 credits. No card. No risk.
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        {TIERS.map((p) => (
          <TierCard key={p.name} {...p} />
        ))}
      </div>
    </Pop>
  </Sprite>
);

// ── SCENE 7 · CTA ─────────────────────────────────────────────────────────────
const CtaMark: React.FC = () => {
  const { localTime } = useSprite();
  const glow = interpolate([0, 0.6, 4.1], [0, 1, 0.85], Easing.easeOutCubic)(localTime);
  return <BrandMark size={220} glow={glow} t={localTime} />;
};

const SceneCTA: React.FC = () => (
  <Sprite start={SCENES.cta.start} end={SCENES.cta.end}>
    <Pop layer delay={0.3} inDur={0.55} y={0} scaleFrom={0.7} blurMax={14}>
      <CtaMark />
      <Pop delay={0.6} inDur={0.45} y={26} layer={false}>
        <div style={{ fontFamily: HZ.font, fontSize: 84, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginTop: 44, lineHeight: 1.1, whiteSpace: "nowrap" }}>
          Make every video hit &mdash;
          <br />
          <Grad>before you post it.</Grad>
        </div>
      </Pop>
      <Pop delay={1.4} inDur={0.45} y={24} layer={false}>
        <div
          style={{
            marginTop: 56,
            padding: "30px 56px",
            borderRadius: 999,
            background: HZ.grad,
            fontFamily: HZ.font,
            fontSize: 50,
            fontWeight: 800,
            color: "#fff",
            boxShadow: "0 24px 60px rgba(236,72,153,0.45)",
          }}
        >
          Analyze your next video &mdash; free
        </div>
      </Pop>
      <Pop delay={1.9} inDur={0.4} y={16} layer={false}>
        <div style={{ fontFamily: HZ.mono, fontSize: 40, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginTop: 34, letterSpacing: "0.04em" }}>
          hyperyzer.com
        </div>
      </Pop>
    </Pop>
  </Sprite>
);

// ── ROOT ──────────────────────────────────────────────────────────────────────
export const hyperyzerDefaultProps = {} as const;

export const HyperyzerAd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;

  // Gate the render until both brand fonts are ready.
  const [handle] = React.useState(() => delayRender("Loading fonts"));
  React.useEffect(() => {
    waitForFonts()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  // The whole piece is choreographed against a fixed 1080×1920 canvas. For the
  // hero 9:16 composition scale === 1 (pixel-perfect); 1:1 / 16:9 letterbox the
  // same design to fit, so every registered format renders something valid.
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  return (
    <AbsoluteFill style={{ background: HZ.dark, alignItems: "center", justifyContent: "center" }}>
      {/* Synthesized music bed + SFX, baked offline by scripts/render-audio.mjs. */}
      <Audio src={staticFile("soundtrack.wav")} />
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          position: "relative",
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "center",
          fontFamily: HZ.font,
        }}
      >
        <TimelineContext.Provider value={{ time }}>
          <Backdrop />
          <SceneHook />
          <SceneProblem />
          <SceneReveal />
          <SceneDemo />
          <SceneStudio />
          <ScenePricing />
          <SceneCTA />
        </TimelineContext.Provider>
      </div>
    </AbsoluteFill>
  );
};
