import { complete, error, next, TestScheduler, VirtualObserver } from "@kwonoj/rxjs-testscheduler-compat";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { splice } from "./splice";

describe("splice", () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler();
  });

  it("emits to each index only", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => i.toString());
    const obs = Observable.from(data).delay(1, scheduler);
    const spliced = splice(obs, (i) => i);

    const splits: VirtualObserver[] = [];
    for (let i = 0; i < 10; i++) {
      spliced(i.toString()).subscribe(scheduler.createObserver());
    }

    scheduler.advanceTo(100);

    let s = 0;
    for (const split of splits) {
      expect(split.messages).toHaveLength(2);
      expect(split.messages).toEqual([next(1, s), next(1, s)]);
      s++;
    }
  });

  it("subscribes when a split subscribes", () => {
    const onSubscribe = jest.fn();
    const obs: Observable<string> = Observable.create(onSubscribe);

    const spliced = splice(obs, (i) => i);
    expect(onSubscribe).toHaveBeenCalledTimes(0);

    const first = spliced("0");
    expect(onSubscribe).toHaveBeenCalledTimes(0);

    first.subscribe();
    expect(onSubscribe).toHaveBeenCalledTimes(1);

    spliced("1");
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when all splits unsubscribed & then allows resubscription", () => {
    const onDispose = jest.fn();
    const onSubscribe = jest.fn(() => onDispose);
    const obs: Observable<string> = Observable.create(onSubscribe);

    const spliced = splice(obs, (i) => i);

    const [obs1, obs2, obs3] = [spliced("0"), spliced("1"), spliced("1")]; // index 3 = second subscription on index 1
    const [sub1, sub2, sub3] = [obs1.subscribe(), obs2.subscribe(), obs3.subscribe()];

    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onDispose).toHaveBeenCalledTimes(0);

    // Unsubscribe: assert cleanup
    sub1.unsubscribe();
    expect(onDispose).toHaveBeenCalledTimes(0);
    sub2.unsubscribe();
    expect(onDispose).toHaveBeenCalledTimes(0);
    sub3.unsubscribe();
    expect(onDispose).toHaveBeenCalledTimes(1);

    // Resubscribe: assert resubscription works
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    obs1.subscribe();
    expect(onSubscribe).toHaveBeenCalledTimes(2);
    obs2.subscribe();
    obs3.subscribe();
    expect(onSubscribe).toHaveBeenCalledTimes(2);
  });

  it("sends all types of events (error)", () => {
    const subject = new Subject<string>();
    const spliced = splice(subject, (i) => i);
    const err = new Error();

    scheduler.scheduleAbsolute(() => subject.next("0"), 305);
    scheduler.scheduleAbsolute(() => subject.next("1"), 310);
    scheduler.scheduleAbsolute(() => subject.error(err), 320);
    const result = scheduler.startScheduler(spliced.bind(null, "0"));

    expect(result.messages).toEqual([
      next(305, "0"),
      error(320, err),
    ]);
  });

  it("sends all types of events (complete)", () => {
    const subject = new Subject<string>();
    const spliced = splice(subject, (i) => i);

    scheduler.scheduleAbsolute(() => subject.next("0"), 305);
    scheduler.scheduleAbsolute(() => subject.next("1"), 310);
    scheduler.scheduleAbsolute(() => subject.complete(), 320);
    const result = scheduler.startScheduler(spliced.bind(null, "0"));

    expect(result.messages).toEqual([
      next(305, "0"),
      complete(320),
    ]);
  });

});
