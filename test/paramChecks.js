// Copyright 2012 The Obvious Corporation.
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
exports.testConfigFlags = function (test) {
  test.equal(this.graph._config.enforceMatchingParams, true,
      'The Graph config flag should be set')
  test.equal(this.graph.newBuilder()._config.enforceMatchingParams, true,
      'The Builder config flag should be set')
  test.done()
}

// Make sure that using the correct parameters succeeds
exports.testCorrectParamsInlineSucceeds = function (test) {
  this.graph.add('funXY', funXY, ['x', 'y'])

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
    .fin(function () {
      test.done()
    })
}

// Make sure that using the correct parameters succeeds
exports.testCorrectParamsChainedSucceeds = function (test) {
  this.graph.add('funXY', funXY).args('x', 'y')

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
    .fin(function () {
      test.done()
    })
}

// A node with Shepherd-interpreted params passed through using() should pass
exports.testShepherdInterpretedParamsUsingSucceeds = function (test) {
  this.graph.add('x-byFoo', 1)
  this.graph.add('params', this.graph.literal({y: 2}))
  this.graph.add('funXY', funXY, ['x-byFoo', 'params.y'])

  this.graph.newBuilder()
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
    .fin(function () {
      test.done()
    })
}

// A node with Shepherd-interpreted params passed through .run() should pass
exports.testShepherdInterpretedParamsRunSucceeds = function (test) {
  this.graph.add('funXY', funXY, ['x-byFoo', 'params.y'])

  this.graph.newBuilder()
    .builds('funXY')
    .run({'x-byFoo': 1, params: {y: 2}})
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
    .fin(function () {
      test.done()
    })
}

// A node with params supplied through builds() should pass
exports.testShepherdBuildsParamsSucceeds = function (test) {
  this.graph.add('foo-default', 2)
  this.graph.add('y-byFoo', function (foo) {
    return foo
  }, ['foo'])

  this.graph.add('funXY', funXY, ['params.x'])
    .builds('y-byFoo')
      .using('foo-default')

  this.graph.newBuilder()
    .builds('funXY')
    .run({params: {x: 1}})
    .fail(function (err) {
      test.equal(err, undefined, "Correct parameters shouldn't fail.")
    })
    .then(function (results) {
      test.deepEqual(results['funXY'], [1, 2],
          'Correct parameters should return properly')
    })
    .fin(function () {
      test.done()
    })
}

// A node that's missing declared parameters should fail
exports.testMissingParamsInlineFails = function (test) {
  this.graph.add('funXY', funXY, ['x'])

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1})
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node that's missing declared parameters should fail
exports.testMissingParamsChainedFails = function (test) {
  this.graph.add('funXY', funXY).args('x')

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1})
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with extra declared parameters should fail
exports.testExtraParamsInlineFails = function (test) {
  this.graph.add('funX', funX, ['x', 'y'])

  this.graph.newBuilder()
    .builds('funX')
    .run({x: 1, y: 2})
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x, y] but were actually [x]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with extra declared parameters should fail
exports.testExtraParamsChainedFails = function (test) {
  this.graph.add('funX', funX).args('x', 'y')

  this.graph.newBuilder()
    .builds('funX')
    .run({x: 1, y: 2})
    .fail(function (err) {
      var hasMsg = err.message.indexOf('declared [x, y] but were actually [x]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with swapped parameters should fail
exports.testSwapParamsInlineFails = function (test) {
  this.graph.add('funXY', funXY, ['y', 'x'])

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [y, x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with swapped parameters should fail
exports.testSwapParamsChainedFails = function (test) {
  this.graph.add('funXY', funXY).args('y', 'x')

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, y: 2})
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [y, x] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with swapped parameters should fail
exports.testMisnamedParamsInlineFails = function (test) {
  this.graph.add('funXY', funXY, ['x', 'z'])

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, z: 2})
    .fail(function (err) {
      var hasMsg =
          err.message.indexOf('declared [x, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with swapped parameters should fail
exports.testMisnamedParamsChainedFails = function (test) {
  this.graph.add('funXY', funXY).args('x', 'z')

  this.graph.newBuilder()
    .builds('funXY')
    .run({x: 1, z: 2})
    .fail(function (err) {
      var hasMsg = 
          err.message.indexOf('declared [x, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}

// A node with params supplied through builds() should pass
exports.testShepherdExtraBuildsParamsFails = function (test) {
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

  this.graph.newBuilder()
    .builds('funXY')
    .run({params: this.graph.literal({x: 2})})
    .fail(function (err) {
      var hasMsg = 
          err.message.indexOf('declared [x, y, z] but were actually [x, y]')
      test.notEqual(hasMsg, -1)
    })
    .fin(function () {
      test.done()
    })
}
