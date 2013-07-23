// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// errors thrown at top level should be caught and fed to the run() request
builder.add(function testErrorThrown(test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function () {
    throw error
  })

  return this.graph.newBuilder()
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
})

// errors returned through next() should be caught and fed to the run() request
builder.add(function testErrorViaCallback(test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function (next) {
    return next(error)
  })

  return this.graph.newBuilder()
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
})

// errors returned through a rejected promise should be caught and fed to the run() request
builder.add(function testErrorViaPromise(test) {
  var error = this.error

  // add a node which throws an error
  this.graph.add('throws', function (next) {
    var deferred = Q.defer()
    deferred.reject(error)
    return deferred.promise
  })

  return this.graph.newBuilder()
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
})

// errors should return with graphInfo field
builder.add(function testThrowWithGraphInfo(test) {
  // add a node which throws an error
  this.graph.add('throws', function (next) {
    throw new Error('Threw an error')
  })

  this.graph.add('first', this.graph.subgraph)
    .builds('throws')

  this.graph.add('second', this.graph.subgraph)
    .builds('first')

  this.graph.add('third', this.graph.subgraph)
    .builds('second')

  return this.graph.newBuilder('builtToFail')
    .builds('third')
    .run()
    .then(function (result) {
      test.equal(result, undefined, 'Result should not be returned through promise')
    })
    .fail(function (err) {
      var graphInfo = err.graphInfo
      test.equal(graphInfo.builderName, 'builtToFail', 'builder name should be builtToFail')

      var failureNodes = graphInfo.failureNodeChain
      var keys = ['throws', 'first', 'second', 'third']
      for (var i = 0; i < keys.length; i++) {
        test.equal(failureNodes[i], keys[i], "Nodes should return in the appropriate order")
      }
    })
})
