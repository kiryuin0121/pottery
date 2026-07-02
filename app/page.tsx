// app/page.tsx
"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";

import type { HandTrackingData } from "@/types/hand";
import Scene from "@/components/Scene";
import UI from "@/components/UI";

/**
 * アプリのルート。ここで「検出結果の共有 ref」を1つ生成し、書き込み側(UI 内の
 * 検出ループ)と読み取り側(Scene 内の useFrame)の両方に同じ ref を渡す。
 * これが2つのレンダーループをつなぐ唯一の接点。
 *
 * Canvas はここに置く(指定通り)。Canvas の中=3D は Scene、外=2D DOM は UI に分離。
 */
const App = () => {
  // 共有コンテナ。初期は空。以後 .current の中身を書き換えていく。
  const dataRef = useRef<HandTrackingData>({ hands: [], lastUpdated: 0 });

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* 3D レイヤー */}
      <Canvas shadows camera={{ position: [0, 0, 10], fov: 50 }}>
        <Scene dataRef={dataRef} />
      </Canvas>

      {/* 2D レイヤー(Canvas の上に重ねる) */}
      <UI dataRef={dataRef} />
    </main>
  );
};

export default App;
