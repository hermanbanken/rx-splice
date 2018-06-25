RxJS splice operator
----

This package offers the RxJS splice operator: an eager variant of the `groupBy` operator.

Usage:

````typescript
import { splice } from "rx-splice";

const input$ = Observable.from("a-value", "b-value", "c-value", /* more... */);

const spliced = splice(input$, (value: string) => value[0]);

spliced("a").subscribe(console.log);
spliced("b").subscribe(console.log);
// etc
````

# Rationale
Using only idiomatic RxJS code, one would use `filter` instead for the use case of `splice`.
However, if you are writing high performance code and this `input$` Observable above
(or more likely, Subject) would be subscribed hunderths or thousands of times (X),
and thus the selector function of `filter(fn)` would be called X times.
This can - and actually did prove to - be the biggest performance bottleneck in our application,
so we wrote `splice`, which executes it's indexing selector only once for each emitted value.

Note that `splice` operates like `share` in how it subscribes upstream:
- subscribing the _first_ 'shard' will active the upstream subscription,
- later subscriptions wont trigger additional upstream subscriptions and
- unsubscribing the _last_ subscription will unsubscribe the upstream subscription too.
