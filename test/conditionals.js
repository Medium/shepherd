// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

exports.testEscape = function (test) {
  this.graph.add('val-gt', this.graph.literal('greater than'))
  this.graph.add('val-lte', this.graph.literal('less than equal'))

  this.graph.add('test-conditional', this.graph.subgraph, ['val1', 'val2'])
    .if('args.val1').gt('args.val2')
      .builds('val-gt')
    .else()
      .builds('val-lte')
    .end()

  test.done()
}