// lib/gestures.ts
/*
 * MediaPipe のランドマークからジェスチャーを判定する純粋関数群。
 * エフェクト発動条件(グー/手のひら上向き/指の近接)をここに集約する。
 * 毎フレーム呼ばれるため、内部で new をしない(作業ベクトルはモジュール内で確保)。
 */

import * as THREE from "three";
import type { HandFrame } from "@/types/hand";
import { computeCurl, FINGER_DEFS } from "@/lib/handControl";

/** グー判定に使う4本指(親指を除く)。親指はグーでも曲がり量が浅くノイズ源になる。 */
const FIST_FINGERS = FINGER_DEFS.slice(0, 4);

/** この値以上でグー成立、この値未満で「手を開いた」とみなす(ヒステリシス)。 */
export const FIST_CLOSE_THRESHOLD = 0.6;
export const FIST_OPEN_THRESHOLD = 0.3;

/** 手のひら上向きとみなす upness の下限 (0〜1)。 */
export const PALM_UP_THRESHOLD = 0.25;

/** チャージ完了に必要な保持時間(秒)。 */
export const CHARGE_DURATION = 3;

/**
 * 4本指の平均カール量 (0〜1)。1 に近いほど強く握っている。
 */
export const computeFistAmount = (lms: HandFrame["worldLandmarks"]): number => {
  let sum = 0;
  for (const finger of FIST_FINGERS) {
    sum += computeCurl(lms, finger.landmarks);
  }
  return sum / FIST_FINGERS.length;
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * 手のひらがどれだけ上を向いているかを -1〜1 で返す(1=真上, -1=真下)。
 *
 * 手のひら法線 = (wrist→indexMCP) × (wrist→pinkyMCP)。この外積の向きは
 * 左右の手で反転するため handedness で符号を補正する。
 *
 * MediaPipe world 座標は y が画像下向きなので「上」は -y。
 * 実機確認済み: 右手は -n.y が上向き度、左手はその反転(この符号で正常動作)。
 */
export const palmUpness = (
  lms: HandFrame["worldLandmarks"],
  handedness: string,
): number => {
  _v1.set(lms[5].x - lms[0].x, lms[5].y - lms[0].y, lms[5].z - lms[0].z);
  _v2.set(lms[17].x - lms[0].x, lms[17].y - lms[0].y, lms[17].z - lms[0].z);
  _n.crossVectors(_v1, _v2);
  if (_n.lengthSq() === 0) return 0;
  _n.normalize();
  const upness = -_n.y; // y下向き座標系なので反転
  return handedness === "Left" ? -upness : upness;
};
