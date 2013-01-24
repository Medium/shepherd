// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.response = {name: 'Jeremy'}
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// responses returned immediately should be handled
exports.testResponseReturned = function (test) {
  var response = this.response

  this.graph.add('returns', function () {
    return response
  })

  this.graph.newBuilder()
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
exports.testResponseViaCallback = function (test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    return next(undefined, response)
  })

  this.graph.newBuilder()
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
exports.testResponseViaPromise = function (test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    var deferred = Q.defer()
    deferred.resolve(response)
    return deferred.promise
  })

  this.graph.newBuilder()
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