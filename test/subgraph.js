// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// throw an error when an invalid arg is referenced
builder.add(function testErrorWhenMissingArg(test) {
  this.graph.add('val-echo', function (val) {
    return val
  }, ['val'])

  try {
    this.graph.add('val-shouldFail', this.graph.subgraph, ['val1', 'val2'])
      .builds('val-echo')
        .using('args.val3')
    test.fail("Should have thrown an error due to an invalid arg")
  } catch (e) {
    test.equal(e.message, "args.val3 is referenced but is not provided as an input")
  }

  test.done()
})

// test that building a node by the same name twice fails
builder.add(function testDuplicateAliasesFail(test) {
  this.graph.add('bool-true', this.graph.literal(true))

  try {
    this.graph.newBuilder()
      .builds('bool-true')
      .builds('bool-true')
    test.fail("Should not be able to use the same alias twice")
  } catch (e) {
    test.equal(e.message, "You may only use the same alias in a .builds() once in a subgraph", "Should not be able to use the same alias twice")
  }

  try {
    this.graph.newBuilder()
      .builds({myBool: 'bool-true'})
      .builds({myBool: 'bool-true'})
    test.fail("Should not be able to use the same alias twice")
  } catch (e) {
    test.equal(e.message, "You may only use the same alias in a .builds() once in a subgraph", "Should not be able to use the same alias twice")
  }

  test.done()
})

// test that a subgraph can return the expected input
builder.add(function testReturns(test) {
  var name = 'Jeremy'

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('name-toUpper', this.graph.subgraph, ['name'])
    .builds('str-toUpper')
      .using({str: 'args.name'})
    .builds('str-toLower')
      .using({str: 'args.name'})
    .returns('str-toUpper')

  return this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
})

// test that a subgraph can return the first element in an array
builder.add(function testReturnsArray(test) {
  var name = 'Jeremy'

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('array-fromStr', function (str) {
    return [str]
  }, ['str'])

  this.graph.add('name-toUpper', this.graph.subgraph, ['name'])
    .builds('str-toUpper')
      .using({str: 'args.name'})
    .builds('array-fromStr')
      .using('str-toUpper')
    .returns('array-fromStr.0')

  return this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
})
