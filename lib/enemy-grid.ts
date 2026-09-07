type Point = { x: number; y: number };
export class EnemyGrid<T extends Point> {
  private cells = new Map<number, { item: T; order: number }[]>();
  constructor(private cellSize = 100) {}
  rebuild(items: T[]) {
    this.cells.clear();
    items.forEach((item, order) => {
      const key =
        Math.floor(item.x / this.cellSize) +
        1000 * Math.floor(item.y / this.cellSize);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push({ item, order });
      else this.cells.set(key, [{ item, order }]);
    });
  }
  query(x: number, y: number, radius: number): T[] {
    const found: { item: T; order: number }[] = [];
    for (
      let yy = Math.floor((y - radius) / this.cellSize);
      yy <= Math.floor((y + radius) / this.cellSize);
      yy++
    )
      for (
        let xx = Math.floor((x - radius) / this.cellSize);
        xx <= Math.floor((x + radius) / this.cellSize);
        xx++
      ) {
        const bucket = this.cells.get(xx + yy * 1000);
        if (bucket)
          for (const entry of bucket)
            if (
              Math.abs(entry.item.x - x) <= radius &&
              Math.abs(entry.item.y - y) <= radius
            )
              found.push(entry);
      }
    // Keep original order so piercing and homing select the same targets as before.
    found.sort((a, b) => a.order - b.order);
    return found.map((e) => e.item);
  }
}
