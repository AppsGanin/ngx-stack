interface Sample {
  t: number;
  x: number;
}

/** How far back to look. Older samples describe a gesture the finger has already left. */
const WINDOW_MS = 100;

/** Horizontal speed of a drag, in px/ms. Positive means moving right. */
export class VelocityTracker {
  private samples: Sample[] = [];

  reset(x: number, t: number): void {
    this.samples = [{ x, t }];
  }

  add(x: number, t: number): void {
    this.samples.push({ x, t });
    const cutoff = t - WINDOW_MS;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  velocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.x - first.x) / dt;
  }
}
