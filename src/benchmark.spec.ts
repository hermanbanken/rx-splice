import { Subject } from "rxjs/Subject";
import { splice } from "./splice";

describe("splice", () => {
  /**
   * Performance test
   */
  it("should outperform filtering each stream", () => {

    const iterations = 1000; // increase to larger numbers for benchmark
    const bridges = 100; // increase to larger numbers for benchmark
    const keys = 100; // approx equal to bridge count

    function measure(subject: Subject<{ id: string }>) {
      const start1 = process.hrtime();
      for (let i = 0; i < iterations; i++) {
        subject.next({ id: (i % keys).toString(10) });
      }
      const duration1 = process.hrtime(start1);
      return duration1[0] + duration1[1] * 1e-9;
    }

    // Old way
    function old() {
      const obs = [];
      const subject = new Subject<{ id: string }>();
      for (let i = 0; i < bridges; i++) {
        const id = (i % keys).toString(10);
        obs.push(subject.filter((k) => k.id === id));
      }
      obs.forEach((o) => o.subscribe());
      return measure(subject);
    }

    // New way
    function newer() {
      const obs = [];
      const subject = new Subject<{ id: string }>();
      const spliced = splice(subject, (i) => i.id);
      for (let i = 0; i < bridges; i++) {
        const id = (i % keys).toString(10);
        obs.push(spliced(id).filter((k) => k.id === id));
      }
      obs.forEach((o) => o.subscribe());
      return measure(subject);
    }

    // Optimize
    old();
    newer();
    old();
    newer();

    const times = [old(), newer()];
    expect(times[0]).toBeGreaterThan(times[1]);
  });
})
