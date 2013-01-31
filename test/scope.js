// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph()
    .enableProfiling()
  done()
}

// public nodes should be able to access each other in the same scope
exports.testSameScopePublic = function (test) {
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

  this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fin(test.done.bind(test))
}

// private nodes should be able to be accessed within the same scope
exports.testSameScopePrivate = function (test) {
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

  this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fin(test.done.bind(test))
}

// public nodes should be able to access each other in different scopes
exports.testDifferentScopePublic = function (test) {
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

  this.graph.newBuilder()
    .builds('name-upper')
    .run({}, function (err, data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .then(function (data) {
      test.equal(data['name-upper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fin(test.done.bind(test))
}

// private nodes should not be able to be accessed from different scopes
exports.testDifferentScopePrivate = function (test) {
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
    test.ok("Should not be able to access private nodes from different scopes")
  }
  test.done()
}

// private nodes should not be able to be accessed from builder .builds()
exports.testPrivateBuilds = function (test) {
  var name = 'Jeremy'

  this.graph.add('name-fromLiteral_', this.graph.literal(name))
  try {
    this.graph.newBuilder()
      .builds('name-fromLiteral_')
      .compile([])
    test.fail("Should not be able to access private nodes from builders")
  } catch (e) {
    test.ok("Should not be able to access private nodes from builders")
  }
  test.done()
}

// private nodes should not be able to be accessed from builder .using()
exports.testPrivateUsing = function (test) {
  var name = 'Jeremy'

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('name-fromLiteral_', this.graph.literal(name))

  try {
    this.graph.newBuilder()
      .builds('str-toUpper')
        .using({str: 'name-fromLiteral_'})
      .compile([])
    test.fail("Should not be able to access private nodes from builders")
  } catch (e) {
    test.ok("Should not be able to access private nodes from builders")
  }
  test.done()
}