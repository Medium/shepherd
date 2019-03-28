var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

builder.add(function testCollision(test) {
  var graph = this.graph
  var N = 2000
  var i = 0

  for (i = 0; i <= N; i++) {
    this.graph
      .add('return-' + i, (function (i) { return i }).bind(null, i))
  }

  var builder = graph.newBuilder()
  for (i = 0; i <= N; i++) {
    builder.builds('return-' + i)
  }

  return builder
    .run({})
    .then(function (result) {
      for (var i = 0; i <= N; i++) {
        test.equal(i, result['return-' + i], 'Detected graph node collision')
      }
    })
})
