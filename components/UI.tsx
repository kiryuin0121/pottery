// components/UI.tsx

import { useRef, useState, type RefObject } from "react";
import Webcam from "react-webcam";
import { useHandTracking } from "@/hooks/useHandTracking";
import type { HandTrackingData } from "@/types/hand";

type UIProps = {
  /** page.tsx と共有する検出結果コンテナ(ここが書き込み側)。 */
  dataRef: RefObject<HandTrackingData>;
};

/**
 * 2D(DOM)レイヤー。Webカメラ映像・設定パネル・検出ループの起動を担う。
 * 3D要素は含めない(Scene と責務分離する指定に従う)。
 */
const UI = ({ dataRef }: UIProps) => {
  const webcamRef = useRef<Webcam>(null);
  // react-webcam 内部の video 要素を取り出して検出フックへ渡す。
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // カメラ映像準備フラグ。準備前に推論を始めないため。
  const [cameraReady, setCameraReady] = useState(false);

  // 検出ループ起動(書き込み側)。cameraReady まで待機する。
  useHandTracking(videoRef, dataRef, cameraReady);
  return (
    <>
      {/* Webカメラ(画面右下)。mirrored で鏡像にし自然な操作感に。 */}
      <div className="absolute bottom-4 right-4 w-48 overflow-hidden rounded-lg">
        <Webcam
          ref={webcamRef}
          mirrored
          className="w-full"
          onUserMedia={() => {
            // 映像取得成功時に video 要素を捕まえフラグを立てる。
            videoRef.current = webcamRef.current?.video ?? null;
            setCameraReady(true);
          }}
        />
      </div>
    </>
  );
};
export default UI;