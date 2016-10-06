
var observer = new PerformanceObserver(function(entryList) {
  var entry = entryList.getEntries()[0];
  var logBox = document.getElementById('eventlog');
  if (logBox && entry.entryType == "longtask") {
    var newItem = "long task! " + "start: " + entry.startTime + ", duration: " + (entry.duration / 1000) + "ms, name: " + entry.name + "<br>";
    logBox.innerHTML = newItem + logBox.innerHTML;
  };
});

bserver.observe({entryTypes: ["longtask"]});

