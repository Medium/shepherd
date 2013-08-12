// Copyright 2013 The Obvious Corporation
var nodeunitq = require('nodeunitq')
var shepherd = require('../lib/shepherd')
var builder = new nodeunitq.Builder(exports)

exports.setUp = function (done) {
  this.graph = new shepherd.Graph()
  done()
}

// Test that using an invalid `arg.` in an input fails
builder.add(function testInvalidArgRefFails(test) {
  this.graph.add('echo', function (x) { return x }, ['x'])

  try {
    this.graph.add('subgraph-shouldFail', this.graph.subgraph, ['a', 'b'])
      .builds('echo')
        .using('args.a')
        .when('args.nonexistantArg')
    test.fail('Adding invalid arg should fail')
  } catch (e) {
    test.equal(e.message, 'args.nonexistantArg is referenced but is not provided as an input')
  }

  try {
    this.graph.add('callback-shouldFail', function (a, b) {
      return [a, b]
    }, ['a', 'b'])
      .builds('echo')
        .using('args.a')
        .when('args.nonexistantArg')
    test.fail('Adding invalid arg should fail')
  } catch (e) {
    test.equal(e.message, 'args.nonexistantArg is referenced but is not provided as an input')
  }

  test.done()
})
