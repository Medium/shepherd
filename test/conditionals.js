// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  this.graph.disableCallbacks()
  done()
}

exports.testRawGuards = function (test) {
  this.graph.add('throw-ifTruthy', function (val) {
    if (val) throw new Error()
    return true
  }, ['val'])

  this.graph.add('throw-ifNotTruthy', function (val) {
    if (!val) throw new Error()
    return true
  }, ['val'])

  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str) {
    return '"' + str + '"'
  }, ['str'])

  function debug() {
    console.log("DEBUG", arguments)
    return arguments[arguments.length - 1]
  }

  this.graph.add('str-transform', debug, ['!str', '!method'])
    .builds({'!isUpper': 'bool-isEqual'})
      .using({str1: 'args.str'}, {str2: this.graph.literal('upper')})
    .builds({'!throws-isUpper': 'throw-ifNotTruthy'})
      .using({val: 'bool-isEqual'})
    .ignoreErrors('throws-isUpper')

    .builds('str-toUpper')
      .using('args.str')

  this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal('Jeremy')}, {method: this.graph.literal('lower')})
    .run()
    .then(function (data) {
      console.log(data)
    })
    .fail(function (e) {
      console.error(e)
      test.fail("threw an error")
    })
    .fin(function () {
      test.done()
    })
}

/*
exports.testGuards = function (test) {
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpper()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLower()
  }, ['str'])

  this.graph.add('str-quotes', function (str) {
    return '"' + str + '"'
  }, ['str'])

  this.graph.add('str-transform', this.graph.subgraph, ['str', 'method'])
    .describe('str-output')
      .builds('str-toUpper')
        .using('args.str')
        .when({isUpper: 'bool-isEqual'})
          .using({str1: 'args.str'}, {str2: this.graph.literal('upper')})

      .builds('str-toUpper')
        .using('args.str')
        .when({isLower: 'bool-isEqual'})
          .using({str1: 'args.str'}, {str2: this.graph.literal('lower')})

      .builds('str-toUpper')
        .using('args.str')

    .end()
    .returns('str-output')

  test.done()
}
*/