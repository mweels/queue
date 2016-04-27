 var q = queue();

  var job = {
    id: "1",
    run: (cb) => {
      console.log("cool");
      var j = this;
      cb(null, "cool");
    },
    cronPattern: "* * * * * *",
    runCountStop: 10,
    runCount: 0,
    runsLeft : function() {
      return this.runCountStop - this.runCount;
    },
    lastTime:1,
    errorCountStop:3,
    errorCount:0,
    onError: () => {
      return true;
    }
  }