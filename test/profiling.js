// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph()
    .disableCallbacks()
  done()
}

// test that profiling doesn't return a result (most of the time) when set to 0.00001
builder.add(function testMinimalProfiling(test) {
  function testDelay(delayMs) {
    return Q.delay(true, delayMs)
  }

  this.graph.add('response-delayed', testDelay, ['delayMs'])

  var builder = this.graph.newBuilder()
    .builds({delay10: 'response-delayed'})
      .using({delayMs: 10})
    .builds({delay35: 'response-delayed'})
      .using({delayMs: 32})
    .builds({delay31: 'response-delayed'})
      .using({delayMs: 31})
    .builds({delay150: 'response-delayed'})
      .using({delayMs: 150})
    .builds({delay418: 'response-delayed'})
      .using({delayMs: 418})
    .builds({delay472: 'response-delayed'})
      .using({delayMs: 472})
    .compile([])
    .setProfilingFrequency(0.00001)

  return builder.run({})
    .then(function (data) {
      var profileData = builder.getProfileData()
      test.equal(profileData.length, 1, "There should only be 1 profiling bucket")

      var bucket = profileData[0]
      var timings = bucket.timings
      var delayedTimings = timings['response-delayed']
      test.equal(delayedTimings, undefined, "There should be no profile data")
      builder.setProfilingFrequency(0)
    })
})
