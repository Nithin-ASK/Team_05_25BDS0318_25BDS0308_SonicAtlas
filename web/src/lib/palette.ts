/** Okabe-Ito colour-blind-safe palette (Okabe & Ito, 2008). */
export const OKABE_ITO = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#F0E442', '#000000'];
/** Dark-theme variant: black replaced by light grey so it stays visible. */
export const OKABE_ITO_DARK = ['#3A9AD9', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#9AD3F5', '#F0E442', '#BBBBBB'];

/** Marker shapes paired with colours so categories are never colour-only. */
export const SYMBOLS = ['circle', 'rect', 'triangle', 'diamond', 'roundRect', 'pin', 'arrow', 'emptyCircle'];
export const SYMBOL_GLYPH = ['●', '■', '▲', '◆', '▢', '⬢', '➤', '○'];
/** Line dash patterns for line charts, paired with colours. */
export const DASHES: ('solid' | 'dashed' | 'dotted' | number[])[] = ['solid', 'dashed', 'dotted', [8, 3, 2, 3], [2, 2], [12, 4]];

export function paletteFor(theme: 'light' | 'dark') {
  return theme === 'dark' ? OKABE_ITO_DARK : OKABE_ITO;
}

/** Sequential palette (viridis-like, colour-blind-safe) for continuous colouring. */
export const SEQUENTIAL = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
/** Diverging palette (blue - white - orange) for correlations. */
export const DIVERGING = ['#0072B2', '#9ecae1', '#f7f7f7', '#fdb863', '#D55E00'];
