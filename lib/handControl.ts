// lib/handControl.ts
/*
 * RightHand / LeftHand 共通の MediaPipe 連動ロジック(指の曲げ・手首3軸の姿勢)。
 * モデルのノード構成(JSX)は手ごとに異なるため、各コンポーネント側で個別に持つ。
 *
 * 【ボーン特定済み】
 *   人差指 3→4→5 / 中指 7→8→9 / 薬指 11→12→13 / 小指 15→16→17 / 親指 19→20→21
 */

import * as THREE from "three";
import { type HandFrame } from "@/types/hand";
import { degToRad } from "three/src/math/MathUtils.js";

export type Axis = "x" | "y" | "z";

export type FingerDef = {
  boneIndices: [number, number, number];
  landmarks: [number, number, number];
  axis: Axis;
  sign: number;
  maxCurlScale?: number;
  /** ボーンごとのlerpレート [proximal, middle, distal]。先端ほど大きく(速く)する。 */
  curlLerp: [number, number, number];
};

export const FINGER_DEFS: FingerDef[] = [
  { boneIndices: [3, 4, 5], landmarks: [5, 6, 8], axis: "x", sign: -1, curlLerp: [0.4, 0.6, 0.8] },
  { boneIndices: [7, 8, 9], landmarks: [9, 10, 12], axis: "x", sign: -1, curlLerp: [0.4, 0.6, 0.8] },
  { boneIndices: [11, 12, 13], landmarks: [13, 14, 16], axis: "x", sign: -1, curlLerp: [0.4, 0.6, 0.8] },
  { boneIndices: [15, 16, 17], landmarks: [17, 18, 20], axis: "x", sign: -1, curlLerp: [0.4, 0.6, 0.8] },
  { boneIndices: [19, 20, 21], landmarks: [1, 2, 4], axis: "z", sign: -1, maxCurlScale: 0.7, curlLerp: [0.4, 0.6, 0.8] },
];

export const MAX_CURL_ANGLE = Math.PI / 3.0;
export const LEFT_MAX_CURL_ANGLE = Math.PI / 3.0;
export const CURL_DEADZONE = THREE.MathUtils.degToRad(45);

/** 自然体における手首の基準角度(度)。静的オフセット。 */
export const NEUTRAL_WRIST_ANGLE = { x: 35, y: -50, z: 0 };
export const LEFT_NEUTRAL_WRIST_ANGLE = { x: 35, y: -50, z: 90 };

/* ===== 手首3軸の動的制御の設定 =====
 *   flexion   : 掌屈・背屈(手のひら側/甲側に折る)
 *   deviation : 橈屈・尺屈(左右に振る)
 *   rotation  : 回内・回外(前腕のひねり) */
export const WRIST_CONFIG = {
  flexion: { limit: degToRad(40), sign: 1, deadzone: degToRad(8) },
  deviation: { limit: degToRad(25), sign: 1, deadzone: degToRad(8) },
  rotation: { limit: degToRad(150), sign: 1, deadzone: degToRad(10) },
};
export const LEFT_WRIST_CONFIG = {
  flexion: { limit: degToRad(40), sign: 1, deadzone: degToRad(8) },
  deviation: { limit: degToRad(25), sign: 1, deadzone: degToRad(8) },
  rotation: { limit: degToRad(150), sign: 1, deadzone: degToRad(10) },
};
/** 手首追従の滑らかさ(小さいほど滑らかだが遅れる)。 */
export const WRIST_LERP = 0.3;

/**
 * worldLandmarks の3点(mcp,pip,tip)から指の曲がり具合を 0〜1 で求める。
 * まっすぐなら 0、深く曲げるほど 1。デッドゾーン以下のノイズは 0。
 */
export const computeCurl = (
  lms: HandFrame["worldLandmarks"],
  idx: [number, number, number],
): number => {
  const [mcp, pip, tip] = idx;
  const v1x = lms[pip].x - lms[mcp].x;
  const v1y = lms[pip].y - lms[mcp].y;
  const v1z = lms[pip].z - lms[mcp].z;
  const v2x = lms[tip].x - lms[pip].x;
  const v2y = lms[tip].y - lms[pip].y;
  const v2z = lms[tip].z - lms[pip].z;

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.hypot(v1x, v1y, v1z);
  const m2 = Math.hypot(v2x, v2y, v2z);
  if (m1 === 0 || m2 === 0) return 0;

  const cos = THREE.MathUtils.clamp(dot / (m1 * m2), -1, 1);
  const angle = Math.acos(cos);

  if (angle <= CURL_DEADZONE) return 0;
  return THREE.MathUtils.clamp(
    (angle - CURL_DEADZONE) / (Math.PI / 2 - CURL_DEADZONE),
    0,
    1,
  );
};

/** 手首3軸の生角度(ラジアン)。掌背屈/橈尺屈/回内外。 */
export type WristPose = { flexion: number; deviation: number; rotation: number };

// computeWristPose 内で使い回す作業ベクトル(GC負荷を避けるためモジュール内で確保)。
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _normal = new THREE.Vector3();

/**
 * worldLandmarks から手のひらのローカル座標系を組み、手首の3軸角度
 * (掌背屈・橈尺屈・回内外)を符号付きで求める。
 *
 *  - forward : 手首(0) → 中指MCP(9)。手の長手方向。
 *  - side    : 人差し指MCP(5) → 小指MCP(17)。手の幅方向。
 *  - normal  : forward × side。手のひら面の法線。
 */
export const computeWristPose = (lms: HandFrame["worldLandmarks"]): WristPose => {
  _fwd.set(lms[9].x - lms[0].x, lms[9].y - lms[0].y, lms[9].z - lms[0].z);
  _side.set(lms[17].x - lms[5].x, lms[17].y - lms[5].y, lms[17].z - lms[5].z);

  if (_fwd.lengthSq() === 0 || _side.lengthSq() === 0) {
    return { flexion: 0, deviation: 0, rotation: 0 };
  }
  _fwd.normalize();
  _normal.crossVectors(_fwd, _side).normalize();
  _side.crossVectors(_normal, _fwd).normalize(); // 再直交化

  const flexion = Math.asin(THREE.MathUtils.clamp(_fwd.y, -1, 1));
  const deviation = Math.atan2(_fwd.x, -_fwd.z);
  const rotation = Math.atan2(_normal.x, _normal.y);

  return { flexion, deviation, rotation };
};

/**
 * 生角度にデッドゾーン除去と可動域クランプをかける共通処理。
 */
export const shapeWristAngle = (
  value: number,
  cfg: { limit: number; sign: number; deadzone: number },
): number => {
  let v = value;
  if (Math.abs(v) < cfg.deadzone) {
    v = 0;
  } else {
    v -= Math.sign(v) * cfg.deadzone;
  }
  return THREE.MathUtils.clamp(cfg.sign * v, -cfg.limit, cfg.limit);
};
