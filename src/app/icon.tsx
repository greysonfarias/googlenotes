import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 112,
        }}
      >
        {/* Notepad body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            width: 320,
            height: 380,
            background: "#fffbf5",
            borderRadius: 28,
            border: "14px solid #e8d5b7",
            overflow: "hidden",
          }}
        >
          {/* Top binding strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              height: 54,
              background: "#2383e2",
              flexShrink: 0,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 34,
                  borderRadius: 11,
                  background: "white",
                  opacity: 0.9,
                }}
              />
            ))}
          </div>

          {/* Lines area */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "28px 30px",
              gap: 28,
              flex: 1,
            }}
          >
            {[100, 100, 100, 65].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 14,
                  width: `${w}%`,
                  background: "#2383e2",
                  borderRadius: 7,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
