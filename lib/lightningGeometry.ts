// lib/lightningGeometry.ts
/*
 * 2点間を結ぶ稲妻(ジグザグ折れ線+枝分かれ)のセグメント座標を生成する。
 * LineSegmentsGeometry.setPositions に渡す前提で、頂点ペアの平坦配列
 * [x0,y0,z0, x1,y1,z1, ...] を毎回書き込む。GC を避けるため配列は呼び出し側で
 * 使い回し、この関数は書き込んだ float 数を返す。
 */

import * as THREE from "three";

/** 本線の分割数。 */
export const MAIN_SEGMENTS = 16;
/** 枝の本数と分割数。 */
export const BRANCH_COUNT = 2;
export const BRANCH_SEGMENTS = 6;

/** 必要な Float32Array の長さ(セグメントごとに2頂点×3成分)。 */
export const BOLT_ARRAY_LENGTH =
  (MAIN_SEGMENTS + BRANCH_COUNT * BRANCH_SEGMENTS) * 2 * 3;

const _dir = new THREE.Vector3();
const _perpA = new THREE.Vector3();
const _perpB = new THREE.Vector3();
const _p = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _branchEnd = new THREE.Vector3();
const _branchStart = new THREE.Vector3();

/** points[i] を計算して out に書く内部ヘルパ(折れ線1本ぶん)。 */
const writePolyline = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments: number,
  chaos: number,
  out: Float32Array,
  offset: number,
): number => {
  const len = start.distanceTo(end);
  // ランダムウォークでオフセットに連続性を持たせる(完全独立だと毛羽立ちすぎる)。
  let offA = 0;
  let offB = 0;
  _prev.copy(start);
  let o = offset;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    if (i === segments) {
      _p.copy(end);
    } else {
      // 端点付近は振れ幅を絞る(sin エンベロープ)。
      const amp = chaos * len * Math.sin(Math.PI * t);
      offA = offA * 0.45 + (Math.random() - 0.5) * 2 * amp * 0.55;
      offB = offB * 0.45 + (Math.random() - 0.5) * 2 * amp * 0.55;
      _p.lerpVectors(start, end, t)
        .addScaledVector(_perpA, offA)
        .addScaledVector(_perpB, offB);
    }
    out[o++] = _prev.x; out[o++] = _prev.y; out[o++] = _prev.z;
    out[o++] = _p.x;    out[o++] = _p.y;    out[o++] = _p.z;
    _prev.copy(_p);
  }
  return o;
};

/**
 * start→end の稲妻セグメント群を out に生成する。
 * @param chaos ジグザグの強さ(距離比)。0.12〜0.25 くらいが自然。
 * @returns 書き込んだ float 数(= setPositions に渡す subarray の長さ)
 */
export const generateBolt = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  out: Float32Array,
  chaos = 0.18,
): number => {
  _dir.subVectors(end, start);
  const len = _dir.length();
  if (len < 1e-5) return 0;
  _dir.normalize();

  // 進行方向に直交する2軸(オフセット用の基底)。
  _perpA.set(0, 1, 0);
  if (Math.abs(_dir.dot(_perpA)) > 0.9) _perpA.set(1, 0, 0);
  _perpA.cross(_dir).normalize();
  _perpB.crossVectors(_dir, _perpA).normalize();

  let o = writePolyline(start, end, MAIN_SEGMENTS, chaos, out, 0);

  // 枝: 本線上のランダムな点から外側へ短く伸ばす。
  for (let b = 0; b < BRANCH_COUNT; b++) {
    const t = 0.25 + Math.random() * 0.5;
    _p.lerpVectors(start, end, t);
    _branchEnd
      .copy(_p)
      .addScaledVector(_perpA, (Math.random() - 0.5) * len * 0.5)
      .addScaledVector(_perpB, (Math.random() - 0.5) * len * 0.5)
      .addScaledVector(_dir, len * 0.15);
    // writePolyline は _p/_prev を内部で使うので開始点を退避してから渡す。
    _branchStart.copy(_p);
    o = writePolyline(_branchStart, _branchEnd, BRANCH_SEGMENTS, chaos * 1.4, out, o);
  }
  return o;
};
