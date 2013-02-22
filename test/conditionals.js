// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  this.graph.disableCallbacks()
  done()
}

// test guards with else
exports.testGuardsWithElse = function (test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: 'Jon'}
  ]
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
        .when({isUpper: 'bool-isEqual'})
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
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.equal(data.str1, testInputs[0].output, data.str1 + " should be " + testInputs[0].output)
      test.equal(data.str2, testInputs[1].output, data.str2 + " should be " + testInputs[1].output)
      test.equal(data.str3, testInputs[2].output, data.str3 + " should be " + testInputs[2].output)
      test.equal(data.str4, testInputs[3].output, data.str4 + " should be " + testInputs[3].output)
      test.equal(data.str5, testInputs[4].output, data.str5 + " should be " + testInputs[4].output)
    })
    .fail(function (e) {
      test.fail("threw an error")
    })
    .fin(function () {
      test.done()
    })
}

// test guards without else
exports.testGuardsWithoutElse = function (test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: undefined}
  ]
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
        .when({isUpper: 'bool-isEqual'})
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
    .end()

  this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.equal(data.str1, testInputs[0].output, data.str1 + " should be " + testInputs[0].output)
      test.equal(data.str2, testInputs[1].output, data.str2 + " should be " + testInputs[1].output)
      test.equal(data.str3, testInputs[2].output, data.str3 + " should be " + testInputs[2].output)
      test.equal(data.str4, testInputs[3].output, data.str4 + " should be " + testInputs[3].output)
      test.equal(data.str5, testInputs[4].output, data.str5 + " should be " + testInputs[4].output)
    })
    .fail(function (e) {
      test.fail("threw an error")
    })
    .fin(function () {
      test.done()
    })
}

// test guards with syntax error
exports.testGuardsWithSyntaxError = function (test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: undefined}
  ]
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return strasdfasdf.toLowerCase()
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
        .when({isUpper: 'bool-isEqual'})
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
    .end()

  this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.fail("Should fail due to a syntax error")
    })
    .fail(function (e) {
      test.ok("Failed due to a syntax error")
    })
    .fin(function () {
      test.done()
    })
}