var testCase = require('nodeunit').testCase
var Q = require('kew')

// set up the test case
var tester = {}

// set up a graph for testing
tester.setUp = function (done) {
  this.response = {name: 'Jeremy'}
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// responses returned immediately should be handled
tester.testResponseReturned = function (test) {
  var response = this.response

  this.graph.add('returns', function () {
    return response
  })

  this.graph.newAsyncBuilder()
    .builds('returns')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.returns, response, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.returns, response, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// responses sent through node-style callback should be handled
tester.testResponseViaCallback = function (test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    return next(undefined, response)
  })

  this.graph.newAsyncBuilder()
    .builds('returns')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.returns, response, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.returns, response, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// responses sent through promise should be handled
tester.testResponseViaPromise = function (test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    var deferred = Q.defer()
    deferred.resolve(response)
    return deferred.promise
  })

  this.graph.newAsyncBuilder()
    .builds('returns')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.returns, response, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.returns, response, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

module.exports = testCase(tester)