import { outsideSurvivalZone, type SurvivalZone } from './survival-rules';

// Two fills and two outlines; no particles, images, or per-pixel buffers for the storm.
export function drawSurvivalZone(
  c: CanvasRenderingContext2D,
  zone: SurvivalZone,
  view: { x: number; y: number; width: number; height: number },
  player: { x: number; y: number },
) {
  if (zone.round === 1) return;
  c.save();
  c.fillStyle = '#d331672c';
  c.beginPath();
  c.rect(view.x, view.y, view.width, view.height);
  if (zone.radius > 0) {
    c.moveTo(zone.x + zone.radius, zone.y);
    c.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2, true);
  }
  c.fill('evenodd');
  if (zone.radius > 0) {
    c.beginPath();
    c.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    c.strokeStyle = '#ff709acc';
    c.lineWidth = 8;
    c.stroke();
    c.strokeStyle = '#bffaff';
    c.lineWidth = 2;
    c.stroke();
    if (zone.targetRadius > 0 && zone.targetRadius < zone.radius) {
      c.setLineDash([10, 10]);
      c.beginPath();
      c.arc(zone.x, zone.y, zone.targetRadius, 0, Math.PI * 2);
      c.strokeStyle = '#c5f9ff99';
      c.stroke();
      c.setLineDash([]);
    }
    if (outsideSurvivalZone(player, zone)) {
      const angle = Math.atan2(zone.y - player.y, zone.x - player.x);
      c.translate(player.x, player.y);
      c.rotate(angle);
      c.beginPath();
      c.moveTo(62, -9);
      c.lineTo(75, 0);
      c.lineTo(62, 9);
      c.strokeStyle = '#d8fcff';
      c.lineWidth = 4;
      c.stroke();
    }
  }
  c.restore();
}
export function drawBadgeBreakShield(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  remaining: number,
  reducedMotion: boolean,
) {
  if (remaining <= 0) return;
  c.save();
  c.translate(x, y);
  // Smooth pulse at 2.5 Hz; reduced-motion uses a steady outline.
  c.globalAlpha = reducedMotion
    ? 0.85
    : 0.75 + 0.25 * (0.5 + 0.5 * Math.cos(remaining * Math.PI * 5));
  const r = radius + 27;
  c.beginPath();
  c.moveTo(0, -r - 5);
  c.lineTo(r, -r * 0.52);
  c.lineTo(r * 0.87, r * 0.28);
  c.quadraticCurveTo(r * 0.58, r * 0.86, 0, r + 8);
  c.quadraticCurveTo(-r * 0.58, r * 0.86, -r * 0.87, r * 0.28);
  c.lineTo(-r, -r * 0.52);
  c.closePath();
  c.fillStyle = '#40ccff44';
  c.fill();
  c.strokeStyle = '#8becff';
  c.lineWidth = 10;
  c.stroke();
  c.strokeStyle = '#effeff';
  c.lineWidth = 3;
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r + 9, 0, Math.PI * 2);
  c.strokeStyle = '#71e4ff';
  c.lineWidth = 4;
  c.stroke();
  c.restore();
}

// Full-screen edge pressure keeps the central battlefield transparent; no extra particles.
export function drawDamagePressure(
  c: CanvasRenderingContext2D,
  view: { x: number; y: number; width: number; height: number },
  hp: number,
  hurtTime: number,
  stormPulse: number,
  time: number,
  reducedMotion: boolean,
) {
  const impact = Math.min(1, Math.max(0, hurtTime / 0.9));
  const critical = Math.max(0, (35 - hp) / 35);
  const beat = reducedMotion
    ? 0.75
    : 0.55 + 0.45 * ((1 + Math.cos(time * Math.PI * 2)) / 2) ** 3;
  const pressure = Math.min(
    0.82,
    impact * 0.72 + critical * (0.36 + beat * 0.26),
  );
  if (pressure <= 0 && stormPulse <= 0) return;
  c.save();
  c.translate(view.x + view.width / 2, view.y + view.height / 2);
  c.scale(view.width / 2, view.height / 2);
  const gradient = c.createRadialGradient(0, 0, 0.25, 0, 0, 1.2);
  gradient.addColorStop(0, 'rgba(100,0,20,0)');
  gradient.addColorStop(0.45, 'rgba(100,0,20,0)');
  gradient.addColorStop(0.75, `rgba(165,0,32,${pressure * 0.45})`);
  gradient.addColorStop(1, `rgba(100,0,18,${pressure})`);
  c.fillStyle = gradient;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
  c.save();
  c.strokeStyle =
    impact > 0
      ? `rgba(255,49,75,${impact * 0.92})`
      : `rgba(221,24,58,${critical * beat * 0.75})`;
  c.lineWidth = 12 + impact * 24;
  c.strokeRect(view.x + 6, view.y + 6, view.width - 12, view.height - 12);
  if (stormPulse > 0) {
    c.strokeStyle = `rgba(255,119,36,${Math.min(0.65, stormPulse * 2)})`;
    c.lineWidth = 12;
    c.strokeRect(view.x + 18, view.y + 18, view.width - 36, view.height - 36);
  }
  c.restore();
}
