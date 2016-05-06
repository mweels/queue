var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var CronJob = require('cron').CronJob;
var _ = require("underscore");
var serialize = require('node-serialize');
var fs = require('fs');

module.exports = Queue;

function Queue(options) {


  if (!(this instanceof Queue))
    return new Queue(options);

  var self = this;
  EventEmitter.call(this);
  options = options || {};
  this.fn = __dirname + "/state.json";
  this.concurrency = options.concurrency || 4;
  this.timeout = options.timeout || 0;
  this.pending = 0;
  this.session = 0;
  this.running = false;
  this.jobs = [];
  this.crons = {};

  this.restore();
  this.start();
}

inherits(Queue, EventEmitter);

var arrayMethods = [
  'push',
  'unshift',
  'splice',
  'pop',
  'shift',
  'slice',
  'reverse',
  'indexOf',
  'lastIndexOf'
];

for (var method in arrayMethods) (function (method) {
  Queue.prototype[method] = function () {
    return Array.prototype[method].apply(this.jobs, arguments);
  };
})(arrayMethods[method]);

Object.defineProperty(Queue.prototype, 'length', {
  get: function () {
    return this.pending + this.jobs.length;
  }
});

Queue.prototype.getModel = function () {
  var jobs = _.map(this.jobs, function (v) {
    return { id: v.id, description: v.description, runCount: v.runCount, errorCount: v.errorCount, runsLeft: v.runsLeft(), running: v.running };
  })

  var crons = _.map(this.crons, function (v) {
    if (v)
      return { jobId: v.context ? v.context.job.id : {}, cronTime: v.cronTime, running: v.running };
  });

  return { jobs: jobs, crons: crons };
}

Queue.prototype.save = function (callback) {

  console.log("Queue Saving..");
  var objS = serialize.serialize({ jobs: this.jobs, crons: this.crons});

  fs.writeFile(this.fn, objS, (err) => {
    if (err) {
      callback(err, null);
    } else {

      console.log("Queue Saved..");
      callback(null, this.fn);
    }
  });
}

Queue.prototype.restore = function (callback) {

  console.log("Restoring Queue..");

  var o = serialize.unserialize(fs.readFileSync(this.fn, { encoding: 'utf8' }));
  this.jobs = [];
    
    this.jobs = o.jobs;
  
  //if (o.jobs.isArray
 this.crons = o.crons;


};

Queue.prototype.addCron = function (job) {

  var context = { job: job, queue: this }
  if (job.cronPattern) {
    var cronJob = new CronJob({
      cronTime: job.cronPattern,
      onTick: function () {
        this.queue.jobs.push(this.job);
        this.queue.start();
      },
      start: true,
      timeZone: 'America/Los_Angeles',
      context
    });

    this.crons[job.id] = cronJob;

  }
  else {
    throw ("No cron information was passed.");
  }
}

Queue.prototype.start = function (cb) {
  if (cb) {

    callOnErrorOrEnd.call(this, cb);

  }

  if (this.pending === this.concurrency) {
    return;
  }

  if (this.jobs.length === 0) {
    if (this.pending === 0) {
      11
      done.call(this);
    }
    return;
  }
  var self = this;
  var job = this.jobs.shift();


  var once = true;
  var session = this.session;
  var timeoutId = null;
  var didTimeout = false;

  function next(err, result) {

    if (once && self.session === session) {
      once = false;
      self.pending--;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      if (err) {


        if ((job.onError() || (job.runsLeft() <= 0 || !job.cronPattern))) {

          if (job.errorCountStop <= job.errorCount) {

            if (self.crons[job.id]) {
              self.crons[job.id].stop();
              self.crons[job.id] = null;
            }
          }
          else {
            job.errorCount++;
            job.lastTime = (job.lastTime * 20);
            setTimeout(function () {
              self.jobs.push(job);
              self.start();
            }, job.lastTime);
          }

        }
        //self.emit('error', err, self.job);

      } else if (didTimeout === false) {
        self.emit('success', result, job);
      }

      if (self.session === session) {
        if (self.pending === 0 && self.jobs.length === 0) {
          done.call(self);
        } else if (self.running) {
          self.start();
        }
      }

    }



  }

  job.runCount++;

  if (job.runsLeft() <= 0 && self.crons[job.id]) {
    self.crons[job.id].stop();
    self.crons[job.id] = null;
  }

  if (this.timeout) {
    timeoutId = setTimeout(function () {
      didTimeout = true;
      if (self.listeners('timeout').length > 0) {
        self.emit('timeout', next, job);
      } else {
        next();
      }
    }, this.timeout);
  }

  this.pending++;
  this.running = true;


  self.emit("update", { jobs: this.jobs, crons: self.crons }, job);

  job.run(next);

  if (this.jobs.length > 0) {
    this.start();
  }
};

Queue.prototype.stop = function () {
  this.running = false;
};

Queue.prototype.end = function (err) {
  this.jobs.length = 0;
  this.pending = 0;
  done.call(this, err);
};

function callOnErrorOrEnd(cb) {
  var self = this;
  this.on('error', onerror);
  this.on('end', onend);

  function onerror(err) { self.end(err); }
  function onend(err) {
    self.removeListener('error', onerror);
    self.removeListener('end', onend);
    cb(err);
  }
}

function done(err) {
  this.session++;
  this.running = false;
  this.emit('end', err);
}
