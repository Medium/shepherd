// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
module.exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test search for builders
module.exports.findBuilders = function (test) {
  var builders = {
    '': 'Just a test builder',
    'test': null,
    'userProfile': 'Retrieves a user profile',
    'verifyEmail': 'Verifies a user email'
  }

  for (var key in builders) {
    this.graph.newBuilder(key.length ? key : null).description(builders[key])
  }

  // all builders
  results = this.graph.findBuilders()
  test.equals(Object.keys(results).length, 4, "Should have returned 4 builders")
  test.equals(results['anonymousBuilder.1'], builders[''], 'Anonymous builder should have been returned')
  test.equals(results['testBuilder'], builders['testBuilder'], 'testBuilder should have been returned')
  test.equals(results['userProfileBuilder'], builders['userProfileBuilder'], 'userProfileBuilder should have been returned')
  test.equals(results['verifyEmailBuilder'], builders['verifyEmailBuilder'], 'verifyEmailBuilder should have been returned')

  // anonymous builders
  results = this.graph.findBuilders('anonymousBuilder')
  test.equals(Object.keys(results).length, 1, "Should have returned 1 builder")
  test.equals(results['anonymousBuilder.1'], builders[''], 'Anonymous builder should have been returned')

  // builders with the word user in the name or description
  results = this.graph.findBuilders('user')
  test.equals(Object.keys(results).length, 2, "Should have returned 4 builders")
  test.equals(results['userProfileBuilder'], builders['userProfileBuilder'], 'userProfileBuilder should have been returned')
  test.equals(results['verifyEmailBuilder'], builders['verifyEmailBuilder'], 'verifyEmailBuilder should have been returned')

  // builders with the word test in the name or description
  results = this.graph.findBuilders('test')
  test.equals(Object.keys(results).length, 2, "Should have returned 2 builders")
  test.equals(results['anonymousBuilder.1'], builders[''], 'Anonymous builder should have been returned')
  test.equals(results['testBuilder'], builders['testBuilder'], 'testBuilder should have been returned')

  // builders with the words test and builder in the name or description
  results = this.graph.findBuilders('test', 'builder')
  test.equals(Object.keys(results).length, 1, "Should have returned 1 builder")
  test.equals(results['anonymousBuilder.1'], builders[''], 'Anonymous builder should have been returned')

  // builders with the words test and builder in the name or description
  results = this.graph.findBuilders(['test', 'builder'])
  test.equals(Object.keys(results).length, 1, "Should have returned 1 builder")
  test.equals(results['anonymousBuilder.1'], builders[''], 'Anonymous builder should have been returned')

  test.done()
}

// test searching for graph nodes
module.exports.findNodes = function (test) {
  var numInternalNodes = 0
  var results
  var graphNodes = {
    'name-random': 'Returns a random name',
    'name-toUpperCase': 'Upper cases a name',
    'name-toLowerCase': 'Lower cases a name',
    'name-fromLiteral': null,
    'str-toLowerCase': 'Lower cases a string'
  }

  for (var key in graphNodes) {
    this.graph.add(key).description(graphNodes[key])
  }

  // all graph nodes
  results = this.graph.findNodes()
  test.equals(Object.keys(results).length, 5 + numInternalNodes, "Should have returned 5 results")
  test.equals(results['name-random'], graphNodes['name-random'], 'name-random should have been returned')
  test.equals(results['name-toUpperCase'], graphNodes['name-toUpperCase'], 'name-toUpperCase should have been returned')
  test.equals(results['name-toLowerCase'], graphNodes['name-toLowerCase'], 'name-toLowerCase should have been returned')
  test.equals(results['name-fromLiteral'], graphNodes['name-fromLiteral'], 'name-fromLiteral should have been returned')
  test.equals(results['str-toLowerCase'], graphNodes['str-toLowerCase'], 'str-toLowerCase should have been returned')

  // graph nodes with the word name
  results = this.graph.findNodes('name')
  test.equals(Object.keys(results).length, 4, "Should have returned 4 results")
  test.equals(results['name-random'], graphNodes['name-random'], 'name-random should have been returned')
  test.equals(results['name-toUpperCase'], graphNodes['name-toUpperCase'], 'name-toUpperCase should have been returned')
  test.equals(results['name-toLowerCase'], graphNodes['name-toLowerCase'], 'name-toLowerCase should have been returned')
  test.equals(results['name-fromLiteral'], graphNodes['name-fromLiteral'], 'name-fromLiteral should have been returned')

  // graph nodes with cases and a
  results = this.graph.findNodes('cases', 'a')
  test.equals(Object.keys(results).length, 3, "Should have returned 5 results")
  test.equals(results['name-toUpperCase'], graphNodes['name-toUpperCase'], 'name-toUpperCase should have been returned')
  test.equals(results['name-toLowerCase'], graphNodes['name-toLowerCase'], 'name-toLowerCase should have been returned')
  test.equals(results['str-toLowerCase'], graphNodes['str-toLowerCase'], 'str-toLowerCase should have been returned')

  // graph nodes with cases and a
  results = this.graph.findNodes(['cases', 'a'])
  test.equals(Object.keys(results).length, 3, "Should have returned 5 results")
  test.equals(results['name-toUpperCase'], graphNodes['name-toUpperCase'], 'name-toUpperCase should have been returned')
  test.equals(results['name-toLowerCase'], graphNodes['name-toLowerCase'], 'name-toLowerCase should have been returned')
  test.equals(results['str-toLowerCase'], graphNodes['str-toLowerCase'], 'str-toLowerCase should have been returned')

  // graph nodes with literal
  results = this.graph.findNodes('literal')
  test.equals(Object.keys(results).length, 1, "Should have returned 5 results")
  test.equals(results['name-fromLiteral'], graphNodes['name-fromLiteral'], 'name-fromLiteral should have been returned')

  test.done()
}
