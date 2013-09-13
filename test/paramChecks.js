// Copyright 2012 The Obvious Corporation.
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var shepherd = require('../lib/shepherd')

function funX(x) {
  return x
}

function funXY(x, y) {
  return [x, y]
}

function testFailsWithErr(test, errStr, promise) {
  return promise
    .then(function (data) { test.fail('Invalid parameters should fail') })
    .fail(function (err) {
      test.notEqual(err.message.indexOf(errStr), -1,
          'Expected error message like "' + errStr + '" but was "' +
          err.message + '"')
    })
}


exports.setUp = function (done) {
  this.graph = new shepherd.Graph().enforceMatchingParams()
  done()
}


// Config flags are being set correctly
builder.add(function testConfigFlags(test) {
  test.equal(this.graph._config.enforceMatchingParams, true,
      'The Graph config flag should be set')
  test.equal(this.graph.newBuilder()._config.enforceMatchingParams, true,
      'The Builder config flag should be set')
  test.done()
})

// Make sure that using the correct parameters succeeds
builder.add(function testCorrectParamsInlineSucceeds(test) {
  this.graph.add('funXY', funXY, ['x', 'y'])

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
})

// Make sure that using the correct parameters succeeds
builder.add(function testCorrectParamsChainedSucceeds(test) {
  this.graph.add('funXY', funXY).args('x', 'y')

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
})

// A node with Shepherd-interpreted params passed through using() should pass
builder.add(function testShepherdInterpretedParamsUsingSucceeds(test) {
  this.graph.add('x-byFoo', 1)
  this.graph.add('params', this.graph.literal({y: 2}))
  this.graph.add('funXY', funXY, ['x-byFoo', 'params.y'])

  return this.graph.newBuilder()
    .builds('funXY')
      .using('params.y')
      .using('x-byFoo')
    .run()
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
})

// A node with Shepherd-interpreted params passed through .run() should pass
builder.add(function testShepherdInterpretedParamsRunSucceeds(test) {
  this.graph.add('funXY', funXY, ['x-byFoo', 'params.y'])

  return this.graph.newBuilder()
    .builds('funXY')
    .run({'x-byFoo': 1, params: {y: 2}})
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
})

// A node with params supplied through builds() should pass
builder.add(function testShepherdBuildsParamsSucceeds(test) {
  this.graph.add('foo-default', 2)
  this.graph.add('y-byFoo', function (foo) {
    return foo
  }, ['foo'])

  this.graph.add('funXY', funXY, ['params.x'])
    .builds('y-byFoo')
      .using('foo-default')

  return this.graph.newBuilder()
    .builds('funXY')
    .run({params: {x: 1}})
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
})

// A node that's missing declared parameters should fail
builder.add(function testMissingParamsInlineFails(test) {
  this.graph.add('funXY', funXY, ['x'])

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1})
  return testFailsWithErr(test, 'declared [x] but were actually [x, y]', promise)
})

// A node that's missing declared parameters should fail
builder.add(function testMissingParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('x')

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1})
  return testFailsWithErr(test, 'declared [x] but were actually [x, y]', promise)
})

// A node with extra declared parameters should fail
builder.add(function testExtraParamsInlineFails(test) {
  this.graph.add('funX', funX, ['x', 'y'])

  var promise = this.graph.newBuilder()
      .builds('funX')
      .run({x: 1, y: 2})
  return testFailsWithErr(test, 'declared [x, y] but were actually [x]', promise)
})

// A node with extra declared parameters should fail
builder.add(function testExtraParamsChainedFails(test) {
  this.graph.add('funX', funX).args('x', 'y')

  var promise = this.graph.newBuilder()
      .builds('funX')
      .run({x: 1, y: 2})
  return testFailsWithErr(test, 'declared [x, y] but were actually [x]', promise)
})

// A node with swapped parameters should fail
builder.add(function testSwapParamsInlineFails(test) {
  this.graph.add('funXY', funXY, ['y', 'x'])

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1, y: 2})
  return testFailsWithErr(test, 'declared [y, x] but were actually [x, y]', promise)
})

// A node with swapped parameters should fail
builder.add(function testSwapParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('y', 'x')

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1, y: 2})
  return testFailsWithErr(test, 'declared [y, x] but were actually [x, y]', promise)
})

// A node with swapped parameters should fail
builder.add(function testMisnamedParamsInlineFails(test) {
  this.graph.add('funXY', funXY, ['x', 'z'])

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1, z: 2})
  return testFailsWithErr(test, 'declared [x, z] but were actually [x, y]', promise)
})

// A node with swapped parameters should fail
builder.add(function testMisnamedParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('x', 'z')

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({x: 1, z: 2})
  return testFailsWithErr(test, 'declared [x, z] but were actually [x, y]', promise)
})

// A node with params supplied through builds() should pass
builder.add(function testShepherdExtraBuildsParamsFails(test) {
  this.graph.add('foo-default', 2)
  this.graph.add('y-byFoo', function (foo) {
    return foo
  }, ['foo'])
  this.graph.add('z-byY', function (y) {
    return y + 1
  }, ['y'])

  this.graph.add('funXY', funXY, ['params.x'])
    .builds('y-byFoo')
      .using('foo-default')
    .builds('z-byY')
      .using('y-byFoo')

  var promise = this.graph.newBuilder()
      .builds('funXY')
      .run({params: this.graph.literal({x: 2})})
  return testFailsWithErr(test, 'declared [x, y, z] but were actually [x, y]', promise)
})

// Test that no params fails
builder.add(function testNoParamsFails(test) {
  this.graph.add('funXY', funXY)

  var promise = this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, z: 2})
  return testFailsWithErr(test, 'declared [] but were actually [x, y]', promise)
})

// Test that subgraph's don't get checked
builder.add(function testSubgraphSucceeds(test) {
  this.graph.add('arr-funXY', funXY, ['x', 'y'])
  this.graph.add('str-fromArr', function (arr) {
    return arr.join('')
  }, ['arr'])

  this.graph.add('x-double', this.graph.subgraph, ['x', 'y'])
    .builds('arr-funXY')
      .using('args.*')
    .builds('str-fromArr')
      .using('arr-funXY')

  return this.graph.newBuilder()
    .builds('x-double')
    .run({x: 'a', y: 'b'})
    .then(function (results) {
      test.equal(results['x-double'], 'ab',
          "graph.subgraph shouldn't be param checked")
    })
})
