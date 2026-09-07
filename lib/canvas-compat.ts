// Older embedded browsers can render the game without Canvas.roundRect.
export function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  if (typeof c.roundRect === 'function') {
    c.roundRect(x, y, w, h, radius);
    return;
  }
  const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
