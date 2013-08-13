// Copyright 2013 The Obvious Corporation
var nodeunitq = require('nodeunitq')
var shepherd = require('../lib/shepherd')
var builder = new nodeunitq.Builder(exports)

exports.setUp = function (done) {
  var graph = this.graph = new shepherd.Graph()

  var wasRun = this.wasRun = {}

  graph.add('echo', function (val) {
    wasRun['echo'] = 1 + (wasRun['echo'] || 0)
    return val
  }, ['val'])

  graph.add('bool-returnTrue', function () {
    wasRun['bool-returnTrue'] = 1 + (wasRun['bool-returnTrue'] || 0)
    return true
  })

  graph.add('bool-returnFalse', function () {
    wasRun['bool-returnFalse'] = 1 + (wasRun['bool-returnFalse'] || 0)
    return false
  })

  this.genWasRunFn = function (name) {
    return function wasRunFn() {
      wasRun[name] = 1 + (wasRun[name] || 0)
      return name
    }
  }

  done()
}


// Node is built when true
builder.add(function conditionalNodesBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun
  graph.add('one-when', genFn('one-when'))
  graph.add('emptyObj-when', genFn('emptyObj-when'))
  graph.add('emptyStr-unless', genFn('emptyStr-unless'))

  return graph.newBuilder()
    .builds('one-when')
      .when('echo').using({val: graph.literal(1)})
    .builds('emptyObj-when')
      .when('echo').using({val: graph.literal({})})
    .builds('emptyStr-unless')
      .unless('echo').using({val: graph.literal('')})
    .builds('echo')
      .using({val: 'bool-returnTrue'})
    .run()
    .then(function (data) {
      test.equal(wasRun['one-when'], 1)
      test.equal(wasRun['emptyObj-when'], 1)
      test.equal(wasRun['emptyStr-unless'], 1)
      test.equal(wasRun['echo'], 4)

      test.equal(data['one-when'], 'one-when')
      test.equal(data['emptyObj-when'], 'emptyObj-when')
      test.equal(data['emptyStr-unless'], 'emptyStr-unless')
      test.equal(data['echo'], true)
    })
})


// Node isn't built when condition is false
builder.add(function conditionalNodesNotBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun
  graph.add('one-unless', genFn('one-unless'))
  graph.add('emptyObj-unless', genFn('emptyObj-unless'))
  graph.add('emptyStr-when', genFn('emptyStr-when'))

  return graph.newBuilder()
    .builds('one-unless')
      .when('echo').using({val: graph.literal(1)})
    .builds('emptyObj-unless')
      .when('echo').using({val: graph.literal({})})
    .builds('emptyStr-when')
      .unless('echo').using({val: graph.literal('')})
    .builds('echo')
      .using({val: graph.literal('test')})
      .when('bool-returnFalse')
    .run()
    .then(function (data) {
      test.equal(wasRun['one-unless'], undefined)
      test.equal(wasRun['emptyObj-unless'], undefined)
      test.equal(wasRun['emptyStr-when'], undefined)
      test.equal(wasRun['echo'], 3)

      test.equal(data['one-when'], undefined)
      test.equal(data['emptyObj-when'], undefined)
      test.equal(data['emptyStr-unless'], undefined)
      test.equal(data['echo'], true)
    })
})

// Normal dependencies aren't built when condition is false
builder.add(function depsNotBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun

  graph.add('dep1', genFn('dep1'))
  graph.add('dep2', genFn('dep2'))
  graph.add('node1', genFn('node1'), ['x'])
    .builds({y: 'dep1'})
      .when('bool-returnTrue')

  return graph.newBuilder()
    .builds('node1')
      .using({x: 'dep2'})
      .when('bool-returnFalse')
    .run()
    .then(function (data) {
      test.equal(wasRun.node1, undefined)
      test.equal(wasRun.dep1, undefined)
      test.equal(wasRun.dep2, undefined)
      test.equal(wasRun['bool-returnTrue'], undefined)
      test.equal(wasRun['bool-returnFalse'], 1)

      test.equal(data.node1, undefined)
    })
})

