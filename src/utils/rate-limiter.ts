export class RateLimiter {
  private timer: NodeJS.Timeout | undefined;
  private pending: (() => void | Promise<void>) | undefined;

  constructor(private intervalMs: number) {}

  schedule(task: () => void | Promise<void>): void {
    this.pending = task;
    if (this.timer) return;

    this.timer = setTimeout(async () => {
      const pending = this.pending;
      this.pending = undefined;
      this.timer = undefined;
      if (pending) await pending();
    }, this.intervalMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const pending = this.pending;
    this.pending = undefined;
    if (pending) await pending();
  }
}
