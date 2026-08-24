import type { BoxGridSnapshot } from "./schema";

export class BoxGridClient {
  constructor(private readonly snapshot: BoxGridSnapshot) {}

  getSnapshot(): BoxGridSnapshot {
    return this.snapshot;
  }
}
