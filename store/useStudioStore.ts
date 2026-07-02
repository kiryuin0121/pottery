// store/useStudioStore.ts

import { create } from "zustand";

/**
 * スタジオのUI設定値ストア。
 *
 * ここに入れるのは「ユーザー操作でたまに変わる低頻度な値」だけ。
 * 手のランドマークや粘土の頂点など高頻度データは ref で扱い、ここには入れない。
 * (高頻度データを store に入れると毎フレーム再レンダリングが起きるため)
 */
export type StudioState = {
  /** 粘土の押し込み強度の係数 (UIの Pressure に対応)。 */
  pressure: number;
  /** ろくろの自動回転 ON/OFF。 */
  autoRotate: boolean;
  /** ろくろの回転速度。 */
  wheelSpeed: number;
  /** 指の近接で出す放電エフェクトの見た目。"lightning"=青い電気 / "fire"=宿儺風の紅蓮の炎。 */
  arcStyle: "lightning" | "fire";
  setPressure: (v: number) => void;
  setAutoRotate: (v: boolean) => void;
  setWheelSpeed: (v: number) => void;
  setArcStyle: (v: "lightning" | "fire") => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  pressure: 0.48,
  autoRotate: true,
  wheelSpeed: 19.75,
  arcStyle: "fire",
  setPressure: (v) => set({ pressure: v }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setWheelSpeed: (v) => set({ wheelSpeed: v }),
  setArcStyle: (v) => set({ arcStyle: v }),
}));