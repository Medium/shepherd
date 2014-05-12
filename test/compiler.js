// Copyright 2014 A Medium Corporation

var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var shepherd = require ('../lib/shepherd')
var graph

// set up a graph for testing
exports.setUp = function (done) {
  graph = this.graph = new shepherd.Graph
  graph.add('add').args('x', 'y').fn(function (x, y) { return 1 })
  done()
}

builder.add(function testBasicCompileInputs(test) {
  graph.newBuilder('add-builder').builds('add')
    .setCompileInputs(['x', 'y'])
    .compile()
  test.done()
})

builder.add(function testBrokenCompileInputs(test) {
  try {
    graph.newBuilder('add-builder').builds('add')
      .setCompileInputs(['x'])
      .compile()
  } catch (e) {
    if (e.message.indexOf("Node 'y' was not found") == -1) {
      throw e
    }
  }
  test.done()
})

builder.add(function testNodeInstanceCompileInputs(test) {
  graph.newBuilder('add-builder').builds('add').using({'x': 1})
    .setCompileInputs(['y'])
    .compile()
  test.done()
})
