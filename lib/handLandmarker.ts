// lib/handLandmarker.ts

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

/**
 * MediaPipe Hand Landmarker のインスタンスを生成する。
 *
 * 【MediaPipe の仕組み】
 * Hand Landmarker は2つのMLモデルを連携させて動く:
 *  1. Palm Detection (手のひら検出): 画像全体から手の位置を大まかに見つける。重い処理。
 *  2. Hand Landmarks (関節検出): 切り出した手領域から21個の関節座標を高精度で推論する。
 * VIDEO モードでは一度手を見つけたら次フレームは前回位置を流用し、見失った時だけ
 * 重い Palm Detection を再実行する。これでリアルタイム性を確保している。
 *
 * 【なぜ FilesetResolver が必要か】
 * MediaPipe の推論エンジンは WebAssembly(WASM) 製。FilesetResolver はその .wasm
 * バイナリ群の置き場所を解決する役割。ここでは CDN を指定するが本番は自前ホストも可。
 *
 * @returns 初期化済みの HandLandmarker インスタンス
 */
export const createHandLandmarker = async (): Promise<HandLandmarker> => {
  // WASM ランタイム一式を解決する。これがないと推論エンジンが起動できない。
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  );

  // 学習済みモデル(.task)を読み込んでタスクを構築する。
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      // hand_landmarker.task は palm detection と landmark detection を
      // 束ねたモデルバンドル。Google 公式配布のものを使う。
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      // GPU(WebGL) 推論。CPU より大幅に高速。
      delegate: "GPU",
    },
    // VIDEO: 連続フレーム向けモード。タイムスタンプで前後関係を追跡する。
    runningMode: "VIDEO",
    // 陶芸は両手を使うので2手まで。
    numHands: 2,
  });
};