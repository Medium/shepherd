// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
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
exports.testInputThroughSubgraphLiterals = function (test) {
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
exports.testInputThroughSubgraphNodeChildren = function (test) {
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
exports.testInputThroughSubgraphNodes = function (test) {
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
exports.testInputThroughBuilderLiterals = function (test) {
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
exports.testInputThroughBuilderNodeChildren = function (test) {
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
exports.testInputThroughBuilderNodes = function (test) {
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
exports.testSubgraph = function (test) {
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
exports.testSubgraphWildcard = function (test) {
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

// test that an arg. was passed with an invalid arg
exports.testMissingParentArg = function (test) {
  this.graph.add('test1', this.graph.subgraph)
    .args('fname', 'lname')

  this.graph.add('test2', this.graph.subgraph)
    .args('fname')
    .builds('test1')
      .using('args.fname', 'args.lname')

  this.graph.add('test3', this.graph.subgraph)
    .args('fname')
    .builds('test2')
      .using('args.*')

  var expectedError = "Unable to find node 'args.lname' (passed from 'test2' to 'test1')"
  var actualError
  try {
    this.graph.newAsyncBuilder()
      .builds('test3')
      .compile(['fname'])
  } catch (e) {
    actualError = e.message
  }

  test.equal(actualError, expectedError, "Build should fail due to missing parent arg")
  test.done()
}