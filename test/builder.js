// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var shepherd = require ('../lib/shepherd')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new shepherd.Graph
  done()
}

// test that builder names are required
builder.add(function testRequiredBuilderNames(test) {
  this.graph.enforceBuilderNames(shepherd.ErrorMode.ERROR)

  try {
    this.graph.newBuilder()
    test.fail("Should have thrown an error due to a missing name")
  } catch (e) {
    test.equal(e.message, "A builder name is required", "Should have thrown an error due to a missing name")
  }
  test.done()
})

// should throw an error if a node is missing
builder.add(function testMissingBuilderNode(test) {
  return this.graph.newBuilder()
    .builds('user')
    .run({}, function (err, result) {
      test.ok(/Node 'user' was not found/.test(err.message), 'Error should be defined: ' + err)
    })
    .then(function () {
      test.equal(true, false, '.then() should not be called for promise')
    })
    .fail(function (err) {
      test.ok(/Node 'user' was not found/.test(err.message), 'Error should be defined: ' + err)
    })
})

// should be able to retrieve member variables of graph nodes
builder.add(function testMemberVariable(test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('user', this.graph.literal(nodeValue))

  return this.graph.newBuilder()
    .builds('user.name')
    .run({})
    .then(function (result) {
      test.equal(result['user.name'], nodeValue.name, 'Response should be returned through promise')
    })
})

// test that nodes with identical functions and dependencies only run once
builder.add(function testDeduplication(test) {
  var numCalls = 0
  var user = {name: 'Jeremy'}
  var getUser = function () {
    numCalls++
    return user
  }
  this.graph.add('user1', getUser)
  this.graph.add('user2', getUser)
  this.graph.add('user3', getUser)

  return this.graph.newBuilder()
    .builds('user1')
    .builds('user2')
    .builds('user3')
    .run({})
    .then(function (result) {
      test.equal(result['user1'], user, 'Response.user1 should be returned through promise')
      test.equal(result['user2'], user, 'Response.user2 should be returned through promise')
      test.equal(result['user3'], user, 'Response.user3 should be returned through promise')
      test.equal(numCalls, 1, 'getUser should only be called once')
    })
})

// test that nodes with identical functions and different dependencies run multiple times
builder.add(function testDeduplication2(test) {
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

  return this.graph.newBuilder()
    .builds('user1')
    .builds('user2')
    .builds('user3')
    .run({})
    .then(function (result) {
      test.equal(result['user1'], user, 'Response.user1 should be returned through promise')
      test.equal(result['user2'], user, 'Response.user2 should be returned through promise')
      test.equal(result['user3'], user, 'Response.user3 should be returned through promise')
      test.equal(numCalls, 3, 'getUser should only be called once')
    })
})

// test creating a builder which remaps a node to a new name
builder.add(function testRemappingBuilderNode(test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('userObj', this.graph.literal(nodeValue))

  return this.graph.newBuilder()
    .builds({'user': 'userObj'})
    .run({})
    .then(function (result) {
      test.equal(result['user'], nodeValue, 'Response should be returned through promise')
    })
})

// test creating a graph node which remaps a dependency to a new name
builder.add(function testRemappingNodeDependency(test) {
  var nodeValue = {name: 'Jeremy'}
  this.graph.add('userObj', this.graph.literal(nodeValue))

  function getUsernameFromUser(user) {
    return user.name
  }
  this.graph.add('username-fromUser', getUsernameFromUser, ['user'])

  this.graph.add('username-test', this.graph.subgraph)
    .builds({'!user': 'userObj'})
    .builds('username-fromUser').using('user')

  return this.graph.newBuilder()
    .builds('username-test')
    .run({})
    .then(function (result) {
      test.equal(result['username-test'], nodeValue.name, 'Response should be returned through promise')
    })
})

// test creating void nodes from the builder
builder.add(function testBuilderVoidNode(test) {
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

  return this.graph.newBuilder()
    .builds('?str-toUpper').using({str: 'username'})
    .builds('?str-toLower').using({str: 'username'})
    .builds('str-test').using('str-toLower')
    .run({username: username})
    .then(function (result) {
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through promise')
      test.equal(output, 'lower', 'Only lower should have been ran')
    })
})

builder.add(function testBuilderVoidNodeMapped(test) {
  var username = "Jeremy"

  this.graph.add("upper", function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add("str-test", this.graph.subgraph, ['str'])

  return this.graph.newBuilder()
  .configure({'str-toUpper': 'upper'}).using({str: 'username'})
    .builds('str-test').using('str-toUpper')
    .run({username: username})
    .then(function (result) {
      test.equal(result['str-test'], username.toUpperCase())
    })
})

builder.add(function testInvalidConfigures(test) {
  var username = "Jeremy"

  this.graph.add("upper", function (str) {
    return str.toUpperCase()
  }, ['str'])

  try {
    this.graph.newBuilder()
    .configure({'?str-toUpper': 'upper'}).using({str: 'username'})
  } catch (e) {
    if (!/invalid node name/.test(e.message)) {
      throw e
    }
  }
  test.done()
})

// test that builds can be mapped directly to literals
builder.add(function testBuildLiteral(test) {
  return this.graph.newBuilder()
    .builds({filterBy: this.graph.literal('hello')})
    .run()
    .then(function (data) {
      test.equal(data.filterBy, 'hello', "Value should match the literal")
    })
})
