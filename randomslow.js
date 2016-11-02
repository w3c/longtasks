function makeSlowTask(ms) {
  var begin = window.performance.now();
  while (window.performance.now() < begin + ms);
}


(function loop() {
    // Random number in range 100 - 400ms
    var randTaskLen = Math.round(Math.random() * (400 - 40)) + 10;
    var randDelay = Math.round(Math.random() * (500 - 100)) + 100;
    setTimeout(function() {
            makeSlowTask(randTaskLen);
            loop();
    }, randDelay);
}());
