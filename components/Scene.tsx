import { type RefObject } from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import type { HandTrackingData } from "@/types/hand";
import Hand from "./scene/Hand";
import EffectsController from "./effects/EffectsController";
import PostProcessing from "./effects/PostProcessing";

type Props = {
  /** page.tsx で生成し、UI(書き込み)と Scene(読み取り)で共有する ref。 */
  dataRef: RefObject<HandTrackingData>;
};

/**
 * 3D シーン全体。Canvas の内側に置く要素をまとめる。
 * 2D(DOM)要素はここに置かない(Scene と UI の責務分離指定に従う)。
 *
 * ライティングは3点照明(キー/フィル/リム)+ 控えめな IBL の構成:
 *  - キー: 暖色寄りの主光源。陰影の方向を決める
 *  - フィル: 寒色の弱い補助光。影側を持ち上げて黒潰れを防ぐ
 *  - リム: 背後からの青いスポット。輪郭を立たせ、青エフェクトと色を揃える
 * 背景は暗めに落とし、炎・稲妻(加算合成 + Bloom)のコントラストを最大化する。
 */
const Scene = ({ dataRef }: Props) => {
  return (
    <>
      {/* 暗い背景 + 奥をなじませる薄いフォグ。エフェクトの発色が最も映える土台。 */}
      <color attach="background" args={["#0a0d14"]} />
      <fog attach="fog" args={["#0a0d14", 16, 34]} />

      {/* --- 3点照明 --- */}
      {/* キーライト(暖色・影あり) */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.4}
        color="#fff2e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      {/* フィルライト(寒色・弱) */}
      <directionalLight position={[-5, 2, 4]} intensity={0.5} color="#bcd4ff" />
      {/* リムライト(背後上方の青スポット) */}
      <spotLight
        position={[0, 5, -7]}
        angle={0.6}
        penumbra={0.8}
        intensity={14}
        color="#5b8cff"
        distance={25}
        decay={2}
      />
      {/* 環境光は最小限。IBL(下記 Environment)が担う。 */}
      <ambientLight intensity={0.12} />
      {/* IBL: 反射・全体のベース照度。強度は抑えて3点照明を主役にする。 */}
      <Environment preset="studio" environmentIntensity={0.3} />

      {/* 検出された手に対応する3Dモデル(両手ぶん) */}
      <Hand dataRef={dataRef} side="right" />
      <Hand dataRef={dataRef} side="left" />

      {/* ジェスチャー連動エフェクト(稲妻) */}
      <EffectsController dataRef={dataRef} />

      {/* Bloom / Vignette などのポストプロセス */}
      <PostProcessing />

      {/* 開発中の視点操作用。本番では制限/削除を検討。 */}
      <OrbitControls />
    </>
  );
};
export default Scene;
