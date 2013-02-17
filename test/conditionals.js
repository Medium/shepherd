// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

exports.testBasic = function (test) {
  try {
    this.graph.add('val-lessThan', this.graph.literal('less than'))
    this.graph.add('val-greaterThan', this.graph.literal('greater than'))
    this.graph.add('val-equalTo', this.graph.literal('equal to'))

    this.graph.add('compare', this.graph.subgraph, ['num1', 'num2'])
      .if('args.num1').lt('args.num2')
        .builds('val-lessThan')
      .elseIf('args.num1').gt('args.num2')
        .builds('val-greaterThan')
      .else()
        .builds('val-equalTo')
      .endIf()
  } catch (e) {
    console.error(e)
  }
}