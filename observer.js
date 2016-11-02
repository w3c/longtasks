
function init() {
      window._observer = new PerformanceObserver(function(entryList) {
      //console.log('In PerformanceObserver');
      var i = 0;
      for (i = 0; i < entryList.getEntries().length; i++) {
        var entry = entryList.getEntries()[i];
        if (entry.entryType == "longtask") {
          var item = "long task! " + "start: " + entry.startTime + ", duration: " + (entry.duration / 1000) + "ms, name: " + entry.name;
          //console.log(item);
        }
      }
    });

    window._observer.observe({entryTypes: ["longtask"]});
};
