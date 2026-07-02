// types/hand.ts

import type { NormalizedLandmark, Landmark } from "@mediapipe/tasks-vision";

/**
 * MediaPipe Hand Landmarker が1フレームで返す、片手ぶんの検出結果。
 *
 * MediaPipe は2系統の座標を返す:
 * - landmarks      : 画像内の正規化座標 (x,y が 0〜1)。「画面のどこに手があるか」用。
 * - worldLandmarks : 手の中心を原点とするメートル単位の3D座標。「手の姿勢(指の曲げ)」用。
 *
 * 3Dモデルのボーンを曲げるには姿勢が要るので worldLandmarks を、
 * 粘土のどこに触れたかの判定には画面位置が要るので landmarks を使い分ける。
 */
export type HandFrame = {
  /** 画像内正規化座標 (0〜1)。粘土への接触位置の算出に使用。 */
  landmarks: NormalizedLandmark[];
  /** 手中心原点・メートル単位の3D座標。手の姿勢復元に使用。 */
  worldLandmarks: Landmark[];
  /** "Left" | "Right"。左右で処理を分けたい時に使用。 */
  handedness: string;
};

/**
 * 検出ループ(書き込み側)と useFrame(読み取り側)で共有する可変コンテナ。
 *
 * なぜ React state でなく ref なのか:
 * 手の検出は毎フレーム(〜60fps)起きる。useState で持つと毎フレーム再レンダリングが
 * 走り性能が破綻する。ref は中身を書き換えても再レンダリングを起こさないため、
 * レンダーループ間のデータ受け渡しに最適。
 */
export type HandTrackingData = {
  /** 検出された手の配列。未検出時は空配列。 */
  hands: HandFrame[];
  /** 最後に検出が成功した時刻 (performance.now())。古いデータ破棄の判定に使う。 */
  lastUpdated: number;
};

/** MediaPipe 21点ランドマークのインデックス定数。可読性のため命名する。 */
export const HAND_LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
} as const;