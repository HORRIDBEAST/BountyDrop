"use client";

// Background 3D scene for the landing-page hero. Isolated into its own
// client component so a Spline load failure (slow network, WebGL unsupported)
// never breaks the rest of the page — it just quietly stays on the CSS
// gradient/glow-blob fallback that was already there underneath it.

import { Suspense, useState } from "react";
import Spline from "@splinetool/react-spline/next";

const SCENE_URL = "https://prod.spline.design/F2tNpcGFhhddI6Dt/scene.splinecode";

export function SplineHero() {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <div className="absolute inset-0 -z-10">
      <Suspense fallback={null}>
        <Spline
          scene={SCENE_URL}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
        />
      </Suspense>
    </div>
  );
}
