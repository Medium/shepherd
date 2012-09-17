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

// test creating a dot graph from a given
tester.testDotGraph = function (test) {
  this.graph.add('name-fromLiteral', {_literal: 'Jeremy'})
  this.graph.add('name-toUpper', function (name) {return name.toUpperCase()}, ['name'])
  this.graph.add('name-toLower', function (name) {return name.toLowerCase()}, ['name'])
  this.graph.add('age', 5)

  var dotOutput = this.graph.newAsyncBuilder()
    .builds('name-toUpper').using('name-fromLiteral')
    .builds('name-toLower').using('req.query.name')
    .builds('age')
    .getDotGraph(['req', 'res'])

  var expectedOutput = 'digraph G {\n  "BUILDER_OUTPUT" [ color = "green" ];\n  "name-toUpper (name-toUpper)" [ color = "orange" ];\n  "name-fromLiteral (name-fromLiteral)" [ color = "blue" ];\n  "name-toLower (name-toLower)" [ color = "orange" ];\n  "req" [ color = "red" ];\n  "req.query" [ color = "red" ];\n  "req.query.name" [ color = "red" ];\n  "age (age)" [ color = "orange" ];\n  "name-fromLiteral (name-fromLiteral)" -> "name-toUpper (name-toUpper)";\n  "name-toUpper (name-toUpper)" -> "BUILDER_OUTPUT";\n  "req" -> "req.query";\n  "req.query" -> "req.query.name";\n  "req.query.name" -> "name-toLower (name-toLower)";\n  "name-toLower (name-toLower)" -> "BUILDER_OUTPUT";\n  "age (age)" -> "BUILDER_OUTPUT";\n}\n'

  test.equal(dotOutput, expectedOutput, "Graph dot output should be predictable")
  test.done()
}

module.exports = testCase(tester)