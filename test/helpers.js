// Copyright 2012 The Obvious Corporation.
var oid = require('oid')
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// verify that clones show up in the getClones() list
exports.testGetClones = function (test) {
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
}

// verify that all builders are returned by getBuilders()
exports.testGetBuilders = function (test) {
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
}

// test that deep freeze works and prevents object mutations
exports.testDeepFreeze = function (test) {
  this.graph.add('user-default', this.graph.literal({name: 'Jeremy'}))

  this.graph.add('user-mutate', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  this.graph.newBuilder()
    .freezeOutputs()
    .builds('user-mutate')
      .using({user: 'user-default'})
    .run()
    .then(function (data) {
      test.equal(data['user-mutate'].name, 'Jeremy', "Name should not have changed")
    })
    .fail(function (e) {
      test.fail(e.stack)
    })
    .fin(function () {
      test.done()
    })
}

// test that deep freeze doesn't work for private nodes
exports.testDeepFreezePrivate = function (test) {
  this.graph.add('user-default_', this.graph.literal({name: 'Jeremy'}))

  this.graph.add('user-mutate_', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  this.graph.add('user-mutated', this.graph.subgraph)
    .builds('user-default_')
      .modifiers('user-mutate_')

  this.graph.newBuilder()
    .freezeOutputs()
    .builds('user-mutated')
    .run()
    .then(function (data) {
      test.equal(data['user-mutated'].name, 'MUTTTTTAAAAATTTEEE', "Name should have changed")
    })
    .fail(function (e) {
      test.fail(e.stack)
    })
    .fin(function () {
      test.done()
    })
}

// test that deep freeze throws an error if used with 'use strict'
exports.testDeepFreezeError = function (test) {
  "use strict"
  this.graph.add('user-default', this.graph.literal({name: 'Jeremy'}))

  this.graph.add('user-mutate', function (user) {
    user.name = "MUTTTTTAAAAATTTEEE"
    return user
  }, ['user'])

  this.graph.newBuilder()
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
    .fin(function () {
      test.done()
    })
}
