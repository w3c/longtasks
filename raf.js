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
 while (window.performance.now() < begin + 750);
};

function init() {
  var p = document.getElementById("jank");
  p.onclick = addJank;

  var q = document.getElementById("stop");
  q.onclick = stopAnimating;

  console.log('Make observer');
  var observer = new PerformanceObserver(function(entryList) {
    var entry = entryList.getEntries()[0];
    var newItem = "long task! " + "start: " + entry.startTime + ", duration: " + (entry.duration / 1000) + "ms, name: " + entry.name;
    console.log(newItem);
    var logBox = document.getElementById('eventlog');
    if (logBox && entry.entryType == "longtask") {
      
      logBox.innerHTML = newItem + "<br>" + logBox.innerHTML;
    };
  });
  console.log('Observe longtask');
  observer.observe({entryTypes: ["longtask"]});
};
