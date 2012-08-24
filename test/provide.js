var testCase = require('nodeunit').testCase
var Q = require('kew')

// set up the test case
var tester = {}

// set up a graph for testing
tester.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// should be able to provide nodes to other nodes at graph creation time
tester.testProvideTo = function (test) {
  var response = this.response
  var prefix = "NAME: "
  var name = "Jeremy"

  this.graph.add('myPrefix', {_literal: prefix})
  this.graph.add('myName', {_literal: name})
  this.graph.add("prefixedName", function (prefix, name) {
    return prefix + name
  }, ['prefix', 'name'])

  this.graph
    .provideTo('prefixedName', {prefix: 'myPrefix', name: 'myName'})
    .newAsyncBuilder()
    .builds('prefixedName')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.prefixedName, prefix + name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.prefixedName, prefix + name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}


module.exports = testCase(tester)