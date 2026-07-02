// components/effects/FireArc.tsx
/*
 * 2点間を這う「宿儺(呪術廻戦)風」の赤黒い炎アーク。LightningArc と同じ
 * ジグザグ+枝分かれ形状(lib/lightningGeometry)を流用しつつ、電気の青白では
 * なく黒煙を纏った紅蓮の炎として描く。
 *
 * 描画は fat line(LineSegments2)3層:
 *  - core : 明るい橙〜白(炎の芯。Bloom で強く光る)
 *  - flame: 赤(中間色)
 *  - soot : 黒(外側ににじむ煤。Bloomに拾われず沈む)
 * 形状の作り直し間隔は稲妻より遅くし、電気的な高速フリッカーでなく
 * 「ゆらめき」に見えるようにする。中点の点光源も暖色に。
 */

"use client";

import * as THREE from "three";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { LineSegments2, LineSegmentsGeometry, LineMaterial } from "three-stdlib";
import { generateBolt, BOLT_ARRAY_LENGTH } from "@/lib/lightningGeometry";

export type FireArcHandle = {
  /** アークを有効化して端点と強度(0〜1)を設定する。毎フレーム呼ぶ。 */
  set: (a: THREE.Vector3, b: THREE.Vector3, intensity: number) => void;
  /** 条件を満たさなくなったフレームで呼ぶ。 */
  hide: () => void;
};

/** 形状を作り直す間隔(秒)。稲妻より長めにして「ゆらめき」に見せる。 */
const REBUILD_INTERVAL = 0.09;

const FireArc = forwardRef<FireArcHandle>((_, ref) => {
  const size = useThree((s) => s.size);
  const lightRef = useRef<THREE.PointLight>(null);

  const { geometry, sootMat, flameMat, coreMat, sootLine, flameLine, coreLine } =
    useMemo(() => {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions([0, -9999, 0, 0, -9999, 0]);

      // 外側: 黒煤(太い・低不透明度)。輪郭に凄みを出す。
      const sootMat = new LineMaterial({
        color: 0x0a0000,
        linewidth: 13,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      // 中間: 赤い炎body。
      const flameMat = new LineMaterial({
        color: 0xff1f0a,
        linewidth: 7,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      // 芯: 橙〜白。Bloom がここを強く光らせる。
      const coreMat = new LineMaterial({
        color: 0xffdf8c,
        linewidth: 2.5,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const sootLine = new LineSegments2(geometry, sootMat);
      const flameLine = new LineSegments2(geometry, flameMat);
      const coreLine = new LineSegments2(geometry, coreMat);
      sootLine.frustumCulled = false;
      flameLine.frustumCulled = false;
      coreLine.frustumCulled = false;
      return { geometry, sootMat, flameMat, coreMat, sootLine, flameLine, coreLine };
    }, []);

  useEffect(() => {
    sootMat.resolution.set(size.width, size.height);
    flameMat.resolution.set(size.width, size.height);
    coreMat.resolution.set(size.width, size.height);
  }, [size, sootMat, flameMat, coreMat]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      sootMat.dispose();
      flameMat.dispose();
      coreMat.dispose();
    };
  }, [geometry, sootMat, flameMat, coreMat]);

  const state = useRef({
    active: false,
    intensity: 0,
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    rebuildTimer: 0,
    flicker: 0,
    positions: new Float32Array(BOLT_ARRAY_LENGTH),
  });

  useImperativeHandle(ref, () => ({
    set: (a, b, intensity) => {
      const s = state.current;
      s.active = true;
      s.a.copy(a);
      s.b.copy(b);
      s.intensity = intensity;
    },
    hide: () => {
      state.current.active = false;
    },
  }));

  useFrame((_, delta) => {
    const s = state.current;
    const light = lightRef.current;
    if (!light) return;

    sootLine.visible = flameLine.visible = coreLine.visible = s.active;
    if (!s.active) {
      light.intensity = 0;
      return;
    }

    s.flicker += delta;
    s.rebuildTimer -= delta;
    if (s.rebuildTimer <= 0) {
      s.rebuildTimer = REBUILD_INTERVAL;
      // 電気ほど鋭くなく、炎らしい緩いうねりにする。
      const chaos = 0.16 + 0.1 * s.intensity;
      const written = generateBolt(s.a, s.b, s.positions, chaos);
      if (written > 0) {
        geometry.setPositions(s.positions.subarray(0, written));
      }
    }

    // ゆったりした燃え上がりの脈動(電気の高速フリッカーとは対照的)。
    const pulse = 0.85 + 0.15 * Math.sin(s.flicker * 9.0) + 0.08 * Math.sin(s.flicker * 23.0);

    sootMat.opacity = 0.4 + 0.3 * s.intensity;
    flameMat.opacity = (0.55 + 0.45 * s.intensity) * pulse;
    coreMat.opacity = (0.6 + 0.4 * s.intensity) * pulse;

    s.mid.lerpVectors(s.a, s.b, 0.5);
    light.position.copy(s.mid);
    light.intensity = s.intensity * (16 + 10 * pulse);
  });

  return (
    <group>
      <primitive object={sootLine} />
      <primitive object={flameLine} />
      <primitive object={coreLine} />
      <pointLight
        ref={lightRef}
        color="#ff5a1f"
        intensity={0}
        distance={9}
        decay={2}
      />
    </group>
  );
});

FireArc.displayName = "FireArc";

export default FireArc;
