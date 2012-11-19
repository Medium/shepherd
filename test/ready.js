// set up a graph for testing
module.exports.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// test onReady callbacks
module.exports.onReady = function (test) {
  this.graph.add('lastName-fromFirstAndLast', this.graph.subgraph, ['firstName', 'lastName'])

  // create a builder that will fail its compile due to missing deps
  var builtFirstBuilder
  var firstBuilder = this.graph.newAsyncBuilder()
    .builds('lastName-fromFirstAndLast')
  this.graph.onReady(function () {
    try {
      firstBuilder.compile([])
    } catch (e) {
      builtFirstBuilder = true
    }
  })

  // create a builder that will successfully compile
  var builtSecondBuilder
  var secondBuilder = this.graph.newAsyncBuilder()
    .builds('lastName-fromFirstAndLast')
  this.graph.onReady(function () {
    secondBuilder.compile(['firstName', 'lastName'])
    builtSecondBuilder = true
  })

  // verify that one node builder built correctly and one failed
  this.graph.onReady(function () {
    test.equal(builtFirstBuilder, true, 'first builder built and failed')
    test.equal(builtSecondBuilder, true, 'second builder built')
    test.done()
  })

  // mark the graph as ready
  this.graph.ready()
}