export class JoystickInput {
  pointer: number | null = null;
  private center = { x: 0, y: 0 };
  private radius = 42;
  begin(pointer: number, x: number, y: number, radius: number) {
    if (this.pointer !== null) return false;
    this.pointer = pointer;
    this.center = { x, y };
    this.radius = Math.max(1, radius);
    return true;
  }
  move(pointer: number, x: number, y: number) {
    if (this.pointer !== pointer) return null;
    const dx = (x - this.center.x) / this.radius,
      dy = (y - this.center.y) / this.radius;
    const length = Math.hypot(dx, dy);
    const magnitude = Math.min(1, Math.max(0, (length - 0.12) / 0.88));
    return {
      x: length ? (dx / length) * magnitude : 0,
      y: length ? (dy / length) * magnitude : 0,
    };
  }
  end(pointer: number) {
    if (this.pointer !== pointer) return false;
    this.pointer = null;
    return true;
  }
  reset() {
    this.pointer = null;
  }
}
