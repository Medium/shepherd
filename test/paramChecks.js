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
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
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
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
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

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})

// A node that's missing declared parameters should fail
builder.add(function testMissingParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('x')

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with extra declared parameters should fail
builder.add(function testExtraParamsInlineFails(test) {
  this.graph.add('funX', funX, ['x', 'y'])

  return this.graph.newBuilder()
    .builds('funX')
    .run({x: 1, y: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x, y] but were actually [x]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with extra declared parameters should fail
builder.add(function testExtraParamsChainedFails(test) {
  this.graph.add('funX', funX).args('x', 'y')

  return this.graph.newBuilder()
    .builds('funX')
    .run({x: 1, y: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x, y] but were actually [x]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with swapped parameters should fail
builder.add(function testSwapParamsInlineFails(test) {
  this.graph.add('funXY', funXY, ['y', 'x'])

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [y, x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with swapped parameters should fail
builder.add(function testSwapParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('y', 'x')

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [y, x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with swapped parameters should fail
builder.add(function testMisnamedParamsInlineFails(test) {
  this.graph.add('funXY', funXY, ['x', 'z'])

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, z: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [x, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})

// A node with swapped parameters should fail
builder.add(function testMisnamedParamsChainedFails(test) {
  this.graph.add('funXY', funXY).args('x', 'z')

  return this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, z: 2})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [x, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
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

  return this.graph.newBuilder()
    .builds('funXY')
    .run({params: this.graph.literal({x: 2})})
    .then(function (data) { test.fail('Invalid params should fail') })
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [x, y, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
})
