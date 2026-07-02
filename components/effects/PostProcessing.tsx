// components/effects/PostProcessing.tsx
/*
 * ポストプロセスのスタック。
 *  - Bloom: 炎・稲妻の HDR 高輝度部分だけを光らせる(threshold で通常のシーンは光らせない)
 *  - Vignette: 周辺減光で視線を中央(手)へ誘導
 *  - 軽い ChromaticAberration: 画面端のレンズ感。エフェクトの派手さと相性が良い
 */

"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from "@react-three/postprocessing";

const PostProcessing = () => {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={1.1}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.25}
      />
      <ChromaticAberration offset={[0.0008, 0.0008]} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
};

export default PostProcessing;
