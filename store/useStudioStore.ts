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
  setPressure: (v: number) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  pressure: 0.48,
  setPressure: (v) => set({ pressure: v }),
}));
