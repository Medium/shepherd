// Copyright 2012 The Obvious Corporation.
var testCase = require('nodeunit').testCase
var Q = require('kew')

// set up the test case
var tester = {}

// set up a graph for testing
tester.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// test passing args inline vs chained
tester.testDotGraph = function (test) {
  this.graph.add('name-fromLiteral', {_literal: 'Jeremy'})
  this.graph.add('name-toUpper', function (name) {return name.toUpperCase()}, ['name'])
  this.graph.add('age', 5)

  var dotOutput = this.graph.newAsyncBuilder()
    .builds('name-toUpper').using('name-fromLiteral')
    .builds('age')
    .getDotGraph(['req', 'res'])

  test.equal(dotOutput, 'digraph G {\n' +
  '  "BUILDER_OUTPUT" [ color = "green" ];\n' +
  '  "name-toUpper (name-toUpper)" [ color = "orange" ];\n' +
  '  "name-fromLiteral (name-fromLiteral)" [ color = "blue" ];\n' +
  '  "age (age)" [ color = "orange" ];\n' +
  '  "name-fromLiteral (name-fromLiteral)" -> "name-toUpper (name-toUpper)";\n' +
  '  "name-toUpper (name-toUpper)" -> "BUILDER_OUTPUT";\n' +
  '  "age (age)" -> "BUILDER_OUTPUT";\n}\n', "Graph dot output should be predictable")
  test.done()
}

module.exports = testCase(tester)