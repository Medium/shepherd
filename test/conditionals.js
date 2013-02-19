// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

exports.testIgnoredPrivate = function (test) {
  function throwsError() {
    throw new Error("testing")
  }

  this.graph.add('val-test', throwsError)

  this.graph.newBuilder()
    .builds('!val-test')
    .ignoreErrors('val-test')
    .run()
    .then(function () {
      test.ok("Successfully ignored errors")
    })
    .fail(function () {
      test.fail("Failed to ignore errors")
    })
    .fin(function () {
      test.done()
    })
}

exports.testEscape = function (test) {
  var err = new Error("Hello")

  function throwsError() {
    throw err
  }

  function shouldBeSkipped() {
    test.fail("This should be skipped")
    return false
  }

  function catchesError(val) {
    try {
      val.get()
      test.fail("An error should be thrown")
      return false
    } catch (e) {
      test.equal(e, err, "Error should be thrown error")
      return true
    }
  }

  this.graph.add('err-thrown', throwsError)
  this.graph.add('bool-shouldBeSkipped', shouldBeSkipped)
  this.graph.add('bool-caught', catchesError, ['bool'])
    .withGetters()

  this.graph.newBuilder()
    .builds('!err-thrown')
    .builds('!bool-shouldBeSkipped')
      .using('!err-thrown')
    .builds('bool-caught')
      .using('bool-shouldBeSkipped')
    .ignoreErrors('err-thrown', 'bool-shouldBeSkipped')
    .run()
    .then(function (data) {
      test.equal(data['bool-caught'], true, "Error was successfully caught")
      test.ok("Successfully ignored errors in chain")
    })
    .fail(function (e) {
      test.fail("Error wasn't caught successfully")
    })
    .fin(function () {
      test.done()
    })
}