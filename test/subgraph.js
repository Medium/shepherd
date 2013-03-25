// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test that building a node by the same name twice fails
exports.testDuplicateAliasesFail = function (test) {
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
}

// test that a subgraph can return the expected input
exports.testReturns = function (test) {
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

  this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fail(function (e) {
      test.fail("Should not return through .fail()")
    })
    .fin(function () {
      test.done()
    })
}

// test that a subgraph can return the first element in an array
exports.testReturnsArray = function (test) {
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

  this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fail(function (e) {
      test.fail("Should not return through .fail()")
    })
    .fin(function () {
      test.done()
    })
}