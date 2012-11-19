// Copyright 2012 The Obvious Corporation.
var testCase = require('nodeunit').testCase
var Q = require('kew')

// set up the test case
var tester = {}

// set up a graph for testing
tester.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/asyncBuilder')).Graph

  this.userId = 123
  this.name = 'Fred'
  this.email = 'test@example.com'
  this.createUser = function (userId, name, email) {
    return {
      userId: userId,
      name: name,
      email: email
    }
  }
  done()
}

// test inputs defined through .using in child nodes
tester.testInputThroughSubgraphLiterals = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])

  this.graph.add('user-newFromSubgraph', this.graph.subgraph)
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email: {_literal: this.email}})

  this.graph.newAsyncBuilder()
    .builds('user-newFromSubgraph')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// test inputs defined through .using() in child nodes as members of other nodes
tester.testInputThroughSubgraphNodeChildren = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])
  this.graph.add('user-existing', function () {
    return {
      userId: self.userId,
      name: self.name,
      email: self.email
    }
  })

  this.graph.add('user-newFromSubgraph', this.graph.subgraph)
    .args('!user')
    .builds('user-new')
      .using('args.user.name', 'args.user.email', 'args.user.userId')

  this.graph.newAsyncBuilder()
    .builds('user-newFromSubgraph')
      .using('user-existing')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// test inputs through builder .using() in child nodes as prefixed other nodes
tester.testInputThroughSubgraphNodes = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])
  this.graph.add('name-existing', function () {
    return self.name
  })
  this.graph.add('userId-existing', function () {
    return self.userId
  })
  this.graph.add('email-existing', function () {
    return self.email
  })

  this.graph.add('user-newFromSubgraph', this.graph.subgraph)
    .builds('user-new')
      .using('email-existing', 'name-existing', 'userId-existing')

  this.graph.newAsyncBuilder()
    .builds('user-newFromSubgraph')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// test inputs defined through .using in the builder
tester.testInputThroughBuilderLiterals = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])

  this.graph.newAsyncBuilder()
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email: {_literal: this.email}})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// test inputs through builder .using() as members of other nodes
tester.testInputThroughBuilderNodeChildren = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])
  this.graph.add('user-existing', function () {
    return {
      userId: self.userId,
      name: self.name,
      email: self.email
    }
  })

  this.graph.newAsyncBuilder()
    .builds('user-new')
      .using('user-existing.email', 'user-existing.userId', 'user-existing.name')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// test inputs through builder .using() as prefixed other nodes
tester.testInputThroughBuilderNodes = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])
  this.graph.add('name-existing', function () {
    return self.name
  })
  this.graph.add('userId-existing', function () {
    return self.userId
  })
  this.graph.add('email-existing', function () {
    return self.email
  })

  this.graph.newAsyncBuilder()
    .builds('user-new')
      .using('email-existing', 'name-existing', 'userId-existing')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')

      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')

      test.done()
    })
    .end()
}

// adding subgraph
tester.testSubgraph = function (test) {
  var firstName = 'Jeremy'
  var lastName = 'Stanley'

  // add graph node which joins 2 strings
  this.graph.add('str-joined', function (first, second) {
    return first + ' ' + second
  }, ['first', 'second'])

  // add graph node which takes in a first and last name then calls the string joiner with them
  this.graph.add('fullName', this.graph.subgraph)
    .args('!firstName', '!lastName')
    .builds('str-joined')
      .using({first: 'args.firstName'}, {second: 'args.lastName'})

  this.graph.newAsyncBuilder()
    .builds('fullName')
    .run({firstName: firstName, lastName: lastName}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.fullName, firstName + ' ' + lastName, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.fullName, firstName + ' ' + lastName, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding subgraph w/ wildcard args
tester.testSubgraphWildcard = function (test) {
  var firstName = 'Jeremy'
  var lastName = 'Stanley'
  var newLastName = 'Yelnats'

  // add graph node which joins 2 strings
  this.graph.add('str-joined', function (first, second) {
    return first + ' ' + second
  }, ['first', 'second'])

  // add graph node which takes in a first and last name then calls the string joiner with them
  this.graph.add('fullName', this.graph.subgraph)
    .args('!firstName', '!lastName')
    .builds('str-joined')
      .using({first: 'args.firstName'}, {second: 'args.lastName'})

  this.graph.add('fullName-overrides', this.graph.subgraph)
    .args('firstName', 'lastName')
    .builds('fullName')
      .using('args.*', {lastName: this.graph.literal(newLastName)})

  this.graph.newAsyncBuilder()
    .builds('fullName-overrides')
      .using({firstName: 'fname'}, {lastName: 'lname'})
    .run({fname: firstName, lname: lastName}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['fullName-overrides'], firstName + ' ' + newLastName, 'Response should be returned through callback')
    })
    .fail(function (err) {
      console.error(err)
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['fullName-overrides'], firstName + ' ' + newLastName, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

module.exports = testCase(tester)