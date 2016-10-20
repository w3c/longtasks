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
      console.log(newItem);
      var logBox = document.getElementById('eventlog');
      if (logBox && entries[i].entryType == "longtask") {
        logBox.innerHTML = newItem + "<br>" + logBox.innerHTML;
      }
    }
  });
  console.log('Observe longtask');
  observer.observe({entryTypes: ["longtask"]});
};
