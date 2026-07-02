// hooks/useHandTracking.ts

import { useEffect, useRef, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { createHandLandmarker } from "@/lib/handLandmarker";
import type { HandTrackingData } from "@/types/hand";

/**
 * Webカメラ映像から手を検出し続け、結果を共有 ref に書き込むフック。
 *
 * このフックは「書き込み側」に徹する。検出結果を return や state で返さず、
 * 引数の可変 ref (dataRef) に直接書き込む。こうして Scene 側(useFrame)が
 * React の再レンダリングを介さず最新ランドマークを読めるようにする。
 *
 * @param videoRef 取得した HTMLVideoElement への ref (react-webcam の内部 video)
 * @param dataRef  検出結果の書き込み先。Scene と共有する可変コンテナ。
 * @param enabled  カメラ準備完了フラグ。映像が来る前に推論しないため。
 */
/**
 * MediaPipe の handedness ラベルを反転する。
 *
 * MediaPipe はセルフィー(鏡像)入力を前提に左右判定するが、react-webcam から
 * detectForVideo に渡るのは生フレーム(非鏡像)。前提が崩れているため判定が
 * そのままでは逆になる。ここで Left/Right を入れ替えて実際の手と一致させる。
 */
const flipHandedness = (categoryName: string | undefined): string => {
  if (categoryName === "Left") return "Right";
  if (categoryName === "Right") return "Left";
  return "Unknown";
};

export const useHandTracking = (
  videoRef: RefObject<HTMLVideoElement | null>,
  dataRef: RefObject<HandTrackingData>,
  enabled: boolean,
): void => {
  // requestAnimationFrame の ID。クリーンアップでループを止めるため保持。
  const rafIdRef = useRef<number | null>(null);
  // HandLandmarker インスタンス。非同期生成なので ref で保持する。
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // アンマウント後に非同期処理が完了した時の後始末用フラグ。
    let isActive = true;

    /** 1フレーム推論し次フレームを予約する再帰ループ。 */
    const detectLoop = (): void => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      // video が再生開始(readyState>=2)していなければスキップ。
      if (video && landmarker && video.readyState >= 2) {
        // detectForVideo は単調増加するタイムスタンプを要求する。MediaPipe は
        // これでフレームの前後関係を判断し追跡(tracking)を成立させる。
        const result = landmarker.detectForVideo(video, performance.now());

        // 手ごとに並ぶ3つの配列(landmarks/worldLandmarks/handedness)を zip する。
        dataRef.current.hands = result.landmarks.map((lm, i) => ({
          landmarks: lm,
          worldLandmarks: result.worldLandmarks[i],
          // handedness は配列の配列。先頭要素の categoryName が "Left"/"Right"。
          // MediaPipe はセルフィー(鏡像)入力を前提に左右判定するが、ここで
          // detectForVideo に渡しているのは react-webcam の生フレーム(非鏡像)。
          // 前提が崩れるため判定が反転して出てくる → ラベルを反転して補正する。
          handedness: flipHandedness(result.handedness[i]?.[0]?.categoryName),
        }));
        dataRef.current.lastUpdated = performance.now();
      }

      if (isActive) rafIdRef.current = requestAnimationFrame(detectLoop);
    };

    // 非同期で landmarker を生成してからループ開始。
    createHandLandmarker()
      .then((landmarker) => {
        // 生成完了前にアンマウントされていたら破棄してリーク防止。
        if (!isActive) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        detectLoop();
      })
      .catch((err) => {
        console.error("HandLandmarker の初期化に失敗しました:", err);
      });

    // クリーンアップ: ループ停止とモデル解放。
    return () => {
      isActive = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [videoRef, dataRef, enabled]);
};