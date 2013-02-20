// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test that when nodes are provided to a parent node, only the silent nodes runs
exports.testOnlySilentsRun = function (test) {
  var err = new Error('failed')
  var failCount = 0

  this.graph.add('throws-first', function () {
    test.ok("First silent node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('throws-second', function () {
    test.ok("Second silent node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('throws-third', function () {
    test.ok("Third silent node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('val-first', function () {
    test.fail("First val ran")
    return "NOOO"
  })

  this.graph.add('val-second', function () {
    test.fail("Second val ran")
    return "NOOO"
  })

  this.graph.add('test-thing', this.graph.subgraph)
    .builds('!throws-first')
    .builds('val-first')
    .builds('!throws-second')
    .builds('val-second')
    .builds('!throws-third')
    .returns('val-second')

  this.graph.newBuilder()
    .builds('test-thing')
    .run()
    .then(function (data) {
      test.fail("This should have failed")
    })
    .fail(function (e) {
      test.equal(e, err, "Error was the expected error")
      test.equal(failCount, 3, "Three failures were recorded")
    })
    .fin(function () {
      test.done()
    })
}

// testing invalid silent builds in the builder
exports.testInvalidSilentBuildBuilder = function (test) {
  this.graph.add('name', this.graph.literal('Jeremy'))

  try {
    this.graph.newBuilder()
      .builds({'invalid': '!name'})
      .run({})
    test.fail("Should not use ! in value of build objects")
  } catch (e) {
    test.equal(e.message.indexOf('! and ? operators must be on the key') >= 0, true, "Should not use ! in value of build objects")
  }
  test.done()
}

// testing invalid silent builds in the graph
exports.testInvalidSilentBuildGraph = function (test) {
  this.graph.add('name', this.graph.literal('Jeremy'))

  try {
    this.graph.add('invalid', this.graph.subgraph)
      .builds({'invalidName': '!name'})
    test.fail("Should not use ! in value of build objects")
  } catch (e) {
    test.equal(e.message.indexOf('! and ? operators must be on the key') >= 0, true, "Should not use ! in value of build objects")
  }
  test.done()
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

  this.graph.newBuilder()
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

// test that silent dependencies cause separate function calls from the builder when different dependencies are used
exports.testSeparateBuilderCallsObject = function (test) {
  var counter = 0
  function testCount(prefix) {
    return prefix + counter++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', this.graph.literal('ok'))

  this.graph.newBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using({'!dummy': 'dummy-ok'}, 'prefix-default')
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

// test that silent dependencies cause separate function calls from the builder when different dependencies are used
exports.testSeparateBuilderCallsObjectIncorrect = function (test) {
  var counter = 0
  function testCount(prefix) {
    return prefix + counter++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', this.graph.literal('ok'))

  this.graph.newBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using({'dummy': '!dummy-ok'}, 'prefix-default')
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

  this.graph.newBuilder()
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