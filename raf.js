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
};
