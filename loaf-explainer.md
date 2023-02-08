# Long Animation Frames (LoAF)
Long Tasks Revamped

## History

Long tasks have long been a way to diagnose and track lack of responsiveness or "jankiness", which eventually affects core web vital metrics like [INP](https://web.dev/inp/). Developers have been using them with varying degrees of success, and now we can learn from the
experience and see what can be improved going forward.

## Where long tasks fall short

Long tasks rely on the underlying notion of a [task](https://html.spec.whatwg.org/#concept-task). This is a somewhat well-specified term, but we found that it has
a few shortcomings.

1. A task does not include the [update the rendering](https://html.spec.whatwg.org/#update-the-rendering) phase. That phase includes `requestAnimationFrame` callbacks,
resize observers, scroll observers and so on. This means that a lot of the busy time
that blocks feedback or animation is not actually counted as part of the "long task",
and developers can game their long task timing by moving long operations into a
`requestAnimationFrame` callback.

1. A task in implementations is used for internal scheduling, and not just as an
implementation of the spec concept of task. This means that changes to implementation detail related to scheduling affects the measurement of long tasks, sometimes in
unexpected, incompatible or arbitrary ways. A big implementation change in chrome silently changed the meaning of long tasks, when we started updating the rendering as part of a new task.

1. Some operations that should be tasks are not specified or implemented to use tasks.
For example, it is not specified how UI events are integrated into the event loop and
the use of tasks there is implementation-specific.

1. A task may contain multiple callbacks, e.g. dispatch several events. This makes
it sometimes confusing to decipher what was the root cause of a long task.

All of the above are part of the same issue - a task is an incomplete and inaccurate cadence to measure main-thread blocking. It's either too granular (as several tasks together may be the cause of blocking) or too coarse (as it may batch together several event handlers and so on).

## Introducing LoAF

LoAF (long animation frame) is a new proposed cadence (period of time) and performance entry type, meant to be a progression of the long task concept.

It's the time measured between when the main thread started doing any work (see `startTime` [here](https://html.spec.whatwg.org/#event-loop-processing-model)), until it is [ready to paint](https://html.spec.whatwg.org/#event-loop-processing-model:mark-paint-timing). It may include several tasks (e.g. a few short ones and then a long one). Because it ends at the paint-mark time, it
includes all the rendering obsevers (requestAnimationFrame, ResizeObserver etc.) and
may or may not include presentation time (as that is somewhat implementation specific).

In addition to making the cadence fit better with what it measures, the entry could include extra information to help understand what made it long, and what kind of consequences it had:

- Time spent in forced layout/style calculations - e.g. calling `getBoundingClientRect`, doing more processing, and then rendering (also known as "layout thrashing" or "forced reflow").
- Is the frame blocking input-feedback *in practice*. Note that a frame that blocks actual UI events would also be accessible via [event timing](https://w3c.github.io/event-timing/).
- User scripts processed during the time of the frame, be it callbacks, event handlers, promise resolvers, or script block parsing and evaluation, and information about those scripts (source, how long they've been delayed for).

## How a LoAF entry might look like
```js
const someLongAnimationFrameEntry = {
    entryType: "long-animation-frame",

    // See details below...
    startTime: frameStartTime,

    // https://html.spec.whatwg.org/#event-loop-processing-model (17)
    // This is a well-specified and interoperable time, but doesn't include presentation time
    paintTime,

    duration: markPaintTimingTime - frameStartTime,

    // Time spent in style/layout due to JS ("layout thrashing"), e.g. getBoundingClientRect() or
    // getComputedStyle(). This is only taken into account if there is also a layout/style update
    // in the final rendering phase.
    totalForcedStyleAndLayoutDuration,

    // Whether this long frame was blocking input/animation in practice
    // A LOaF can block both, in which case ui-event would take precedent.
    blocking: 'ui-event' | 'animation' | 'none',

    // The implementation-specific time when the frame was actually presented. Should be anytime
    // between the previous task's |markPaintTimingTime| and this task's |taskStartTime|.
    presentationTime,
    scripts: [
        {
            // This is an imported module or a <script> element
            // So it includes parsing & evaluation. It may or may not execute code, depending on
            // the script
            entryType: "script-block",
            name: theScriptSrc,
            initiator: "element" | "import",
            frameAttribution: TaskAttribution,
            startTime,
            duration
        },

        {
            entryType: "callback-script",

            frameAttribution: TaskAttribution,

            // these can be classic callbacks, event handlers, or promise resolvers
            // The name is the object.function of the registration function (the function initially
            // called to generate this callback).
            name: "HTMLImgElement.onload" | "Window.requestAnimationFrame" | "Response.json",

            // when the function was invoked
            startTime,
            // when the subsequent microtask queue has finished processing
            duration,

            // The time when the callback was queued, e.g. the event timeStamp.
            queueTime,
            // In the case of promise resolver this would be the invoker's source location
            sourceLocation: "funcName@URL:line:col",
        }
    ]
}
```

## Some details

### Processing model

The [HTML event loop processing model](https://html.spec.whatwg.org/#event-loop-processing-model)
can be roughly described as such:

```js
while (true) {
    const startTime = performance.now();
    // It's unspecified where UI events fit in. Does each have their own task?
    const task = eventQueue.pop();
    if (task)
        task.run();
    if (performance.now() - startTime > 50)
        reportLongTask();

    if (hasRenderingOpportunity()) {
        callFrameAlignedCallbacks(); // e.g. requestAnimationFrame, ResizeObserver
        markPaintTiming();
        render();
    }
}
```

The Chromium implementation:

```js
while (true) {
    const startTime = performance.now();
    const task = eventQueue.pop();
    if (task)
        task.run();
    uiEventQueue.processEvents({rafAligned: false});
    if (performance.now() - startTime > 50)
        reportLongTask();

    if (hasRenderingOpportunity()) {
        eventQueue.push(() => {
            uiEventQueue.processEvents({rafAligned: true});
            callFrameAlignedCallbacks(); // e.g. requestAnimationFrame, ResizeObserver
            markPaintTiming();
            render();
        });
    }
}
```

The new proposal:

```js

let frameStartTime = null;
while (true) {
    if (frameStartTime === null)
        frameStartTime = performance.now();

    const task = eventQueue.pop();
    if (task)
        task.run();

    if (hasRenderingOpportunity()) {
        // It doesn't matter if it's a new task...
        callFrameAlignedCallbacks(); // e.g. requestAnimationFrame, ResizeObserver
        markPaintTiming();

        // Maybe also count discarded render opportunities, or change the magic number
        if (performance.now() - frameStartTime > 50)
            reportLongAnimationFrame();
        render();

        // Next event loop iteration would reinitialize frameStartTime.
        frameStartTime = null;
    }
}
```

### Notes, complexity, doubts, future ideas

1. One complexity inherited from long tasks is the fact that the event loop is shared across
windows of the same [agent](https://tc39.es/ecma262/#sec-agents) (or process). A possible way to
mitigate this would be to only report LoAF to a top-level document if it:
    1. Has been the active document throughout the duration of the long task
    1. Participates in either the work task or the rendering


1. we might consider in the future to relyi on "discarded rendering opportunities" as the qualifier
for sluggishness alongside (or instead of) millisecond duration allows us to omit noise related to
invisible tabs, and also doesn't bind us to the notion of a 60hz animations.

1. Exposing source locations might be a bit tricky or implementation defined.
This can be an optional field but in any case requires some research.

1. Exposing total layout/style time is delicate because those terms are not
defined and can be quite implementation-specific. However, this info is
observable today, by calling `getComputedStyle()` which triggers a
style update or `getClientRects()` which triggers a layout.

1. TBT & TTI are lighthouse values that rely on long tasks. Should they be modified to use LoAFs
instead? Are those metrics useful?

## Overlap with [Event Timing](https://w3c.github.io/event-timing/)

With all the new data that LoAFs expose, their overlap with event timing grows. This is true, but it's only a problem if we look at them as separate APIs.

The [dozen-or-so different entry types](https://w3c.github.io/timing-entrytypes-registry/) that go into a performance timeline are not
separate APIs per-se, but rather queries into the same dataset - the chain of events that helps us understand sluggishness, jank, and instability.

As such, event-timing and LoAF query that dataset differently:
- event timing is driven by input->feedback, regardless of cause, which
could be long main thread processing but not necessarily. This is useful to catch regressions in UX for real users without assuming what causes them.
- LoAF is about catching discarded rendering opportunities. This is a useful
to diagnose the root cause of high INP or sluggishness.

### in other words
LoAF measures *cause* and event-timing measures *effect*. Using one to measure the other