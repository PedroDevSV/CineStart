// Colores de gráficos validados (contraste ≥ 3:1 y separación para daltonismo sobre la superficie oscura).
export const C = {
  s1: '#3987e5', // serie 1 (azul)
  s2: '#d95926', // serie 2 (naranja)
  grid: '#2e2a25',
  axis: '#9a9285',
  text: '#c9c1b4',
  surface: '#1a1816',
};

export const axisProps = {
  tick: { fill: C.axis, fontSize: 12 },
  axisLine: { stroke: C.grid },
  tickLine: false,
};

/** Marcas «redondas» para ejes en porcentaje: 0 %, 5 %, 10 %… según el máximo. */
export function pctTicks(values) {
  const max = Math.max(0.05, ...values.filter((v) => v !== null && v !== undefined));
  const step = max > 0.5 ? 0.25 : max > 0.2 ? 0.1 : 0.05;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Number((i * step).toFixed(2)));
}
