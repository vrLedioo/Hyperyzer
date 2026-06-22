import { ImageResponse } from "next/og";

// Branded favicon (replaces the default Next.js icon): the Hyperyzer mark —
// a dark rounded square with a white "play" triangle.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderLeft: "11px solid #ffffff",
            marginLeft: 3,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
