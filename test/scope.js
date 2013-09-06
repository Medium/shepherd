// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph()
  done()
}

// public nodes should be able to access each other in the same scope
builder.add(function testSameScopePublic(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral', this.graph.literal(name))

  this.graph.setScope("scope2")
  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.setScope("scope1")
  this.graph.add('name-upper', this.graph.subgraph)
    .builds('name-fromLiteral')
      .modifiers({'str-toUpper': 'str'})

  return this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
})

// private nodes should be able to be accessed within the same scope
builder.add(function testSameScopePrivate(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral_', this.graph.literal(name))

  this.graph.setScope("scope2")
  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.setScope("scope1")
  this.graph.add('name-upper', this.graph.subgraph)
    .builds('name-fromLiteral_')
      .modifiers({'str-toUpper': 'str'})

  return this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
})

// public nodes should be able to access each other in different scopes
builder.add(function testDifferentScopePublic(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral', this.graph.literal(name))

  this.graph.setScope("scope2")
  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.setScope("scope3")
  this.graph.add('name-upper', this.graph.subgraph)
    .builds('name-fromLiteral')
      .modifiers({'str-toUpper': 'str'})

  return this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
})

// private nodes should not be able to be accessed from different scopes
builder.add(function testDifferentScopePrivate(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral_', this.graph.literal(name))

  this.graph.setScope("scope2")
  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.setScope("scope3")
  this.graph.add('name-upper', this.graph.subgraph)
    .builds('name-fromLiteral_')
      .modifiers({'str-toUpper': 'str'})

  try {
    this.graph.newBuilder()
      .builds('name-upper')
      .compile([])
    test.fail("Should not be able to access private nodes from different scopes")
  } catch (e) {
    var message = "Unable to access node 'name-fromLiteral_' in scope 'scope1'" +
          " from node 'name-upper' in scope 'scope3'"
    if (message !== String(e.message)) {
      throw e
    }
  }
  test.done()
})

builder.add(function testDifferentScopePrivateBuilder(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral_', this.graph.literal(name))

  this.graph.setScope("scope2")

  try {
    this.graph.newBuilder()
      .builds('name-fromLiteral_')
      .compile([])
    test.fail("Should not be able to access private nodes from different scopes")
  } catch (e) {
    var message = "Unable to access node 'name-fromLiteral_' in scope 'scope1' " +
          "from node 'builderOutput-anonymousBuilder1_1' in scope 'scope2'"
    if (message !== String(e.message)) {
      throw e
    }
  }
  test.done()
})

builder.add(function testSameScopePrivateBuilder(test) {
  var name = 'Jeremy'

  this.graph.setScope("scope1")
  this.graph.add('name-fromLiteral_', this.graph.literal(name))

  return this.graph.newBuilder()
      .builds('name-fromLiteral_')
      .run()
      .then(function (data) {
        test.equal(name, data['name-fromLiteral_'])
      })
})
