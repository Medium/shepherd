// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  this.graph.disableCallbacks()
  done()
}

/*
exports.testRawGuards = function (test) {
  this.graph.add('val-fromConditional', function (var_args) {
    for (var i = 0; i < arguments.length; i++) {
      if (!arguments[i].hasError()) return arguments[i].get()
    }
    return undefined
  }, ['arg1', 'arg2', 'arg3'])
    .withGetters()

  this.graph.add('throw-ifTruthy', function (val) {
    if (val) throw new Error("is truthy")
    return true
  }, ['val'])

  this.graph.add('throw-ifNotTruthy', function (val) {
    if (!val) throw new Error("is not truthy")
    return true
  }, ['val'])

  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    console.log("TO UPPER")
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    console.log("TO LOWER")
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str, myChar) {
    console.log("ADDING QUOTES")
    return myChar + str + myChar
  }, ['str', 'char'])

  this.graph.add('char-fromLiteral', function (val) {
    console.log("Deduped")
    return val
  }, ['val'])

  function debug() {
    return arguments[arguments.length - 1]
  }

  this.graph.add('str-transform', debug, ['!str', '!method'])
    .builds({'!val-define1_1': 'str-toUpper'}).using('!throws-define1_1', 'args.str')
    .builds({'!bool-define1_1': 'bool-isEqual'}).using({str1: 'args.method'}, {str2: this.graph.literal('upper')})
    .builds({'!throws-define1_1': 'throw-ifNotTruthy'}).using({val: 'bool-define1_1'})
    .builds({'!throws-define1_1_negated': 'throw-ifTruthy'}).using({val: 'bool-define1_1'})
    .ignoreErrors('!bool-define1_1', 'throws-define1_1', 'throws-define1_1_negated', 'val-define1_1')

    .builds({'!val-define1_2': 'str-toLower'}).using('!throws-define1_2', 'args.str')
    .builds({'!bool-define1_2': 'bool-isEqual'}).using('throws-define1_1_negated', {str1: 'args.method'}, {str2: this.graph.literal('lower')})
    .builds({'!throws-define1_2': 'throw-ifNotTruthy'}).using({val: 'bool-define1_2'})
    .builds({'!throws-define1_2_negated': 'throw-ifTruthy'}).using({val: 'bool-define1_2'})
    .ignoreErrors('bool-define1_2', 'throws-define1_2', 'throws-define1_2_negated', 'val-define1_2')

    .builds('!char-fromLiteral').using('!throws-define1_2_negated', {val: this.graph.literal('*')})
    .builds({'!val-define1_3': 'str-quotes'}).using('!throws-define1_2_negated', 'args.str', 'char-fromLiteral')
    .ignoreErrors('val-define1_3', 'char-fromLiteral')

    .builds({'outputStr': 'val-fromConditional'})
      .using({arg1: 'val-define1_1'}, {arg2: 'val-define1_2'}, {arg3: 'val-define1_3'})

  this.graph.newBuilder()
    .builds({strUpper: 'str-transform'})
      .using({str: this.graph.literal('Jeremy')}, {method: this.graph.literal('upper')})
    .builds({strLower: 'str-transform'})
      .using({str: this.graph.literal('Elizabeth')}, {method: this.graph.literal('lower')})
    .builds({strQuotes: 'str-transform'})
      .using({str: this.graph.literal('Dan')}, {method: this.graph.literal('quotes')})
    .builds({strQuotes2: 'str-transform'})
      .using({str: this.graph.literal('Sho')}, {method: this.graph.literal('quotes')})
    .run()
    .then(function (data) {
      console.log(data)
    })
    .fail(function (e) {
      console.error(e.stack)
      test.fail("threw an error")
    })
    .fin(function () {
      test.done()
    })
}
*/

exports.testGuards = function (test) {
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str, myChar) {
    return myChar + str + myChar
  }, ['str', 'char'])

  this.graph.add('str-echo', function (str) {
    return str
  }, ['str'])

  this.graph.add('char-fromLiteral', function (val) {
    return val
  }, ['val'])

  this.graph.add('str-transform', this.graph.subgraph, ['str', 'method'])
    .describe('str-output')
      .builds('str-toUpper')
        .using('args.str')
        .when('bool-isEqual')
          .using({str1: 'args.method'}, {str2: this.graph.literal('upper')})
      .builds('str-toLower')
        .using('args.str')
        .when({isLower: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('lower')})

      .builds('!char-fromLiteral')
        .using({val: this.graph.literal('"')})
      .builds('str-quotes')
        .using('args.str', 'char-fromLiteral')
        .when({isQuote: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('quotes')})

      .builds('str-echo')
        .using('args.str')
    .end()

  this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal('Jeremy')}, {method: this.graph.literal('upper')})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal('Elizabeth')}, {method: this.graph.literal('lower')})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal('Dan')}, {method: this.graph.literal('quotes')})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal('Sho')}, {method: this.graph.literal('quotes')})
    .run()
    .then(function (data) {
      console.log(data)
    })
    .fail(function (e) {
      console.error(e.stack)
      test.fail("threw an error")
    })
    .fin(function () {
      test.done()
    })
}