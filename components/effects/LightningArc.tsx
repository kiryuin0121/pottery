// components/effects/LightningArc.tsx
/*
 * 2点間でバチバチ鳴る電弧1本ぶん。EffectsController が毎フレーム端点と強度を
 * 流し込む。形状は一定間隔(REBUILD_INTERVAL)で作り直してフリッカーさせる。
 *
 * 描画は fat line(LineSegments2)2層:
 *  - core: 細い白(Bloom で強く光る芯)
 *  - glow: 太い青(周囲のにじみ)
 * geometry は2層で共有し、中点に点光源を置いて手モデルを照らす。
 */

"use client";

import * as THREE from "three";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { LineSegments2, LineSegmentsGeometry, LineMaterial } from "three-stdlib";
import { generateBolt, BOLT_ARRAY_LENGTH } from "@/lib/lightningGeometry";

export type LightningHandle = {
  /** アークを有効化して端点と強度(0〜1)を設定する。毎フレーム呼ぶ。 */
  set: (a: THREE.Vector3, b: THREE.Vector3, intensity: number) => void;
  /** 条件を満たさなくなったフレームで呼ぶ。 */
  hide: () => void;
};

/** 形状を作り直す間隔(秒)。短いほど激しくフリッカーする。 */
const REBUILD_INTERVAL = 0.045;

const LightningArc = forwardRef<LightningHandle>((_, ref) => {
  const size = useThree((s) => s.size);
  const lightRef = useRef<THREE.PointLight>(null);

  const { geometry, coreMat, glowMat, coreLine, glowLine } = useMemo(() => {
    const geometry = new LineSegmentsGeometry();
    // 初期は退避位置のダミー1セグメント(空 positions は不可のため)。
    geometry.setPositions([0, -9999, 0, 0, -9999, 0]);

    const coreMat = new LineMaterial({
      color: 0xeaf6ff,
      linewidth: 2.5,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMat = new LineMaterial({
      color: 0x2f7bff,
      linewidth: 8,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coreLine = new LineSegments2(geometry, coreMat);
    const glowLine = new LineSegments2(geometry, glowMat);
    coreLine.frustumCulled = false;
    glowLine.frustumCulled = false;
    return { geometry, coreMat, glowMat, coreLine, glowLine };
  }, []);

  // fat line はピクセル幅指定のため画面解像度が必要。
  useEffect(() => {
    coreMat.resolution.set(size.width, size.height);
    glowMat.resolution.set(size.width, size.height);
  }, [size, coreMat, glowMat]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      coreMat.dispose();
      glowMat.dispose();
    };
  }, [geometry, coreMat, glowMat]);

  const state = useRef({
    active: false,
    intensity: 0,
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    rebuildTimer: 0,
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

    coreLine.visible = glowLine.visible = s.active;
    if (!s.active) {
      light.intensity = 0;
      return;
    }

    s.rebuildTimer -= delta;
    if (s.rebuildTimer <= 0) {
      s.rebuildTimer = REBUILD_INTERVAL;
      // 近いほどジグザグを細かく荒らす(放電が強まる感じ)。
      const chaos = 0.12 + 0.14 * s.intensity;
      const written = generateBolt(s.a, s.b, s.positions, chaos);
      if (written > 0) {
        geometry.setPositions(s.positions.subarray(0, written));
      }
    }

    coreMat.opacity = 0.5 + 0.5 * s.intensity;
    glowMat.opacity = 0.15 + 0.35 * s.intensity;

    // 中点に置いた点光源をランダムにちらつかせて「バチバチ」感を出す。
    s.mid.lerpVectors(s.a, s.b, 0.5);
    light.position.copy(s.mid);
    light.intensity = s.intensity * (10 + Math.random() * 26);
  });

  return (
    <group>
      <primitive object={coreLine} />
      <primitive object={glowLine} />
      <pointLight
        ref={lightRef}
        color="#7fb8ff"
        intensity={0}
        distance={9}
        decay={2}
      />
    </group>
  );
});

LightningArc.displayName = "LightningArc";

export default LightningArc;
