// Copyright 2014. A Medium Corporation.

// set up a graph for testing
var shepherd = require('../lib/shepherd')
var graph

module.exports.setUp = function (done) {
  graph = new shepherd.Graph()
  done()
}

// test onReady callbacks
module.exports.onReady = function (test) {
  graph.add('lastName-fromFirstAndLast', graph.subgraph, ['firstName', 'lastName'])

  // create a builder that will fail its compile due to missing deps
  var builtFirstBuilder
  var firstBuilder = graph.newBuilder()
    .builds('lastName-fromFirstAndLast')
  graph.onReady(function () {
    try {
      firstBuilder.compile([])
    } catch (e) {
      builtFirstBuilder = true
    }
  })

  // create a builder that will successfully compile
  var builtSecondBuilder
  var secondBuilder = graph.newBuilder()
    .builds('lastName-fromFirstAndLast')
  graph.onReady(function () {
    secondBuilder.compile(['firstName', 'lastName'])
    builtSecondBuilder = true
  })

  // verify that one node builder built correctly and one failed
  graph.onReady(function () {
    test.equal(builtFirstBuilder, true, 'first builder built and failed')
    test.equal(builtSecondBuilder, true, 'second builder built')
    test.done()
  })

  // mark the graph as ready
  graph.ready()
}

module.exports.testOnReadyPromises = function (test) {
  graph.add('one').fn(function () {
    return 1
  })

  var finishedBuilder = false
  var finishedReady = false
  var oneBuilder = graph.newBuilder().builds('one')
  graph.onReady(function () {
    return oneBuilder.run().then(function () {
      finishedBuilder = true
    })
  })

  graph.ready().then(function () {
    test.ok(finishedBuilder)
    test.done()
  })
}
