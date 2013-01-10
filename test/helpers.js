// Copyright 2012 The Obvious Corporation.
var oid = require('oid')
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
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
  var builder1 = this.graph.newAsyncBuilder()
  var builder2 = this.graph.newAsyncBuilder()
  var builder3 = this.graph.newAsyncBuilder("named")

  builders[oid.hash(builder1)] = builder1
  builders[oid.hash(builder2)] = builder2
  builders[oid.hash(builder3)] = builder3

  try {
    var builder4 = this.graph.newAsyncBuilder("named")
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