// lib/coords.ts

import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/** 粘土まわりのワールド空間スケール。手の可動範囲と粘土の大きさに合わせて調整する。 */
export const SCENE_SCALE = { width: 18, height: 10 } as const;

/**
 * MediaPipe の正規化座標(0〜1)を Three.js のワールド座標へ変換する。
 *
 * 変換で行っている補正は2つ:
 * 1. y 反転: MediaPipe は y=0 が上・y=1 が下。Three.js は y が上向きなので反転する。
 * 2. x 反転: MediaPipe はセルフィー前提でミラーされた座標を返す。自分が右手を上げたら
 *    画面右側で右手モデルが動く、という直感に合わせるため x も反転する。
 * さらに 0.5 を引いて中央を原点にし、スケールを掛けてワールド空間へ広げる。
 *
 * 【重要】手モデルの位置追従も粘土の接触判定も必ずこの関数を通すこと。
 * 別々に変換式を書くと座標系がズレ、「手の位置」と「凹む位置」が食い違う。
 *
 * @param lm    MediaPipe の正規化ランドマーク1点
 * @param out   結果を書き込む Vector3 (useFrame内でのnew生成を避けるため再利用する)
 * @returns out (引数と同じインスタンス)
 */
export const landmarkToWorld = (
  lm: NormalizedLandmark,
  out: THREE.Vector3,
): THREE.Vector3 => {
  return out.set(
    (1 - lm.x - 0.5) * SCENE_SCALE.width, // x反転 + 中央原点化
    (1 - lm.y -0.5) * SCENE_SCALE.height, // y反転 + 中央原点化
    0, // z は推定精度が低いため初期段階は 0 固定
  );
};