// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// test a standard graph node with a callback
exports.testWithCallbacks = function (test) {
  this.graph.add("name-withCallback", function (callback) {
    callback(null, "Jeremy")
  })

  this.graph.newAsyncBuilder()
    .builds({name: 'name-withCallback'})
    .run({})
    .then(function (data) {
      test.equal(data.name, "Jeremy", "Name should match")
      test.done()
    })
}

// undefineds aren't allowed to be returned directly when callbacks are enabled (due to
// not knowing if the callback is still pending) but they may be returned if callbacks are
// disabled (as only promises or synchronous return values are valid responses)
exports.testWithoutCallbacks = function (test) {
  this.graph.disableCallbacks()
  this.graph.add("name-withoutCallback", function (callback) {
    test.equal(typeof callback, "undefined", "Callback should be undefined")
    return undefined
  })

  this.graph.newAsyncBuilder()
    .builds({name: 'name-withoutCallback'})
    .run({})
    .then(function (data) {
      test.equal(typeof data.name, "undefined", "Name should be undefined")
      test.done()
    })
}