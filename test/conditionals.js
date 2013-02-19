// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// TODO: test ignoring non-private members
// TODO: test that not ignoring a failing node causes a failure
// TODO: test that ignoring a node still calls the node
// TODO: test that caching doesn't provide bad results (or maybe this should change hashes)

exports.testIgnoredPrivate = function (test) {
  counter = 0

  function throwsError() {
    counter++
    throw new Error("testing")
  }

  this.graph.add('val-test', throwsError)

  this.graph.newBuilder()
    .builds('!val-test')
    .ignoreErrors('val-test')
    .run()
    .then(function () {
      test.equal(counter, 1, "Counter should have been incremented ")
      test.ok("Successfully ignored errors")
    })
    .fail(function () {
      test.fail("Failed to ignore errors")
    })
    .fin(function () {
      test.done()
    })
}

exports.testFakeIf = function (test) {
  try {
    this.graph.add('throws-ifFalse', function (val) {
      if (!val) throw new Error("Failed")
      return val
    }, ['bool'])

    this.graph.add('throws-ifAnyTrue', function (vals) {
      for (var i = 0; i < vals.length; i++) {
        if (!!vals[i]) throw new Error("else failed") 
      }
      return true
    }, ['bools']).needsGetters()

    this.graph.add('bool-valNotNullish', function (val) {
      return val !== null && typeof val != 'undefined'
    })

    this.graph.newBuilder()

      .builds({'!bool-if1_1': 'bool-valNotNullish'})
        .using({val1: this.graph.literal(null)})
      .builds({'!throws-if1_1': 'throws-ifFalse'})
        .using('!bool-if1_1')
      .ignoreErrors('throws-if1_1')

      .builds({'!throws-if1_2': 'throws-ifAnyTrue'})
        .using({bools: ['bool-if1_1']})
      .ignoreErrors('throws-if1_2')

      .run()
      .then(function (data) {
        console.log("DATA", data)
        test.ok("Successfully ignored errors")
      })
      .fail(function (e) {
        console.error(e.stack)
        test.fail("Failed to ignore errors")
      })
      .fin(function () {
        test.done()
      })
  } catch (e) {
    console.error(e)
  }
}

exports.testBetterIf = function (test) {
  try {
    this.graph.add('val-echo', function (val) {
      return val
    }, ['val'])
    this.graph.add('throws-ifFalse', function (val) {
      if (!val) throw new Error("Failed")
      return val
    }, ['bool'])

    this.graph.add('throws-ifAnyTrue', function (vals) {
      for (var i = 0; i < vals.length; i++) {
        if (!!vals[i]) throw new Error("else failed") 
      }
      return true
    }, ['bools']).needsGetters()

    this.graph.add('bool-valNotNullish', function (val) {
      return val !== null && typeof val != 'undefined'
    })

    this.graph.newBuilder()
      .if('bool-valNotNullish').using({val1: this.graph.literal(null)})
        .builds({'bool-isNullish1': 'val-echo'})
          .using({val: this.graph.literal(false)})

      .else()
        .builds({'bool-isNullish2': 'val-echo'})
          .using({val: this.graph.literal(true)})

      .end()

      .run()
      .then(function (data) {
        console.log("DATA", data)
        test.ok("Successfully ignored errors")
      })
      .fail(function (e) {
        console.error(e.stack)
        test.fail("Failed to ignore errors")
      })
      .fin(function () {
        test.done()
      })
  } catch (e) {
    console.error(e)
  }
}