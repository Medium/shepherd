// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// should throw an error if a node is missing
exports.testMissingBuilderNode = function (test) {
  this.graph.newBuilder()
    .builds('user')
    .run({}, function (err, result) {
      test.equal(err.message, "Unable to find node 'user'", 'Error should be defined')
    })
    .then(function () {
      test.equal(true, false, '.then() should not be called for promise')
    })
    .fail(function (err) {
      test.equal(err.message, "Unable to find node 'user'", 'Error should be defined')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// should be able to retrieve member variables of graph nodes
exports.testMemberVariable = function (test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('user', this.graph.literal(nodeValue))

  this.graph.newBuilder()
    .builds('user.name')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user.name'], nodeValue.name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user.name'], nodeValue.name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test that nodes with identical functions and dependencies only run once
exports.testDeduplication = function (test) {
  var numCalls = 0
  var user = {name: 'Jeremy'}
  var getUser = function () {
    numCalls++
    return user
  }
  this.graph.add('user1', getUser)
  this.graph.add('user2', getUser)
  this.graph.add('user3', getUser)

  this.graph.newBuilder()
    .builds('user1')
    .builds('user2')
    .builds('user3')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user1'], user, 'Response.user1 should be returned through callback')
      test.equal(result['user2'], user, 'Response.user2 should be returned through callback')
      test.equal(result['user3'], user, 'Response.user3 should be returned through callback')
      test.equal(numCalls, 1, 'getUser should only be called once')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user1'], user, 'Response.user1 should be returned through promise')
      test.equal(result['user2'], user, 'Response.user2 should be returned through promise')
      test.equal(result['user3'], user, 'Response.user3 should be returned through promise')
      test.equal(numCalls, 1, 'getUser should only be called once')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test that nodes with identical functions and different dependencies run multiple times
exports.testDeduplication = function (test) {
  var numCalls = 0
  var user = {name: 'Jeremy'}
  var getUser = function () {
    numCalls++
    return user
  }
  this.graph.add('user1', getUser, ['a'])
  this.graph.add('user2', getUser, ['b'])
  this.graph.add('user3', getUser, ['c'])

  this.graph.add('a', 1)
  this.graph.add('b', 2)
  this.graph.add('c', 3)

  this.graph.newBuilder()
    .builds('user1')
    .builds('user2')
    .builds('user3')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user1'], user, 'Response.user1 should be returned through callback')
      test.equal(result['user2'], user, 'Response.user2 should be returned through callback')
      test.equal(result['user3'], user, 'Response.user3 should be returned through callback')
      test.equal(numCalls, 3, 'getUser should only be called once')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user1'], user, 'Response.user1 should be returned through promise')
      test.equal(result['user2'], user, 'Response.user2 should be returned through promise')
      test.equal(result['user3'], user, 'Response.user3 should be returned through promise')
      test.equal(numCalls, 3, 'getUser should only be called once')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test creating a builder which remaps a node to a new name
exports.testRemappingBuilderNode = function (test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('userObj', this.graph.literal(nodeValue))

  this.graph.newBuilder()
    .builds({'user': 'userObj'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user'], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user'], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test creating a graph node which remaps a dependency to a new name
exports.testRemappingNodeDependency = function (test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('userObj', this.graph.literal(nodeValue))

  function getUsernameFromUser(user) {
    return user.name
  }
  this.graph.add('username-fromUser', getUsernameFromUser, ['user'])

  this.graph.add('username-test', this.graph.subgraph)
    .builds({'!user': 'userObj'})
    .builds('username-fromUser').using('user')

  this.graph.newBuilder()
    .builds('username-test')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['username-test'], nodeValue.name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      console.error(err.stack)
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['username-test'], nodeValue.name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test creating optional nodes from the builder
exports.testBuilderOptionalNode = function (test) {
  var output = ""
  var username = "Jeremy"

  this.graph.add("str-toUpper", function (str) {
    output += "upper"
    return str.toUpperCase()
  }, ['str'])

  this.graph.add("str-toLower", function (str) {
    output += "lower"
    return str.toLowerCase()
  }, ['str'])

  this.graph.add("str-test", this.graph.subgraph)
    .args('str')

  this.graph.newBuilder()
    .builds('?str-toUpper').using({str: 'username'})
    .builds('?str-toLower').using({str: 'username'})
    .builds('str-test').using('str-toLower')
    .run({username: username}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through callback')
      test.equal(output, 'lower', 'Only lower should have been ran')
    })
    .fail(function (err) {
      console.error(err.stack)
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through promise')
      test.equal(output, 'lower', 'Only lower should have been ran')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test that builds can be mapped directly to literals
exports.testBuildLiteral = function (test) {
  this.graph.newBuilder()
    .builds({filterBy: this.graph.literal('hello')})
    .run()
    .then(function (data) {
      test.equal(data.filterBy, 'hello', "Value should match the literal")
    })
    .fail(function (e) {
      test.fail("Value should match the literal")
    })
    .fin(function () {
      test.done()
    })
}