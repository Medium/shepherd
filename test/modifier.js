// Copyright 2012 The Obvious Corporation.
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

// test adding an anonymous function as a modifier
tester.testAnonymousModifier = function (test) {
  var name = "Jeremy"

  this.graph.add('name-fromLiteral', this.graph.literal(name))
    .modifiers(function (name) {
      return name.toUpperCase()
    })

  this.graph.newAsyncBuilder()
    .builds('name-fromLiteral')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-fromLiteral'], name.toUpperCase(), 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-fromLiteral'], name.toUpperCase(), 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// builder can apply modifiers to built node
tester.testModifiersFromBuilder = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user', function () {
    return user
  })

  this.graph.add('addDate', function (obj) {
    obj.date = now
    return obj
  }, ['obj'])

  this.graph.newAsyncBuilder()
    .builds('user')
      .modifiers({'addDate': 'obj'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.user.date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.user.date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node can apply modifiers to child node
tester.testModifiersFromSubgraph = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withoutDate', function () {
    return user
  })

  this.graph.add('addDate', function (obj) {
    obj.date = now
    return obj
  }, ['obj'])

  this.graph.add('user-withDate', this.graph.subgraph)
    .builds('user-withoutDate')
      .modifiers({'addDate': 'obj'})

  this.graph.newAsyncBuilder()
    .builds('user-withDate')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node can apply modifiers to itself
tester.testModifiersFromSelf = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withDate', function () {
    return user
  })
  .modifiers({'addDate': 'obj'})

  this.graph.add('addDate', function (obj) {
    obj.date = now
    return obj
  }, ['obj'])

  this.graph.newAsyncBuilder()
    .builds('user-withDate')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// modifiers should run for self first, then builder
tester.testModifiersOrdering = function (test) {
  var nodeValue = "Jeremy"

  this.graph.add("trimFirstChar", function (name) {
    return name.substr(1)
  }, ['name'])

  this.graph.add("addQuotes", function (name) {
    return '"' + name + '"'
  }, ['name'])

  this.graph.add("name-fromLiteral", this.graph.literal(nodeValue))
    .modifiers('trimFirstChar')

  this.graph.newAsyncBuilder()
    .builds('name-fromLiteral')
      .modifiers('addQuotes')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-fromLiteral'], '"' + nodeValue.substr(1) + '"', 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-fromLiteral'], '"' + nodeValue.substr(1) + '"', 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// modifiers can take prefixed node names as inputs
tester.testModifiersWithPrefixedNodes = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withDate', function () {
    return user
  })
    .modifiers('addDate')

  this.graph.add('addDate', function (userObj) {
    userObj.date = now
    return userObj
  }, ['user'])

  this.graph.newAsyncBuilder()
    .builds('user-withDate')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test creating modifiers with optional fields
tester.testOptionalModifiers = function (test) {
  var username = "Jeremy"
  this.graph.add('str-base', this.graph.literal(username))

  this.graph.add('str-modifier', function (str, modifier) {
    return modifier === 'lower' ? str.toLowerCase() : str.toUpperCase()
  }, ['str', 'modifier'])

  this.graph.add("str-test", this.graph.subgraph)
    .builds('?str-modifier')
      .using({'modifier': {_literal: 'lower'}})
    .builds('str-base')
      .modifiers('str-modifier')

  this.graph.newAsyncBuilder()
    .builds('str-test')
    .run({username: username}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

module.exports = testCase(tester)