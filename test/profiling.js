// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph()
    .enableProfiling()
  done()
}

exports.testProfiling = function (test) {
  function testDelay(delayMs) {
    var defer = Q.defer()
    setTimeout(defer.resolve.bind(defer, true), delayMs)
    return defer.promise
  }

  this.graph.add('response-delayed', testDelay, ['delayMs'])

  var builder = this.graph.newBuilder()
    .builds({delay10: 'response-delayed'})
      .using({delayMs: 10})
    .builds({delay35: 'response-delayed'})
      .using({delayMs: 35})
    .builds({delay31: 'response-delayed'})
      .using({delayMs: 31})
    .builds({delay150: 'response-delayed'})
      .using({delayMs: 150})
    .builds({delay418: 'response-delayed'})
      .using({delayMs: 418})
    .builds({delay472: 'response-delayed'})
      .using({delayMs: 472})
    .compile()

  builder.run({})
    .then(function (data) {
      var profileData = builder.getProfileData()
      test.equal(profileData.length, 1, "There should only be 1 profiling bucket")

      var bucket = profileData[0]
      var timings = bucket.timings
      var delayedTimings = timings['response-delayed']

      test.equal(delayedTimings['10'], 1, "There should be one response in the 10ms bucket")
      test.equal(delayedTimings['30'], 2, "There should be two responses in the 30ms bucket")
      test.equal(delayedTimings['100'], 1, "There should be one response in the 100ms bucket")
      test.equal(delayedTimings['400'], 2, "There should be two responses in the 400ms bucket")

      builder.setProfiling(false)
      test.done()
    })
}