/* eslint-disable react-hooks/immutability */
// components/scene/Hand.tsx
/*
 * 両手共通の手モデルコンポーネント。
 * Model: "Rigged hand - Game model" by Lorenzo Drago — Sketchfab Standard License
 *
 * 右手モデル1つを両手で使い、左手側は X 負スケールで鏡像化して左手に見せる。
 * 手首回転も、左手側は回転をクォータニオンで作ってから X 鏡像変換する。これで
 * 軸ごとの符号を勘で合わせずに、数学的に正しい鏡像の手首回転が得られる。
 */

import * as THREE from "three";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useGraph, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { GLTF, SkeletonUtils } from "three-stdlib";
import { landmarkToWorld } from "@/lib/coords";
import { type HandTrackingData } from "@/types/hand";
import { degToRad } from "three/src/math/MathUtils.js";
import {
  FINGER_DEFS,
  MAX_CURL_ANGLE,
  LEFT_MAX_CURL_ANGLE,
  NEUTRAL_WRIST_ANGLE,
  WRIST_CONFIG,
  LEFT_WRIST_CONFIG,
  WRIST_LERP,
  computeCurl,
  computeWristPose,
  shapeWristAngle,
  type WristPose,
} from "@/lib/handControl";

const MODEL_PATH = "/models/rightHand/scene.gltf";

/** ベースのスケール。鏡像側は X を負にして左右反転させる。 */
const BASE_SCALE = 0.02;

type GLTFResult = GLTF & {
  nodes: {
    Object_9: THREE.SkinnedMesh;
    _rootJoint: THREE.Bone;
  };
  materials: {
    ["Material.001"]: THREE.MeshStandardMaterial;
  };
};

type Props = {
  /** useHandTracking が書き込む共有 ref (読み取り専用に使う)。 */
  dataRef: RefObject<HandTrackingData>;
  /** "right": 右手モデルをそのまま / "left": X負スケールで鏡像化して左手に。 */
  side: "left" | "right";
  /** 指の最大曲げ角度(ラジアン)。省略時は MAX_CURL_ANGLE。 */
  maxCurlAngle?: number;
};

