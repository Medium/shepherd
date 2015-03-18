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
    .run({})
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
    .run({})
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
    .run({})
    .then(function (result) {
      test.equal(result.returns, response, 'Response should be returned through promise')
    })
})

// Make sure any A+-compliant promises are handled correctly.
builder.add(function testAplusCompliant(test) {
  this.graph.add('returns', function () {
    // Return a minimally viable promise, to ensure we don't accidentally try to
    // call methods specific to one promise library or another.
    return {
      then: function (callback) {
        callback('A+ work!')
      }
    }
  })

  return this.graph.newBuilder()
    .builds('returns')
    .run({})
    .then(function (result) {
      test.equal('A+ work!', result.returns)
    })
})
