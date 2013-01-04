// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// test that silent dependencies cause separate function calls from the builder when different dependencies are used
exports.testSeparateBuilderCalls = function (test) {
  var counter = 0
  function testCount(prefix) {
    return prefix + counter++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', this.graph.literal('ok'))

  this.graph.newAsyncBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using('!dummy-ok', 'prefix-default')
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello1', 'count2 should be 1')
      test.done()
    })
    .fail(function (e) {
      console.error(e)
    })
}

// test that silent dependencies cause separate function calls from subgraphs when different dependencies are used
exports.testSeparateSubgraphCalls = function (test) {
  var counter = 0
  function testCount(prefix) {
    return prefix + counter++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy1', this.graph.literal('dummy1'))
  this.graph.add('dummy2', this.graph.literal('dummy2'))

  this.graph.add('count-first', this.graph.subgraph)
    .builds('dummy1')
    .builds('count-incr')
      .using('!dummy1', 'prefix-default')

  this.graph.add('count-second', this.graph.subgraph)
    .builds('dummy2')
    .builds('count-incr')
      .using('!dummy2', 'prefix-default')

  this.graph.newAsyncBuilder()
    .builds({count1: 'count-first'})
    .builds({count2: 'count-second'})
    .builds({count3: 'count-first'})
    .builds({count4: 'count-second'})
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello1', 'count2 should be 1')
      test.equal(data.count3, 'hello0', 'count1 should be 0')
      test.equal(data.count4, 'hello1', 'count2 should be 1')
      test.done()
    })
    .fail(function (e) {
      console.error(e)
    })
}