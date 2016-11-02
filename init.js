
function makeSlowTask(ms) {
  var begin = window.performance.now();
  while (window.performance.now() < begin + ms);
}


(function loop() {
    // Random number in range 100 - 400ms
    var randTaskLen = Math.round(Math.random() * (400 - 10)) + 10;
    var randDelay = Math.round(Math.random() * (1000 - 300)) + 300;
    setTimeout(function() {
            makeSlowTask(randTaskLen);
            loop();
    }, randDelay);
}());

var globalID;

function repeatOften() {
  $("<div />").appendTo("body");
  globalID = requestAnimationFrame(repeatOften);
}

globalID = requestAnimationFrame(repeatOften);

function stopAnimating() {
  cancelAnimationFrame(globalID);
}

function addJank() {
 var begin = window.performance.now();
 while (window.performance.now() < begin + 450);
};

function init() {
  var p = document.getElementById("jank");
  p.onclick = addJank;

  var q = document.getElementById("stop");
  if (q) {
    q.onclick = stopAnimating;
  }

  console.log('Make observer');
  window._observer = new PerformanceObserver(function(entryList) {
    console.log('In observer');
    var entries = entryList.getEntries();
    for (var i = 0; i < entries.length; i++) {
      var newItem = "long task! " + "start: " + entries[i].startTime + ", duration: " + (entries[i].duration / 1000) + "ms, name: " + entries[i].name;
      // console.log(newItem);
      var logBox = document.getElementById('eventlog');
      if (logBox && entries[i].entryType == "longtask") {
        logBox.innerHTML = newItem + "<br>" + logBox.innerHTML;
      }
    }
  });
  console.log('Observe longtask');
  window._observer.observe({entryTypes: ["longtask"]});
};
