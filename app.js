
var fs = require('fs');
var queue = require("./queue");
var CircularJSON = require('circular-json')
var express = require('express');
var app = express();
var http = require("http");
var server = http.createServer(app);
var bodyParser = require('body-parser');


var io = require('socket.io')(server);

var q = queue();

//app.use(bodyParser.json());
//app.use(bodyParser());

app.use('/index.html', function (req, res) {
    res.sendfile(__dirname + "/index.html");
});
app.use("/addJob", bodyParser.text(), function (req, res) {

    var s = req.body;
    s = s.replace(/\\n/g, "\\n")
        .replace(/\\'/g, "\\'")
        .replace(/\\"/g, '\\"')
        .replace(/\\&/g, "\\&")
        .replace(/\\r/g, "\\r")
        .replace(/\\t/g, "\\t")
        .replace(/\\b/g, "\\b")
        .replace(/\\f/g, "\\f");
    // remove non-printable and other non-valid JSON chars
    s = s.replace(/[\u0000-\u0019]+/g, "");

    //var f = JSON.parse(req.body);
    
    var o = eval('(' + s + ')');
    q.push(o);
    q.save(function(err,fn) {
        q.start(); 
    });
    res.json({ success: true })
})

server.listen(3000);

var job = {
    id: "1",
    description: "Sending address changes",
    run: (cb) => {
        var j = this;
        setTimeout(() => {
            cb(null, "cool");
        }, 2000);
    },
    cronPattern: "* * * * * *",
    runCountStop: 100,
    runCount: 0,
    runsLeft: function () {
        return this.runCountStop - this.runCount;
    },
    lastTime: 1,
    errorCountStop: 3,
    errorCount: 0,
    onError: () => {
        return true;
    }
}

q.addCron(job);


var job = {
    id: "2",
    description: "Sending address changes",
    run: (cb) => {
        var j = this;
        setTimeout(() => {
            cb(null, "cool");
        }, 2000);
    },
    cronPattern: "* * * * * *",
    runCountStop: 100,
    runCount: 0,
    runsLeft: function () {
        return this.runCountStop - this.runCount;
    },
    lastTime: 1,
    errorCountStop: 3,
    errorCount: 0,
    onError: () => {
        return true;
    }
}

q.addCron(job);

updateModels();

var connected = false;
io.on('connection', function (socket) {
    q.on("success",function(result) {                
        io.emit("success",{ result : result,  job : job});        
    });
    
    connected = true;

});

function updateModels() {
    setTimeout(function () {
        if (connected) {
            model = q.getModel();
            io.emit('update', model);
        };
        updateModels();
    }, 100);
}

