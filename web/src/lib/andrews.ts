/**
 * Andrews curves (Andrews, 1972):
 *   f_x(t) = x1 / sqrt(2) + x2 sin(t) + x3 cos(t) + x4 sin(2t) + x5 cos(2t) + ...,  t in [-pi, pi]
 */
export function andrewsCurve(x: number[], ts: number[]): number[] {
  return ts.map((t) => {
    let y = x[0] / Math.SQRT2;
    for (let i = 1; i < x.length; i++) {
      const k = Math.ceil(i / 2);
      y += x[i] * (i % 2 === 1 ? Math.sin(k * t) : Math.cos(k * t));
    }
    return y;
  });
}

export function tGrid(n = 100): number[] {
  return Array.from({ length: n }, (_, i) => -Math.PI + (2 * Math.PI * i) / (n - 1));
}
