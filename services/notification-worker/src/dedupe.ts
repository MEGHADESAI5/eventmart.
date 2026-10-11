/**
 * Remembers the most recent `max` ids. In-memory only: good enough for a single worker
 * instance, but a production version would use Redis or a DB table (see README).
 */
export class RecentIds {
  private readonly ids = new Set<string>();
  constructor(private readonly max = 10_000) {}

  has(id: string): boolean {
    return this.ids.has(id);
  }

  add(id: string): void {
    this.ids.add(id);
    if (this.ids.size > this.max) {
      const oldest = this.ids.values().next().value;
      if (oldest !== undefined) this.ids.delete(oldest);
    }
  }
}
