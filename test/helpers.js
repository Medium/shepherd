// Copyright 2012 The Obvious Corporation.
var oid = require('oid')
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var utils = require('../lib/utils')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// verify that clones show up in the getClones() list
builder.add(function testGetClones(test) {
  var graph1 = this.graph.clone()
  var graph2 = graph1.clone()
  var graph3 = graph2.clone()
  var clones

  clones = this.graph.getClones()
  test.equal(clones.length, 1, "Parent graph should only have 1 clone")
  test.equal(clones[0], graph1, "Graph1 should be clone of parent graph")

  clones = graph1.getClones()
  test.equal(clones.length, 1, "Graph1 should only have 1 clone")
  test.equal(clones[0], graph2, "Graph2 should be clone of Graph1")

  clones = graph2.getClones()
  test.equal(clones.length, 1, "Graph2 should only have 1 clone")
  test.equal(clones[0], graph3, "Graph3 should be clone of Graph2")

  clones = graph3.getClones()
  test.equal(clones.length, 0, "Graph2 should have no clones")

  test.done()
})

// verify that all builders are returned by getBuilders()
builder.add(function testGetBuilders(test) {
  var builders = {}
  var builder1 = this.graph.newBuilder()
  var builder2 = this.graph.newBuilder()
  var builder3 = this.graph.newBuilder("named")

  builders[oid.hash(builder1)] = builder1
  builders[oid.hash(builder2)] = builder2
  builders[oid.hash(builder3)] = builder3

  try {
    var builder4 = this.graph.newBuilder("named")
    test.fail(true, "Shouldn't be able to create another builder with the same name")
  } catch (e) {
    test.ok("Shouldn't be able to create another builder with the same name")
  }

  var builderMap = this.graph.getBuilders()
  test.equal(Object.keys(builderMap).length, 3, "There should be 3 builders")

  for (var key in builderMap) {
    var builder = builderMap[key]
    var hash = oid.hash(builder)
    test.equal(builders[hash], builder, "builder should exist")
    delete builders[hash]
  }

  test.equal(Object.keys(builders).length, 0, "There should be no builders remaining")

  test.done()
})

// test that deep freeze works and prevents object mutations
builder.add(function testDeepFreeze(test) {
  this.graph.add('user-default', function () {
    return {name: 'Jeremy'}
  })

  this.graph.add('user-mutate', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  return this.graph.newBuilder()
    .freezeOutputs()
    .builds('user-mutate')
      .using({user: 'user-default'})
    .run()
    .then(function (data) {
      test.equal(data['user-mutate'].name, 'Jeremy', "Name should not have changed")
    })
})

// test that deep freeze doesn't work for private nodes
builder.add(function testDeepFreezePrivate(test) {
  this.graph.add('user-default_', this.graph.literal({name: 'Jeremy'}))

  this.graph.add('user-mutate_', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  this.graph.add('user-mutated', this.graph.subgraph)
    .builds('user-default_')
      .modifiers('user-mutate_')

  return this.graph.newBuilder()
    .freezeOutputs()
    .builds('user-mutated')
    .run()
    .then(function (data) {
      test.equal(data['user-mutated'].name, 'MUTTTTTAAAAATTTEEE', "Name should have changed")
    })
})

// test that deep freeze throws an error if used with 'use strict'
builder.add(function testDeepFreezeError(test) {
  "use strict"
  this.graph.add('user-default', function () {
    return {name: 'Jeremy'}
  })

  this.graph.add('user-mutate', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  return this.graph.newBuilder()
    .freezeOutputs()
    .builds('user-mutate')
      .using({user: 'user-default'})
    .run()
    .then(function (data) {
      test.fail("Should have thrown an assertion error")
    })
    .fail(function (e) {
      test.equal(e.message, "Cannot assign to read only property 'name' of #<Object>", "Should have thrown an assertion error")
    })
})

// Test that parseFnParams works.
builder.add(function testParseFnParams(test) {
  function fn1 () { return 1 }
  function fn2 (x) { return 2 }
  function fn3 (x, $y, _z) { return 3 }
  var fn4 = function (a, b, c) { return 4 }

  var parseFnParams = utils.parseFnParams

  test.deepEqual(parseFnParams(fn1), [], 'No params')
  test.deepEqual(parseFnParams(fn2), ['x'], 'One param')
  test.deepEqual(parseFnParams(fn3), ['x', '$y', '_z'], 'Three params')
  test.deepEqual(parseFnParams(fn4), ['a', 'b', 'c'], 'Three params, declaration with `var`')
  test.deepEqual(parseFnParams(function (K, J, H) {}), ['K', 'J', 'H'], 'Three params, anonymous funciton')

  test.done()
})
