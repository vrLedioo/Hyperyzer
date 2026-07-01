import React from "react";
import { Composition } from "remotion";
import { HyperyzerAd, hyperyzerDefaultProps } from "./HyperyzerAd";
import { HyperyzerAdV2 } from "./HyperyzerAdV2";
import { DURATION, FPS } from "./lib/timing";

/**
 * One shared component, three aspect ratios. 9:16 is the hero format and the
 * intended deliverable (pixel-perfect, scale === 1). 1:1 and 16:9 letterbox the
 * same 1080×1920 design to fit, so every registered format renders something
 * valid even though the choreography is tuned for vertical.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HyperyzerAd-9x16"
        component={HyperyzerAd}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={hyperyzerDefaultProps}
      />
      <Composition
        id="HyperyzerAd-1x1"
        component={HyperyzerAd}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={hyperyzerDefaultProps}
      />
      <Composition
        id="HyperyzerAd-16x9"
        component={HyperyzerAd}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={hyperyzerDefaultProps}
      />
      {/* V2 — post growth-engine flagship (grade ring, fix-it, share card). */}
      <Composition
        id="HyperyzerAdV2-9x16"
        component={HyperyzerAdV2}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="HyperyzerAdV2-1x1"
        component={HyperyzerAdV2}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="HyperyzerAdV2-16x9"
        component={HyperyzerAdV2}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
