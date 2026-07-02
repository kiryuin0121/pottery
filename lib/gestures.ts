// lib/gestures.ts
/*
 * MediaPipe のランドマークからジェスチャーを判定する純粋関数群。
 * エフェクト発動条件(グー/指の近接)をここに集約する。
 * 毎フレーム呼ばれるため、内部で new をしない。
 */

import type { HandFrame } from "@/types/hand";
import { computeCurl, FINGER_DEFS } from "@/lib/handControl";

/** グー判定に使う4本指(親指を除く)。親指はグーでも曲がり量が浅くノイズ源になる。 */
const FIST_FINGERS = FINGER_DEFS.slice(0, 4);

/** この値以上でグー成立、この値未満で「手を開いた」とみなす(ヒステリシス)。 */
export const FIST_CLOSE_THRESHOLD = 0.6;
export const FIST_OPEN_THRESHOLD = 0.3;

/**
 * 4本指の平均カール量 (0〜1)。1 に近いほど強く握っている。
 * グー中は親指-人差し指が常に近接するため、ピンチ稲妻の誤発動抑制に使う。
 */
export const computeFistAmount = (lms: HandFrame["worldLandmarks"]): number => {
  let sum = 0;
  for (const finger of FIST_FINGERS) {
    sum += computeCurl(lms, finger.landmarks);
  }
  return sum / FIST_FINGERS.length;
};
