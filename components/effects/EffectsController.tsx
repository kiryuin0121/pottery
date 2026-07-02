/* eslint-disable react-hooks/refs */
// components/effects/EffectsController.tsx
/*
 * ジェスチャー検出とエフェクト駆動をつなぐハブ。
 *
 * useFrame で dataRef(MediaPipe の共有 ref)を読み、
 *  1. 「手のひら上向き + グー」を3秒保持 → 手を開いた瞬間に青炎バースト
 *  2. 指先同士の近接 → 稲妻アーク(片手の親指-人差し指、両手の人差し指間)
 * を判定して、プールした FlameEffect / LightningArc に imperative に流し込む。
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
  palmUpness,
  FIST_CLOSE_THRESHOLD,
  FIST_OPEN_THRESHOLD,
  PALM_UP_THRESHOLD,
  CHARGE_DURATION,
} from "@/lib/gestures";
import FlameEffect, { type FlameHandle } from "./FlameEffect";
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

/** 手ごとのチャージ状態。 */
type ChargeState = {
  charge: number; // 保持秒数
  wasFist: boolean; // ヒステリシス用
};

const EffectsController = ({ dataRef }: Props) => {
  const flameRefs = [useRef<FlameHandle>(null), useRef<FlameHandle>(null)];
  const arcRefs = [
    useRef<LightningHandle>(null), // 右手ピンチ
    useRef<LightningHandle>(null), // 左手ピンチ
    useRef<LightningHandle>(null), // 両手間
  ];

  const chargeStates = useRef<ChargeState[]>([
    { charge: 0, wasFist: false },
    { charge: 0, wasFist: false },
  ]);

  // 作業用ベクトル(毎フレームの new を避ける)。
  const tmp = useMemo(
    () => ({
      palm: new THREE.Vector3(),
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

  useFrame((_, delta) => {
    const data = dataRef.current;
    const stale = performance.now() - data.lastUpdated > STALE_MS;

    // handedness ラベル(実際の手)でスロットを固定: 0=Right, 1=Left
    const sides = ["Right", "Left"] as const;
    const crossTips: THREE.Vector3[] = [];

    sides.forEach((side, i) => {
      const hand: HandFrame | undefined = stale
        ? undefined
        : data.hands.find((h) => h.handedness === side);
      const flame = flameRefs[i].current;
      const pinchArc = arcRefs[i].current;
      const st = chargeStates.current[i];

      if (!hand) {
        st.charge = 0;
        st.wasFist = false;
        flame?.clear();
        pinchArc?.hide();
        return;
      }

      // --- 青炎: 手のひら上向きグー3秒 → 開いた瞬間バースト ---
      const fist = computeFistAmount(hand.worldLandmarks);
      const palmUp = palmUpness(hand.worldLandmarks, hand.handedness);
      landmarkToWorld(hand.landmarks[9], tmp.palm); // 中指MCP ≒ 手のひら中心

      const isFist = st.wasFist
        ? fist > FIST_OPEN_THRESHOLD // 一度握ったら開くまで維持(ヒステリシス)
        : fist > FIST_CLOSE_THRESHOLD;

      if (isFist && palmUp > PALM_UP_THRESHOLD) {
        st.charge += delta;
        st.wasFist = true;
        flame?.setCharge(tmp.palm, Math.min(st.charge / CHARGE_DURATION, 1));
      } else if (st.wasFist && !isFist) {
        // 手を開いた瞬間。チャージ完了していれば発火。
        if (st.charge >= CHARGE_DURATION) flame?.trigger(tmp.palm);
        else flame?.clear();
        st.charge = 0;
        st.wasFist = false;
      } else if (!isFist) {
        st.charge = 0;
        flame?.clear();
      }
      // isFist だが palmUp が外れた場合はチャージを保持したまま待つ(手ブレ耐性)。

      // --- 稲妻(片手ピンチ): 親指先 - 人差し指先 ---
      landmarkToWorld(hand.landmarks[HAND_LANDMARK.THUMB_TIP], tmp.a);
      landmarkToWorld(hand.landmarks[HAND_LANDMARK.INDEX_TIP], tmp.b);
      const pinchInt = proximity(tmp.a.distanceTo(tmp.b), PINCH_START, PINCH_FULL);
      // グーの最中はピンチ距離が常に近くなるので稲妻を抑制する。
      if (pinchInt > 0 && !isFist) pinchArc?.set(tmp.a, tmp.b, pinchInt);
      else pinchArc?.hide();

      // 両手間アーク用に人差し指先を回収。
      const tip = i === 0 ? tmp.crossA : tmp.crossB;
      landmarkToWorld(hand.landmarks[HAND_LANDMARK.INDEX_TIP], tip);
      crossTips.push(tip);
    });

    // --- 稲妻(両手間): 左右の人差し指先 ---
    const crossArc = arcRefs[2].current;
    if (crossTips.length === 2) {
      const d = crossTips[0].distanceTo(crossTips[1]);
      const int = proximity(d, CROSS_START, CROSS_FULL);
      if (int > 0) crossArc?.set(crossTips[0], crossTips[1], int);
      else crossArc?.hide();
    } else {
      crossArc?.hide();
    }
  });

  return (
    <>
      <FlameEffect ref={flameRefs[0]} />
      <FlameEffect ref={flameRefs[1]} />
      <LightningArc ref={arcRefs[0]} />
      <LightningArc ref={arcRefs[1]} />
      <LightningArc ref={arcRefs[2]} />
    </>
  );
};

export default EffectsController;