// Conditional dependencies aren't built even if conditional parent is
builder.add(function childConditionalDepsNotBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun

  graph.add('dep1', genFn('dep1'))
  graph.add('dep2', genFn('dep2'))
  graph.add('node1', function (x, y) {
    wasRun.node1 = 1 + (wasRun.node1 || 0)
    return [x, y]
  }, ['x'])
    .builds({y: 'dep1'})
      .when('bool-returnFalse')

  return graph.newBuilder()
    .builds('node1')
      .using({x: 'dep2'})
      .when('bool-returnTrue')
    .run()
    .then(function (data) {
      test.equal(wasRun.node1, 1)
      test.equal(wasRun.dep1, undefined)
      test.equal(wasRun.dep2, 1)
      test.equal(wasRun['bool-returnTrue'], 1)
      test.equal(wasRun['bool-returnFalse'], 1)

      test.deepEqual(data.node1, ['dep2', undefined])
    })
})

// Dependency is built for node without condition but not for node
// with false condition
builder.add(function sharedDependencyBuiltOnce(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun

  graph.add('dep1', genFn('dep1')).disableNodeCache()
  graph.add('node1', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])
  graph.add('node2', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])

  return graph.newBuilder()
    .builds('node1')
      .using({x: 'dep1'})
      .when('bool-returnFalse')
    .builds('node2')
      .using({x: 'dep1'})
    .run()
    .then(function (data) {
      test.equal(wasRun.dep1, 1)
      test.equal(wasRun.node1, undefined)
      test.equal(wasRun.node2, 1)
      test.equal(wasRun['bool-returnFalse'], 1)

      test.equal(data.node1, undefined)
      test.equal(data.node2, 'dep1')
    })
})

// Dependency with multiple propagated conditions is built if one of
// them is true
builder.add(function testMultipleConditionsBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun

  graph.add('dep1', genFn('dep1')).disableNodeCache()
  graph.add('node1', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])
  graph.add('node2', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])

  return graph.newBuilder()
    .builds('node1')
      .using({x: 'dep1'})
      .when('bool-returnFalse')
    .builds('node2')
      .using({x: 'dep1'})
      .when('bool-returnTrue')
    .run()
    .then(function (data) {
      test.equal(wasRun.dep1, 1)
      test.equal(wasRun.node1, undefined)
      test.equal(wasRun.node2, 1)
      test.equal(wasRun['bool-returnFalse'], 1)
      test.equal(wasRun['bool-returnTrue'], 1)

      test.equal(data.node1, undefined)
      test.equal(data.node2, 'dep1')
    })
})

// Dependency with multiple propagated conditions isn't built if none
// of them are true
builder.add(function testMultipleConditionsNotBuilt(test) {
  var graph = this.graph
  var genFn = this.genWasRunFn
  var wasRun = this.wasRun

  graph.add('dep1', genFn('dep1')).disableNodeCache()
  graph.add('node1', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])
  graph.add('node2', function (x) {
    wasRun = 1 + (wasRun || 0)
    return x
  }, ['x'])

  return graph.newBuilder()
    .builds('node1')
      .using({x: 'dep1'})
      .when('bool-returnFalse')
    .builds('node2')
      .using({x: 'dep1'})
      .unless('bool-returnTrue')
    .run()
    .then(function (data) {
      test.equal(wasRun.dep1, undefined)
      test.equal(wasRun.node1, undefined)
      test.equal(wasRun.node1, undefined)
      test.equal(wasRun['bool-returnFalse'], 1)
      test.equal(wasRun['bool-returnTrue'], 1)

      test.equal(data.node1, undefined)
      test.equal(data.node2, undefined)
    })
})

// Test that using an invalid `arg.` in an input fails
builder.add(function testInvalidArgRefFails(test) {
  try {
    this.graph.add('subgraph-shouldFail', this.graph.subgraph, ['a', 'b'])
      .builds('echo')
        .using('args.a')
        .when('args.nonexistantArg')
    test.fail('Adding invalid arg should fail')
  } catch (e) {
    test.equal(e.message, 'args.nonexistantArg is referenced but is not provided as an input')
  }

  try {
    this.graph.add('callback-shouldFail', function (a, b) {
      return [a, b]
    }, ['a', 'b'])
      .builds('echo')
        .using('args.a')
        .when('args.nonexistantArg')
    test.fail('Adding invalid arg should fail')
  } catch (e) {
    test.equal(e.message, 'args.nonexistantArg is referenced but is not provided as an input')
  }

  test.done()
})
