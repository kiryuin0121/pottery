/* eslint-disable react-hooks/refs */
// components/effects/EffectsController.tsx
/*
 * ジェスチャー検出とエフェクト駆動をつなぐハブ。
 *
 * useFrame で dataRef(MediaPipe の共有 ref)を読み、指先同士の近接から
 * 稲妻アーク(片手の親指-人差し指、両手の人差し指間)を判定して、
 * プールした LightningArc に imperative に流し込む。
 *
 * React state は使わない(毎フレーム変わる値なので ref 駆動で再レンダリングを回避)。
 */

"use client";

import * as THREE from "three";
import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { HandTrackingData, HandFrame } from "@/types/hand";
import { HAND_LANDMARK } from "@/types/hand";
import { landmarkToWorld } from "@/lib/coords";
import {
  computeFistAmount,
  FIST_CLOSE_THRESHOLD,
  FIST_OPEN_THRESHOLD,
} from "@/lib/gestures";
import LightningArc, { type LightningHandle } from "./LightningArc";

type Props = {
  dataRef: RefObject<HandTrackingData>;
};

/** 検出がこの時間(ms)以上更新されなければ手を見失ったとみなす。 */
const STALE_MS = 400;

/** 片手ピンチ(親指-人差し指)の稲妻が出始める距離と最大強度になる距離(ワールド単位)。 */
const PINCH_START = 2.0;
const PINCH_FULL = 0.5;

/** 両手の人差し指間の稲妻の距離設定(こちらは長めに飛ばす)。 */
const CROSS_START = 13.5;
const CROSS_FULL = 1.2;

const EffectsController = ({ dataRef }: Props) => {
  const arcRefs = [
    useRef<LightningHandle>(null), // 右手ピンチ
    useRef<LightningHandle>(null), // 左手ピンチ
    useRef<LightningHandle>(null), // 両手間
  ];

  // ヒステリシス用: 前フレームでグーだったか(手ごと)。
  const fistStates = useRef<[boolean, boolean]>([false, false]);

  // 作業用ベクトル(毎フレームの new を避ける)。
  const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      crossA: new THREE.Vector3(),
      crossB: new THREE.Vector3(),
    }),
    [],
  );

  /** 距離→強度 0〜1(start で 0、full 以下で 1)。 */
  const proximity = (d: number, start: number, full: number): number =>
    THREE.MathUtils.clamp((start - d) / (start - full), 0, 1);

  useFrame(() => {
    const data = dataRef.current;
    const stale = performance.now() - data.lastUpdated > STALE_MS;

    // handedness ラベル(実際の手)でスロットを固定: 0=Right, 1=Left
    const sides = ["Right", "Left"] as const;
    const foundHands: (HandFrame | undefined)[] = [undefined, undefined];

    sides.forEach((side, i) => {
      foundHands[i] = stale
        ? undefined
        : data.hands.find((h) => h.handedness === side);
      if (!foundHands[i]) fistStates.current[i] = false;
    });

    const [right, left] = foundHands;
    const crossArc = arcRefs[2].current;

    // --- 片手ピンチ: 親指先 - 人差し指先 ---
    foundHands.forEach((hand, i) => {
      const pinchArc = arcRefs[i].current;
      if (!hand) {
        pinchArc?.hide();
        return;
      }

      // グー判定(ヒステリシス)。グー中は親指-人差し指が常に近接するので
      // ピンチ稲妻の誤発動を抑制するのに使う。
      const fist = computeFistAmount(hand.worldLandmarks);
      const isFist = fistStates.current[i]
        ? fist > FIST_OPEN_THRESHOLD
        : fist > FIST_CLOSE_THRESHOLD;
      fistStates.current[i] = isFist;

      landmarkToWorld(hand.landmarks[HAND_LANDMARK.THUMB_TIP], tmp.a);
      landmarkToWorld(hand.landmarks[HAND_LANDMARK.INDEX_TIP], tmp.b);
      const pinchInt = proximity(tmp.a.distanceTo(tmp.b), PINCH_START, PINCH_FULL);
      if (pinchInt > 0 && !isFist) pinchArc?.set(tmp.a, tmp.b, pinchInt);
      else pinchArc?.hide();
    });

    // --- 両手間: 左右の人差し指先 ---
    if (right && left) {
      landmarkToWorld(right.landmarks[HAND_LANDMARK.INDEX_TIP], tmp.crossA);
      landmarkToWorld(left.landmarks[HAND_LANDMARK.INDEX_TIP], tmp.crossB);
      const crossInt = proximity(
        tmp.crossA.distanceTo(tmp.crossB),
        CROSS_START,
        CROSS_FULL,
      );
      if (crossInt > 0) crossArc?.set(tmp.crossA, tmp.crossB, crossInt);
      else crossArc?.hide();
    } else {
      crossArc?.hide();
    }
  });

  return (
    <>
      <LightningArc ref={arcRefs[0]} />
      <LightningArc ref={arcRefs[1]} />
      <LightningArc ref={arcRefs[2]} />
    </>
  );
};

export default EffectsController;