const Hand = ({ dataRef, side, maxCurlAngle = MAX_CURL_ANGLE }: Props) => {
  const isLeft = side === "left";

  const { scene } = useGLTF(MODEL_PATH);

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone) as unknown as GLTFResult;

  // 鏡像側は面法線反転で透けるため両面描画。
  useEffect(() => {
    if (isLeft) materials["Material.001"].side = THREE.DoubleSide;
  }, [materials, isLeft]);

  const wristGroupRef = useRef<THREE.Group>(null);
  const followRef = useRef<THREE.Group>(null);

  const restRotations = useMemo(() => {
    const bones = nodes.Object_9.skeleton.bones;
    const map = new Map<number, number>();
    for (const finger of FINGER_DEFS) {
      for (const bi of finger.boneIndices) {
        map.set(bi, bones[bi].rotation[finger.axis]);
      }
    }
    return map;
  }, [nodes]);

  const curlState = useRef<Map<number, number>>(new Map(
    FINGER_DEFS.flatMap(f => f.boneIndices.map(bi => [bi, 0] as [number, number]))
  ));

  const wristState = useRef<WristPose>({ flexion: 0, deviation: 0, rotation: 0 });

  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  // 手首回転をオイラー角→クォータニオンにして鏡像変換するための作業オブジェクト。
  const wristEuler = useMemo(() => new THREE.Euler(), []);
  const wristQuat = useMemo(() => new THREE.Quaternion(), []);

  // left描画は "Right"、right描画は "Left" を拾う(位置対応を合わせるため)。
  const targetHandedness = isLeft ? "Right" : "Left";

  useFrame(() => {
    const hand = dataRef.current.hands.find(
      (h) => h.handedness === targetHandedness,
    );
    const follow = followRef.current;
    const wristGroup = wristGroupRef.current;
    if (!follow || !wristGroup) return;

    follow.visible = !!hand;
    if (!hand) return;

    // --- 段階1: 位置追従 ---
    landmarkToWorld(hand.landmarks[0], tmpVec);
    follow.position.lerp(tmpVec, 0.75);

    // --- 段階2: 指の曲げ ---
    const bones = nodes.Object_9.skeleton.bones;
    const cs = curlState.current;
    for (const finger of FINGER_DEFS) {
      const curl = computeCurl(hand.worldLandmarks, finger.landmarks);
      const maxAngle = (isLeft ? LEFT_MAX_CURL_ANGLE : maxCurlAngle) * (finger.maxCurlScale ?? 1);
      finger.boneIndices.forEach((bi, i) => {
        const bone = bones[bi];
        const rest = restRotations.get(bi);
        if (rest === undefined) return;
        const current = cs.get(bi) ?? 0;
        const next = THREE.MathUtils.lerp(current, curl, finger.curlLerp[i]);
        cs.set(bi, next);
        bone.rotation[finger.axis] = rest + finger.sign * next * maxAngle;
      });
    }

    // --- 段階3: 手首3軸の姿勢 ---
    const raw = computeWristPose(hand.worldLandmarks);

    const wristCfg = isLeft ? LEFT_WRIST_CONFIG : WRIST_CONFIG;
    const flexion = shapeWristAngle(raw.flexion, wristCfg.flexion);
    const deviation = shapeWristAngle(raw.deviation, wristCfg.deviation);
    const rotation = shapeWristAngle(raw.rotation, wristCfg.rotation);

    const st = wristState.current;
    st.flexion = THREE.MathUtils.lerp(st.flexion, flexion, WRIST_LERP);
    st.deviation = THREE.MathUtils.lerp(st.deviation, deviation, WRIST_LERP);
    st.rotation = THREE.MathUtils.lerp(st.rotation, rotation, WRIST_LERP);

    // 右手基準の合成角(ラジアン)。x:掌背屈 y:回内外 z:橈尺屈。
    const rx = 
    // degToRad(NEUTRAL_WRIST_ANGLE.x) 
    + st.flexion;
    const ry = 
    // degToRad(NEUTRAL_WRIST_ANGLE.y)
     + st.rotation;
    const rz = 
    // degToRad(NEUTRAL_WRIST_ANGLE.z)
     + st.deviation;

    if (isLeft) {
      // オイラー角をクォータニオンにして X 軸鏡像変換する。
      // X 鏡像では quaternion (x,y,z,w) → (x,-y,-z,w)。これで軸の勘合わせ不要で
      // 数学的に正しい鏡像回転になる。
      wristEuler.set(rx, ry, rz);
      wristQuat.setFromEuler(wristEuler);
      wristQuat.set(-wristQuat.x, -wristQuat.y, wristQuat.z, wristQuat.w);
      wristGroup.quaternion.copy(wristQuat);
    } else {
      wristGroup.rotation.set(
        degToRad(NEUTRAL_WRIST_ANGLE.x) + rx,
        degToRad(NEUTRAL_WRIST_ANGLE.y) + ry,
        degToRad(NEUTRAL_WRIST_ANGLE.z) + rz,
      );
    }
  });

  return (
    <group ref={followRef} dispose={null}>
      <group rotation={[isLeft ? Math.PI / 2 : 0, isLeft ? Math.PI : 0, isLeft ? Math.PI / 2 : 0]}>
      <group scale={[isLeft ? -BASE_SCALE : BASE_SCALE, BASE_SCALE, BASE_SCALE]}>
        <group ref={wristGroupRef}>
          <group name="Sketchfab_Scene">
            <group name="Sketchfab_model" rotation={[-Math.PI / 2, 0, 0]}>
              <group name="418ea7b41d1642a1af337f41f9c1fc80fbx" rotation={[Math.PI / 2, 0, 0]}>
                <group name="Object_2">
                  <group name="RootNode">
                    <group
                      name="Armature"
                      position={[0, -20, -39.573]}
                      rotation={[-Math.PI / 2, 0, 0]}
                      scale={130}
                    >
                      <group name="Object_6">
                        <primitive object={nodes._rootJoint} />
                        <skinnedMesh
                          name="Object_9"
                          geometry={nodes.Object_9.geometry}
                          material={materials["Material.001"]}
                          skeleton={nodes.Object_9.skeleton}
                        />
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      </group>
    </group>
  );
};

useGLTF.preload(MODEL_PATH);

export default Hand;