// components/effects/FlameEffect.tsx
/*
 * GLSL(fbmノイズ)で描く青い炎。1つの手につき1インスタンスをプールしておき、
 * EffectsController から imperative handle 経由で毎フレーム駆動する。
 *
 * 状態は3つ:
 *  - idle     : 非表示
 *  - charging : グー保持中。小さくくすぶる(チャージ量でゆっくり成長)
 *  - burst    : 手を開いた瞬間に発火。約2.6秒かけて立ち上がり→減衰
 *
 * 描画は加算合成の板ポリ(Billboard)+ 点光源。点光源が手のモデルを青く照らし、
 * Bloom(ポストプロセス)がシェーダの高輝度部分を光らせる。
 */

"use client";

import * as THREE from "three";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";

export type FlameHandle = {
  /** チャージ中の表示。level は 0〜1(3秒保持で1)。毎フレーム呼ぶ。 */
  setCharge: (pos: THREE.Vector3, level: number) => void;
  /** 発火。pos は手のひらのワールド座標。 */
  trigger: (pos: THREE.Vector3) => void;
  /** 手を見失った等でチャージを中断する。バースト中は何もしない。 */
  clear: () => void;
};

/** バーストの寿命(秒)。 */
const BURST_LIFE = 2.6;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity; // 0〜1: 全体の強さ(チャージ/バーストのエンベロープ)
varying vec2 vUv;

// --- value noise + fbm -------------------------------------------------
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    amp *= 0.5;
  }
  return v;
}

void main() {
  // uv: x -1〜1(中心0)、y 0(根本)〜1(先端)
  vec2 uv = vec2(vUv.x * 2.0 - 1.0, vUv.y);

  // 上昇するノイズ。x をやや揺らして炎の「ゆらぎ」を出す。
  float sway = fbm(vec2(uTime * 0.7, uv.y * 2.0)) - 0.5;
  uv.x += sway * 0.35 * uv.y;

  float n = fbm(vec2(uv.x * 2.6, uv.y * 3.2 - uTime * 2.4));

  // 根本が太く先端が細い形。ノイズで縁を食わせる(上ほど強く乱す)。
  float width = mix(0.62, 0.10, smoothstep(0.0, 1.0, uv.y));
  float shape = 1.0 - clamp(abs(uv.x) / max(width, 1e-3), 0.0, 1.0);
  float d = shape - n * (0.25 + uv.y * 0.75);

  // 先端・根本のフェード。
  float body = smoothstep(0.0, 0.35, d)
             * smoothstep(1.0, 0.72, uv.y)
             * smoothstep(0.0, 0.08, uv.y);
  float core = smoothstep(0.25, 0.85, d) * (1.0 - uv.y * 0.55);

  float alpha = body * uIntensity;
  if (alpha < 0.003) discard;

  // 青い炎: 外縁は深い青、中間はシアン、芯は白。Bloom に拾わせるため HDR に持ち上げる。
  vec3 col = mix(vec3(0.05, 0.18, 0.9), vec3(0.25, 0.75, 1.0), core);
  col += vec3(0.9, 0.98, 1.0) * pow(core, 3.0) * 1.6;
  col *= 2.2; // HDR ブースト

  gl_FragColor = vec4(col * alpha, alpha); // 加算合成前提の premultiplied
}
`;

type Mode = "idle" | "charging" | "burst";

const FlameEffect = forwardRef<FlameHandle>((_, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    }),
    [],
  );

  // useFrame 内で読み書きする内部状態(再レンダリング不要なので ref)。
  const state = useRef({
    mode: "idle" as Mode,
    chargeLevel: 0,
    burstT: 0,
    pos: new THREE.Vector3(),
  });

  useImperativeHandle(ref, () => ({
    setCharge: (pos, level) => {
      const s = state.current;
      if (s.mode === "burst") return; // バースト再生を優先
      s.mode = "charging";
      s.pos.copy(pos);
      s.chargeLevel = level;
    },
    trigger: (pos) => {
      const s = state.current;
      s.mode = "burst";
      s.pos.copy(pos);
      s.burstT = 0;
    },
    clear: () => {
      const s = state.current;
      if (s.mode === "charging") {
        s.mode = "idle";
        s.chargeLevel = 0;
      }
    },
  }));

  useFrame((_, delta) => {
    const s = state.current;
    const group = groupRef.current;
    const light = lightRef.current;
    if (!group || !light) return;

    uniforms.uTime.value += delta;

    let intensity = 0;
    let scale = 1;

    if (s.mode === "burst") {
      s.burstT += delta;
      const p = s.burstT / BURST_LIFE;
      if (p >= 1) {
        s.mode = "idle";
      } else {
        // 素早く立ち上がり、後半をなだらかに減衰させるエンベロープ。
        intensity =
          THREE.MathUtils.smoothstep(p, 0, 0.06) *
          (1 - THREE.MathUtils.smoothstep(p, 0.45, 1));
        scale = 1.1 + p * 1.3;
      }
    } else if (s.mode === "charging") {
      // くすぶり。チャージ完了(level=1)後は脈動して「準備完了」を伝える。
      const pulse =
        s.chargeLevel >= 1
          ? 0.85 + 0.15 * Math.sin(uniforms.uTime.value * 14)
          : 1;
      intensity = (0.15 + 0.3 * s.chargeLevel) * pulse;
      scale = 0.35 + 0.35 * s.chargeLevel;
    }

    group.visible = intensity > 0.002;
    group.position.copy(s.pos);
    group.scale.setScalar(scale);
    uniforms.uIntensity.value = intensity;

    // 炎の中腹あたりから青い光。ちらつきをノイズ的に加える。
    light.intensity =
      intensity * (34 + 14 * Math.sin(uniforms.uTime.value * 23.7)) * scale;
  });

  return (
    <group ref={groupRef} visible={false}>
      <Billboard>
        {/* 板の原点=炎の根本になるよう上に半分ずらす */}
        <mesh position={[0, 1.7, 0]}>
          <planeGeometry args={[7.6, 8.4]} />
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
      <pointLight
        ref={lightRef}
        position={[0, 1.2, 0.6]}
        color="#4fa8ff"
        intensity={0}
        distance={12}
        decay={2}
      />
    </group>
  );
});

FlameEffect.displayName = "FlameEffect";

export default FlameEffect;
