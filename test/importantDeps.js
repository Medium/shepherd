// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var graph

// set up a graph for testing
exports.setUp = function (done) {
  graph = this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test that when nodes are provided to a parent node, only the important nodes runs
builder.add(function testOnlyImportantsRun(test) {
  var err = new Error('failed')
  var failCount = 0
  var successCount = 0

  this.graph.add('throws-first', function () {
    test.ok("First important node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('throws-second', function () {
    test.ok("Second important node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('throws-third', function () {
    test.ok("Third important node ran")
    failCount++
    return Q.delay(500)
      .then(function () {
        throw err
      })
  })

  this.graph.add('val-first', function () {
    successCount++
    test.fail("First val ran")
    return "NOOO"
  })

  this.graph.add('val-second', function () {
    successCount++
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

  return this.graph.newBuilder()
    .builds('test-thing')
    .run()
    .fail(function (e) {
      test.equal(e, err, "Error was the expected error")
      test.equal(failCount, 3, "Three failures were recorded")
      test.equal(successCount, 0, "No successes were recorded")
    })
})

// testing invalid important builds in the builder
builder.add(function testInvalidImportantBuildBuilder(test) {
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
})

// testing invalid important builds in the graph
builder.add(function testInvalidImportantBuildGraph(test) {
  this.graph.add('name', this.graph.literal('Jeremy'))

  try {
    this.graph.add('invalid', this.graph.subgraph)
      .builds({'invalidName': '!name'})
    test.fail("Should not use ! in value of build objects")
  } catch (e) {
    test.equal(e.message.indexOf('! and ? operators must be on the key') >= 0, true, "Should not use ! in value of build objects")
  }
  test.done()
})

// test that important dependencies call the same function once during builder calls but still call the private inputs
builder.add(function testSeparateBuilderCalls(test) {
  var counterA = 0
  var counterB = 0
  function testCount(prefix) {
    return prefix + counterA++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', function () {
    counterB++
    return true
  })

  return this.graph.newBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using('!dummy-ok', 'prefix-default')
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello0', 'count2 should be 1')
      test.equal(counterB, 1)
    })
})

// test that important dependencies cause separate function calls from the builder when different dependencies are used
builder.add(function testSeparateBuilderCallsObject(test) {
  var counterA = 0
  var counterB = 0
  function testCount(prefix) {
    return prefix + counterA++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', function () {
    counterB++
    return true
  })

  return this.graph.newBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using({'!dummy': 'dummy-ok'}, 'prefix-default')
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello0', 'count2 should be 1')
      test.equal(counterB, 1)
    })
})

// test that important dependencies cause separate function calls from the builder when different dependencies are used
builder.add(function testSeparateBuilderCallsObjectIncorrect(test) {
  var counterA = 0
  var counterB = 0
  function testCount(prefix) {
    return prefix + counterA++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy-ok', function () {
    counterB++
    return true
  })

  return this.graph.newBuilder()
    .builds({count1: 'count-incr'})
      .using('prefix-default')
    .builds({count2: 'count-incr'})
      .using({'dummy': '!dummy-ok'}, 'prefix-default')
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello0', 'count2 should be 1')
      test.equal(counterB, 1)
    })
})

// test that important dependencies cause separate function calls from subgraphs when different dependencies are used
builder.add(function testSeparateSubgraphCalls(test) {
  var counterA = 0
  var counterB = 0
  function testCount(prefix) {
    return prefix + counterA++
  }

  this.graph.add('prefix-default', this.graph.literal('hello'))
  this.graph.add('count-incr', testCount, ['prefix'])
  this.graph.add('dummy1', function () {
    counterB++
    return true
  })
  this.graph.add('dummy2', function () {
    counterB++
    return true
  })

  this.graph.add('count-first', this.graph.subgraph)
    .builds('dummy1')
    .builds('count-incr')
      .using('!dummy1', 'prefix-default')

  this.graph.add('count-second', this.graph.subgraph)
    .builds('dummy2')
    .builds('count-incr')
      .using('!dummy2', 'prefix-default')

  return this.graph.newBuilder()
    .builds({count1: 'count-first'})
    .builds({count2: 'count-second'})
    .builds({count3: 'count-first'})
    .builds({count4: 'count-second'})
    .run({})
    .then(function (data) {
      test.equal(data.count1, 'hello0', 'count1 should be 0')
      test.equal(data.count2, 'hello0', 'count2 should be 0')
      test.equal(data.count3, 'hello0', 'count1 should be 0')
      test.equal(data.count4, 'hello0', 'count2 should be 0')
      test.equal(counterB, 2, 'Should have ran the important deps twice')
    })
})

// test that important dependencies with child members fail
builder.add(function testDynamicGetters(test) {
  try {

  var error = new Error("NO")
  var obj = {}
  obj.__defineGetter__("shouldThrow", function(){
    throw error
  })
  this.graph.add('obj-fromLiteral', this.graph.literal(obj))

  this.graph.add('test-shouldThrow', function () {
    test.fail("Dependencies should have failed")
    return false
  })
    .builds('!obj-fromLiteral.shouldThrow')

  return this.graph.newBuilder()
    .builds('test-shouldThrow')
    .run()
    .then(function () {
      test.fail("Should have thrown an error")
    })
    .fail(function (e) {
      test.ok("Should have thrown an error")
    })

  } catch (e) {
    console.error(e.stack)
  }
})

