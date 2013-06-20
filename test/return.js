// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.response = {name: 'Jeremy'}
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// responses returned immediately should be handled
builder.add(function testResponseReturned(test) {
  var response = this.response

  this.graph.add('returns', function () {
    return response
  })

  return this.graph.newBuilder()
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
})

// responses sent through node-style callback should be handled
builder.add(function testResponseViaCallback(test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    return next(undefined, response)
  })

  return this.graph.newBuilder()
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
})

// responses sent through promise should be handled
builder.add(function testResponseViaPromise(test) {
  var response = this.response

  this.graph.add('returns', function (next) {
    var deferred = Q.defer()
    deferred.resolve(response)
    return deferred.promise
  })

  return this.graph.newBuilder()
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
})
