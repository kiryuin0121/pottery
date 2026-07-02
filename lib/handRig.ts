// lib/handRig.ts

import * as THREE from "three";
import type { Landmark } from "@mediapipe/tasks-vision";

/**
 * このモデルのボーン名と、MediaPipe 21点ランドマークの対応表。
 *
 * モデルの命名規則:
 *   f_<finger>0N<L|R>_xxx  … N=1(付け根) 2(中) 3(先端)、L/R=左右
 *   thumb0N<L|R>_xxx       … 親指のみ thumb 名
 *   *_end_*                … 先端キャップ。回転には使わないので含めない。
 *
 * MediaPipe 21点の指インデックス(片手):
 *   親指   : 1(CMC) 2(MCP) 3(IP) 4(TIP)
 *   人差指 : 5(MCP) 6(PIP) 7(DIP) 8(TIP)
 *   中指   : 9 10 11 12
 *   薬指   : 13 14 15 16
 *   小指   : 17 18 19 20
 *   手首   : 0
 *
 * 各「ボーン」は2つのランドマーク(始点・終点)を結ぶ線分に対応する。
 * 例: f_index01 は MCP(5)→PIP(6) の向き、f_index02 は PIP(6)→DIP(7) の向き。
 * この向きを使ってボーンの回転を決める(後述)。
 */
export type FingerBoneDef = {
  /** スケルトン上のボーン名(末尾の連番 _0NN は実行時に前方一致で吸収する)。 */
  bonePrefix: string;
  /** このボーンの「始点」となるランドマーク番号。 */
  startLm: number;
  /** このボーンの「終点」となるランドマーク番号(向きの算出に使う)。 */
  endLm: number;
};

/** 片手ぶんのボーン定義を生成する。side は "L" か "R"。 */
export const buildFingerBones = (side: "L" | "R"): FingerBoneDef[] => [
  // 親指
  { bonePrefix: `thumb01${side}`, startLm: 1, endLm: 2 },
  { bonePrefix: `thumb02${side}`, startLm: 2, endLm: 3 },
  { bonePrefix: `thumb03${side}`, startLm: 3, endLm: 4 },
  // 人差し指
  { bonePrefix: `f_index01${side}`, startLm: 5, endLm: 6 },
  { bonePrefix: `f_index02${side}`, startLm: 6, endLm: 7 },
  { bonePrefix: `f_index03${side}`, startLm: 7, endLm: 8 },
  // 中指
  { bonePrefix: `f_middle01${side}`, startLm: 9, endLm: 10 },
  { bonePrefix: `f_middle02${side}`, startLm: 10, endLm: 11 },
  { bonePrefix: `f_middle03${side}`, startLm: 11, endLm: 12 },
  // 薬指
  { bonePrefix: `f_ring01${side}`, startLm: 13, endLm: 14 },
  { bonePrefix: `f_ring02${side}`, startLm: 14, endLm: 15 },
  { bonePrefix: `f_ring03${side}`, startLm: 15, endLm: 16 },
  // 小指
  { bonePrefix: `f_pinky01${side}`, startLm: 17, endLm: 18 },
  { bonePrefix: `f_pinky02${side}`, startLm: 18, endLm: 19 },
  { bonePrefix: `f_pinky03${side}`, startLm: 19, endLm: 20 },
];

/**
 * スケルトンのボーン配列から、名前の前方一致でボーンを引く。
 *
 * ボーン名は "f_index01L_07" のように末尾に連番が付く。対応表では "f_index01L"
 * までしか持たないので startsWith で照合する。見つからなければ undefined。
 */
export const findBone = (
  bones: THREE.Bone[],
  prefix: string,
): THREE.Bone | undefined => bones.find((b) => b.name.startsWith(prefix));

/**
 * 指の「曲がり具合」を 0(まっすぐ)〜1(最大屈曲) で求める。
 *
 * 【なぜ角度ではなく曲がり量にするか】
 * MediaPipe の worldLandmarks をモデルのボーン座標系へ厳密に変換するのは
 * 座標系・バインドポーズの違いがあり非常に難しい。そこで簡略化し、
 * 「3点(付け根・中・先端)が作る角度」から曲がり量だけを取り出し、それを
 * ボーンのローカル回転(1軸)に流し込む。厳密な姿勢再現ではないが、
 * 「指を曲げると3Dの指も曲がる」という連動は十分自然に出せる。
 *
 * @param a 関節の始点(例: MCP)
 * @param b 関節(例: PIP) ← この点での曲がりを測る
 * @param c 関節の終点(例: DIP)
 * @returns 0〜1 の屈曲量
 */
export const flexionAmount = (a: Landmark, b: Landmark, c: Landmark): number => {
  // ベクトル b→a と b→c のなす角を求める。まっすぐなら約180度、曲げると小さくなる。
  const v1 = new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z).normalize();
  const v2 = new THREE.Vector3(c.x - b.x, c.y - b.y, c.z - b.z).normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(v1.dot(v2), -1, 1)); // 0〜π
  // 角度(π=まっすぐ 〜 0=完全屈曲)を 0〜1 の屈曲量へ反転マッピング。
  return THREE.MathUtils.clamp(1 - angle / Math.PI, 0, 1);
};