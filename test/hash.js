// Copyright 2013 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph().disableCallbacks()
  done()
}

exports.testHashDeduplication = function (test) {
  var counters = {
    a: 0,
    b: 0
  }

  this.graph.add('val-a', function () {
    counters.a++
    return 'a'
  })

  this.graph.add('val-b', function () {
    counters.b++
    return 'b'
  })

  this.graph.add('dep-first', this.graph.literal('first'))
  this.graph.add('dep-second', this.graph.literal('second'))
  this.graph.add('dep-third', this.graph.literal('third'))
  this.graph.add('dep-fourth', this.graph.literal('fourth'))
  this.graph.add('dep-fifth', this.graph.literal('fifth'))

  this.graph.newBuilder()
    .builds({a1: 'val-a'})
    .builds({a2: 'val-a'})
      .using('!dep-first')
    .builds({a3: 'val-a'})
      .using('!dep-second', '!dep-third')
    .builds({b1: 'val-b'})
      .using('!dep-second', '!dep-third')
    .builds({b2: 'val-b'})
      .using('!dep-fourth', '!dep-fifth')
    .builds({b3: 'val-b'})
      .using('!dep-fourth', '!dep-fifth')
    .run()
    .then(function (data) {
      test.equal(counters.a, 1, "val-a should only have been ran once")
      test.equal(counters.b, 1, "val-b should only have been ran once")
    })
    .fail(function (e) {
      console.error(e.stack)
    })
    .fin(function () {
      test.done()
    })
}