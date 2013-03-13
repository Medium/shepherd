// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test creating a dot graph from a given
exports.testDotGraph = function (test) {
  this.graph.add('name-fromLiteral', {_literal: 'Jeremy'})
  this.graph.add('name-toUpper', function (name) {return name.toUpperCase()}, ['name'])
  this.graph.add('name-toLower', function (name) {return name.toLowerCase()}, ['name'])
  this.graph.add('age', 5)

  var dotOutput = this.graph.newBuilder('DOT_TEST')
    .builds('name-toUpper').using('name-fromLiteral')
    .builds('name-toLower').using('req.query.name')
    .builds('age')
    .getDotGraph(['req', 'res'])

  var expectedOutput = 'digraph G {\n  "builderOutput-DOT_TEST_1 (BUILDER OUTPUT)" [ color = "green" ];\n' +
    '  "name-toUpper-peerGroup1 (name-toUpper)" [ color = "orange" ];\n' +
    '  "name-fromLiteral-peerGroup1 (name-fromLiteral)" [ color = "blue" ];\n' +
    '  "name-toLower-peerGroup1 (name-toLower)" [ color = "orange" ];\n' +
    '  "req" [ color = "red" ];\n' +
    '  "req.query" [ color = "red" ];\n' +
    '  "req.query.name" [ color = "red" ];\n' +
    '  "age-peerGroup1 (age)" [ color = "orange" ];\n' +
    '  "name-fromLiteral-peerGroup1 (name-fromLiteral)" -> "name-toUpper-peerGroup1 (name-toUpper)";\n' +
    '  "name-toUpper-peerGroup1 (name-toUpper)" -> "builderOutput-DOT_TEST_1 (BUILDER OUTPUT)";\n' +
    '  "req" -> "req.query";\n' +
    '  "req.query" -> "req.query.name";\n' +
    '  "req.query.name" -> "name-toLower-peerGroup1 (name-toLower)";\n' +
    '  "name-toLower-peerGroup1 (name-toLower)" -> "builderOutput-DOT_TEST_1 (BUILDER OUTPUT)";\n' +
    '  "age-peerGroup1 (age)" -> "builderOutput-DOT_TEST_1 (BUILDER OUTPUT)";\n}\n'

  test.equal(dotOutput, expectedOutput, "Graph dot output should be predictable")
  test.done()
}