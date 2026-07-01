import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

/**
 * Brand fonts. The ad uses Plus Jakarta Sans for all UI/headlines and
 * JetBrains Mono for the `hyperyzer.com` URL + the Studio script-line labels.
 *
 * `waitForFonts()` is awaited inside a delayRender() gate so no frame ever
 * rasterizes in a fallback face — important for a deterministic offline render.
 */
const jakarta = loadJakarta("normal", {
  weights: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const mono = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

export const fontFamily = jakarta.fontFamily;
export const fontFamilyMono = mono.fontFamily;

export const waitForFonts = (): Promise<unknown> =>
  Promise.all([jakarta.waitUntilDone(), mono.waitUntilDone()]);
