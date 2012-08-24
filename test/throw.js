var testCase = require('nodeunit').testCase
var Q = require('kew')

// set up the test case
var tester = {}

// set up a graph for testing
tester.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// errors thrown at top level should be caught and fed to the run() request
tester.testErrorThrown = function (test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function () {
    throw error
  })

  this.graph.newAsyncBuilder()
    .builds('throws')
    .run({}, function (err, result) {
      test.equal(err, error, 'Error should be returned to run() callback')
    })
    .then(function (result) {
      test.equal(result, undefined, 'Result should not be returned through promise')
    })
    .fail(function (err) {
      test.equal(err, error, 'Error should be returned through promise.fail()')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// errors returned through next() should be caught and fed to the run() request
tester.testErrorViaCallback = function (test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function (next) {
    return next(error)
  })

  this.graph.newAsyncBuilder()
    .builds('throws')
    .run({}, function (err, result) {
      test.equal(err, error, 'Error should be returned to run() callback')
    })
    .then(function (result) {
      test.equal(result, undefined, 'Result should not be returned through promise')
    })
    .fail(function (err) {
      test.equal(err, error, 'Error should be returned through promise.fail()')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// errors returned through a rejected promise should be caught and fed to the run() request
tester.testErrorViaPromise = function (test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function (next) {
    var deferred = Q.defer()
    deferred.reject(error)
    return deferred.promise
  })

  this.graph.newAsyncBuilder()
    .builds('throws')
    .run({}, function (err, result) {
      test.equal(err, error, 'Error should be returned to run() callback')
    })
    .then(function (result) {
      test.equal(result, undefined, 'Result should not be returned through promise')
    })
    .fail(function (err) {
      test.equal(err, error, 'Error should be returned through promise.fail()')
    })
    .then(function () {
      test.done()
    })
    .end()
}

module.exports = testCase(tester)