// guarantee that important nodes w/ disableNodeCache() don't force cache disabling
// for non-important nodes
builder.add(function testDeduplicationImportantDeps(test) {
  var counter = 0
  this.graph.add('bool-incrementCounter', function () {
    counter++
    return true
  })

  this.graph.add('bool-disablesCache', function () {
    return true
  })
  .disableNodeCache()

  return this.graph.newBuilder()
    .builds('!bool-disablesCache')
    .builds({counter1: 'bool-incrementCounter'})
    .builds({counter2: 'bool-incrementCounter'})
    .run({})
    .then(function (data) {
      test.equal(counter, 1, "Counter should only have been incremented once")
    })
})

// Test that recursive dependencies are deduplicated
builder.add(function testRecursiveDependencyError(test) {
  this.graph.add('throws-first', function () {
    throw new Error('nooo')
  })

  this.graph.add('throws-second', this.graph.subgraph)
    .builds('!throws-first')

  this.graph.add('throws-third', this.graph.subgraph)
    .builds('!throws-first')
    .builds('!throws-second')

  var builder = this.graph.newBuilder('test')
    .builds('!throws-first')
    .builds('!throws-second')
    .builds('!throws-third')

  var compiledNodes = builder.getCompiledNodes()
  test.equal(compiledNodes['builderOutput-test_1'].inputs['throws-first'], undefined, "Dependency should have been deduplicated")
  test.equal(compiledNodes['builderOutput-test_1'].inputs['throws-second'], undefined, "Dependency should have been deduplicated")

  return builder.run()
    .then(function () {
      test.fail("Should have thrown an error")
    })
    .fail(function (e) {
      var failureNodes = e.graphInfo.failureNodeChain
      var keys = ['throws-first', 'throws-second', 'throws-third', 'builderOutput-test_1']
      for (var i = 0; i < keys.length; i++) {
        test.equal(failureNodes[i], keys[i], "Nodes should return in the appropriate order")
      }
    })
})

builder.add(function testBuilderOutput(test) {
  graph.add('echo', graph.subgraph, ['val'])

  return graph.newBuilder('output')
    .builds({'!echo1': 'echo'}).using({val: 1})
    .builds({'?echo2': 'echo'}).using({val: 2})
    .builds({'echo3': 'echo'}).using({val: 3})
    .run()
    .then(function (data) {
      test.equal(undefined, data['echo1'])
      test.equal(undefined, data['echo2'])
      test.equal(3, data['echo3'])
    })
})

builder.add(function testImportantChild(test) {
  var sentEmail = 0
  graph.add('sendEmail', function () {
    sentEmail++
    return true
  })

  var counter = 0
  graph.add('counter-inc', function () {
    counter++
    return counter
  })

  graph.add('throws-ifFalse', function (val) {
    if (!val) throw new Error('throws-ifFalse')
    return true
  }, ['val'])

  graph.add('counter-maybeInc', graph.subgraph, ['isOk'])
    .builds('!throws-ifFalse').using({val: 'args.isOk'})
    .builds('counter-inc')

  graph.add('sendEmail-afterMaybeInc', graph.subgraph, ['isOk'])
    .builds('!counter-maybeInc').using('args.isOk')
    .builds('sendEmail')

  return graph.newBuilder('ok')
    .builds('sendEmail-afterMaybeInc').using({isOk: false})
    .run()
    .fail(function (err) {
      if (!/throws-ifFalse/.test(err.message)) throw err
    })
    .then(function () {
      test.equal(0, counter)
      test.equal(0, sentEmail)
    })
})

builder.add(function testImportantDescendant(test) {
  var log = ''
  graph.add('add-v', function (v) {
    log += v
    return true
  }, ['v'])

  graph.add('outer', graph.subgraph)
    .builds('!add-v').using({v: 1})
    .builds('inner')

  graph.add('inner', graph.subgraph)
    .builds('!add-v').using({v: 2})
    .builds('innerinner')

  graph.add('innerinner', graph.subgraph)
    .builds('!add-v').using({v: 3})
    .builds({v4: 'add-v'}).using({v: 4})

  return graph.newBuilder('descendant')
    .builds('outer')
    .run()
    .then(function (data) {
      test.equal(true, data['outer'])
      test.equal('1234', log)
    })
})

builder.add(function testImportantDescendant2(test) {
  var log = ''
  graph.add('add-v', function (v) {
    log += v
    return true
  }, ['v'])

  graph.add('outer', graph.subgraph)
    .builds('!inner')
    .builds('add-v').using({v: 4})

  graph.add('inner', graph.subgraph)
    .builds('!innerinner')
    .builds('add-v').using({v: 3})

  graph.add('innerinner', graph.subgraph)
    .builds({'!v1': 'add-v'}).using({v: 1})
    .builds('add-v').using({v: 2})

  return graph.newBuilder('descendant')
    .builds('outer')
    .run()
    .then(function (data) {
      test.equal(true, data['outer'])
      test.equal('1234', log)
    })
})

builder.add(function testImportantCycle(test) {
  // Try to create a cycle between one and two
  var log = ''
  graph.add('one', function () {
    log += 1
    return 1
  })
  graph.add('two', function () {
    log += 2
    return 2
  })

  graph.add('important-one', function () { return 1 })
    .builds('one')

  graph.add('important-two', function () { return 2 })
    .builds('two')

  graph.add('inner-one', graph.subgraph)
    .builds('!important-two')
    .builds('one')

  graph.add('inner-two', graph.subgraph)
    .builds('!important-one')
    .builds('two')

  graph.add('outer', function (a, b) {
      return a + b
    })
    .builds('inner-one')
    .builds('inner-two')

  return graph.newBuilder('descendant')
    .builds('outer')
    .run()
    .then(function (data) {
      test.equal(3, data['outer'])
      test.equal('21', log)
    })
})
