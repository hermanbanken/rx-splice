import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { Subscription } from "rxjs/Subscription";

/**
 * Eager groupBy. `splice` to subscribe on a stream once and split out the traffic by key.
 *
 * The way this operator subscribes upstream looks a lot like Rx-refCounting. We create and store
 * the upstream subscription for the first subscribe, and cleanup that subscription after the last
 * group is unsubscribed. This has the same behaviour as RxJS' `.share()` in that sense.
 *
 * To do what splice does with `groupBy` & without a lookup table is impossible: you need to make the
 * observer for non-opened groups eagerly. That is the main functionality of splice: to put each keys
 * observer in a lookup table and for each incoming next-event select the correct slice and forward
 * the event there.
 *
 * @param observable input observable
 * @param indexFn key selector
 */
export function splice<T>(observable: Observable<T>, indexFn: (t: T) => string) {
  const observers: { [index: string]: Array<Observer<T>> } = {};
  let subscription: Subscription | undefined;

  function maybeStart() {
    // Only subscribe upstream if not already subscribed
    if (subscription) { return; }

    // Forward all 3 event types
    subscription = observable.subscribe(
      (value) => {
        const key = indexFn(value);
        if (observers[key]) {
          observers[key].forEach((obs) => obs.next(value));
        }
      },
      (e) => Object.keys(observers).forEach((key) => observers[key].forEach((obs) => obs.error(e))),
      () => Object.keys(observers).forEach((key) => observers[key].forEach((obs) => obs.complete())),
    );
  }

  function maybeStop() {
    // Only unsubscribe upstream if 0 downstreams remain
    if (Object.keys(observers).length === 0 && subscription) {
      subscription.unsubscribe();
      subscription = undefined;
    }
  }

  /**
   * Slice selector function to be applied to the source observable being spliced.
   *
   * Returned Observable is a slice of the source observable based on the index supplied
   * to this function and used in the original `splice(indexFn)` to select slice
   * for emitting data emissions.
   *
   * @param index
   */
  function sliceSelector(index: string) {
    return new Observable((observer: Observer<T>) => {
      // Subscribe
      maybeStart();
      if (!observers[index]) {
        observers[index] = [];
      }
      observers[index].push(observer);

      // Dispose
      return () => {
        observers[index] = observers[index].filter((obs) => obs !== observer);
        if (observers[index].length === 0) {
          delete observers[index];
        }
        maybeStop();
      };
    });
  }

  return sliceSelector;
}
