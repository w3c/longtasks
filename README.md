# Long Task API

We’d like to propose a new real user measurement (RUM) performance API to enable applications to detect presence of “long tasks” that monopolize the UI thread for extended periods of time and block other critical tasks from being executed - e.g. reacting to user input.

## Background
As the page is loading and while the user is interacting with the page afterwards, both the application and browser, queue various events that are then executed by the browser -- e.g. user agent schedules input events based on user’s activity, the application schedules callbacks for requestAnimationFrame and other callbacks etc. Once in the queue, these events are then dequeued one-by-one by the browser and executed — e.g. see [“the anatomy of a frame”](https://aerotwist.com/blog/the-anatomy-of-a-frame) for a high-level overview of this process in Blink.

However, some task can take a long time (multiple frames), and if and when that happens, the UI thread is locked and all other tasks are blocked as well. To the user this is commonly visible as a “locked up” page where the browser is unable to respond to user input; this is a major source of bad user experience on the web today:

* _Delayed [“time to Interactive”](https://github.com/tdresser/time-to-interactive)_:  while the page is loading long tasks often tie up the main thread and prevent the user from interactive with the page even though the page is visually rendered. Poorly designed third-party content is a frequent culprit.
* _High/variable input latency_: critical user interaction events (tap, click, scroll, wheel, etc) are queued behind long tasks, which yields janky and unpredictable user experience.
* _High/variable event handling latency_: similar to input, but for processing event callbacks (e.g. onload events, and so on), which delay application updates.
* _Janky animations and scrolling_: some animation and scrolling interactions require coordination between compositor and main threads; if the main thread is blocked due to a long task, it can affect responsiveness of animations and scrolling.

Some applications (and RUM vendors) are already attempting to identify and track cases where “long tasks” happen. For example, one known pattern is to install a ~short periodic timer and inspect the elapsed time between the successive calls: if the elapsed time is greater than the timer period, then there is high likelihood that one or more long tasks have delayed execution of the timer. This mostly works, but it has several bad performance implications: the application is polling to detect long tasks, which prevents quiescence and long idle blocks (see requestIdleCallback); it’s bad for battery life; there is no way to know who caused the delay (e.g. first party vs third party code)

[RAIL performance model](https://developers.google.com/web/tools/chrome-devtools/profile/evaluate-performance/rail?hl=en#response-respond-in-under-100ms) suggests that applications should respond in under 100ms to user input; for touch move and scrolling in under 16ms. Our goal with this API is to surface notifications about tasks that may prevent the application from hitting these targets.

## API Sketch (v1)
Introduce new PerformanceEntry object, which will report instances of long tasks:
```javascript
interface PerformanceTaskTiming : PerformanceEntry {};
```

Attribute definitions of PerformanceTaskTiming:

* entryType: “longtask”
* startTime: DOMHighResTimeStamp of when long task started
* duration: elapsed time (as DOMHighResTimeStamp) between start and finish of task
* name: type of attribution, eg. "same-origin", "cross-origin", "unknown" etc.
* culprit: domWindow pointer to the frame that is responsible

Long tasks events will be delivered to the observer regardless of which frame was responsible for the long task. The goal is to allow all pages on the web to know if and who (first party content or third party content) is causing disruptions. The culprit attribute provides minimal attribution so that the observing frame can respond to the issue in the proper way. For more details on how the attribute is set, see the processing section.

The above covers existing use cases found in the wild, enables document-level attribution, and eliminates the negative performance implications mentioned earlier. To receive these notifications, the application can subscribe to them via PerformanceObserver interface:

```javascript
var observer = new PerformanceObserver(function(list) {
  var perfEntries = list.getEntries();
  for (var i = 0; i < perfEntries.length; i++) {
     // Process long task notifications:
     // report back for analytics and monitoring
     // ...
  }
});


// register observer for long task notifications
observer.observe({entryTypes: ["longtask"]});

// Long script execution after this will result in queueing 
// and receiving “longtask” entries in the observer.
```

**Long-task threshold: we propose 50ms.** That is, the UA should emit long-task events whenever it detects tasks whose execution time exceeds >50ms. 

### Demo
For a quick demo of a partial implementation, in the latest Chrome Canary (version 55.0.2867.0 or up) go to [chrome://flags](chrome://flags) and enable the flag: "Experimental Web Platform features".
Then visit this link:
https://wicg.github.io/longtasks/render-jank-demo.html


### The "culprit" attribute
Work in a browser is sometimes very frame specific, for instance a long running script. But sometimes, long tasks can happen due to more global things: a long GC that is process or frame-tree wide, for instance.

Also, the security model of the web means that sometimes a long task will happen in an iframe that is unreachable from the observing frame. For instance, a long task might happen in a deeply nested iframe that is different from my origin. Or similarly, I might be an iframe doubly embedded in a document, and a long task will happen in the top-level browsing context. In the web security model, I can know from which direction the issue came, one of my ancestors or descendants, but to preserve the frame origin model, we must be careful about which URLs to disclose each frame.

The culprit field on long tasks is meant to enable observing frames to minimally understand where the blame rests for a long task. Currently, we propose setting "culprit" to different Window values depending on the case under consideration:

* the Window of the observing frame, if we believe the long task to be due to this frame's work

* the Window of the parent document if we believe the work to be related to the  parent context (showing parent context is subject to Referer policy).

* If the long task came from a misbehaving descendant frame:
  * If the misbehaving frame is nested inside a child frame that is cross origin - then the culprit is the child frame's Window. 
  * If the misbehaving frame is same-origin and nested inside a same-origin child frame - then the culprit is the responsible frame’s Window.

* null, if we believe the long task was due to something global, for instance some global GC event that is running that isn't reasonably attributed to one frame or another


## Privacy & Security
Applications can already observe discontinuities in scheduling of periodic timers and use this to infer potential problems due to long executing tasks or excessive number of tasks. For instance, one can create a setTimeout(,10) and observe whether it fires within ~10ms. If it is delayed, your thread was busy. This is a technique facebook uses to detect long tasks already.

We think that the triggering of long task notifications does not expose any additional security or privacy risks -- given that timing info is more granular (50ms instead of 10ms), along with adherence of cross-origin policy.

Document-level attribution enables application to identify and attribute the source of the long task. The exposed culprit Window is either self, the Window of the embedded context (at most one level deep -- if cross origin), or the Window of the parent subject to cross-origin and Referer policies. These Window pointers are already accessible to the application and do not expose new information.

Detailed Security & Privacy doc is here:
https://docs.google.com/document/d/1tIMI1gau_q6X5EBnjDNiFS5NWV9cpYJ5KKA7xPd3VB8/edit#

## V2 API Sketch
See: https://docs.google.com/document/d/125d69JAC7nyx-Ob0a9Z31d1uHUGu4myYQ3os9EnGfdU/edit

## Alternatives Considered
### Why not just show sub-tasks vs. top-level tasks with attribution?
This API will show toplevel long tasks along with attribution for specific sub-tasks which were problematic.
For instance, within a 50ms toplevel task, sub-tasks such as a 20ms script execution or a 30ms style & layout update -- will be attributed.
This raises the question -- why show the toplevel task at all? Why not only show long sub-tasks such as script, style & layout etc that are directly actionable by the user? The top level task may contain some un-attributable segments such as browser work eg. GC or browser events etc.

The rationale here is that showing the toplevel task is good for web developers, even though they will actively consume the actionable sub-tasks such as long scripts and act on them. Over time the sub-task attribution will keep expanding, making more of the long task actionable.
Showing the top-level task gives developers a direct indication of main thread busy-ness, and since this directly impacts the user experience, it is appropriate for them to know about it as a problem signal -- even if they cannot have complete visibility or full actionability for the entire length of the long task. 
In many cases the developers may be able to repro in lab or locally and glean additional insights and get to the root cause. 
Long tasks provide context to long sub-tasks, for instance, a 20ms style and layout or a 25ms script execution may not be terrible by themselves, but if they happen consecutively (eg. script started from rAF) and cause a long 50ms task, then this is a problem for user responsiveness.

