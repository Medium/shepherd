// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/shepherd')).Graph

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
builder.add(function testInputThroughSubgraphLiterals(test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])

  this.graph.add('user-newFromSubgraph', this.graph.subgraph)
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email:this.graph.literal(this.email)})

  return this.graph.newBuilder()
    .builds('user-newFromSubgraph')
    .run({})
    .then(function (result) {
      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')
    })
})

// test inputs defined through .using() in child nodes as members of other nodes
builder.add(function testInputThroughSubgraphNodeChildren(test) {
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

  return this.graph.newBuilder()
    .builds('user-newFromSubgraph')
      .using('user-existing')
    .run({})
    .then(function (result) {
      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')
    })
})

// test inputs through builder .using() in child nodes as prefixed other nodes
builder.add(function testInputThroughSubgraphNodes(test) {
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

  return this.graph.newBuilder()
    .builds('user-newFromSubgraph')
    .run({})
    .then(function (result) {
      test.equal(result['user-newFromSubgraph'].userId, self.userId, 'userId should be set')
      test.equal(result['user-newFromSubgraph'].name, self.name, 'name should be set')
      test.equal(result['user-newFromSubgraph'].email, self.email, 'email should be set')
    })
})

// test inputs defined through .using in the builder
builder.add(function testInputThroughBuilderLiterals(test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])

  return this.graph.newBuilder()
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email: this.graph.literal(this.email)})
    .run({})
    .then(function (result) {
      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')
    })
})

// test inputs through builder .using() as members of other nodes
builder.add(function testInputThroughBuilderNodeChildren(test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])
  this.graph.add('user-existing', function () {
    return {
      userId: self.userId,
      name: self.name,
      email: self.email
    }
  })

  return this.graph.newBuilder()
    .builds('user-new')
      .using('user-existing.email', 'user-existing.userId', 'user-existing.name')
    .run({})
    .then(function (result) {
      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')
    })
})

// test inputs through builder .using() as prefixed other nodes
builder.add(function testInputThroughBuilderNodes(test) {
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

  return this.graph.newBuilder()
    .builds('user-new')
      .using('email-existing', 'name-existing', 'userId-existing')
    .run({})
    .then(function (result) {
      test.equal(result['user-new'].userId, self.userId, 'userId should be set')
      test.equal(result['user-new'].name, self.name, 'name should be set')
      test.equal(result['user-new'].email, self.email, 'email should be set')
    })
})

// adding subgraph
builder.add(function testSubgraph(test) {
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

  return this.graph.newBuilder()
    .builds('fullName')
    .run({firstName: firstName, lastName: lastName})
    .then(function (result) {
      test.equal(result.fullName, firstName + ' ' + lastName, 'Response should be returned through promise')
    })
})

// adding subgraph w/ wildcard args
builder.add(function testSubgraphWildcard(test) {
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

  return this.graph.newBuilder()
    .builds('fullName-overrides')
      .using({firstName: 'fname'}, {lastName: 'lname'})
    .run({fname: firstName, lname: lastName})
    .then(function (result) {
      test.equal(result['fullName-overrides'], firstName + ' ' + newLastName, 'Response should be returned through promise')
    })
})

// test that an object can be upcast into an array
builder.add(function testArrayUpcast(test) {
  var name = 'Jeremy'

  this.graph.add('strs-toUpper', function (strs) {
    var newStrs = []
    for (var i = 0; i < strs.length; i++) {
      newStrs.push(strs[i].toUpperCase())
    }
    return newStrs
  }, ['strs'])

  this.graph.add('name-toUpper', this.graph.subgraph, ['name'])
    .builds('strs-toUpper')
      .using({strs: ['args.name']})
    .returns('strs-toUpper.0')

  return this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
})

// test that an empty array can be passed in
builder.add(function testArrayUpcastEmpty(test) {
  this.graph.add('strs-toUpper', function (strs) {
    var newStrs = []
    for (var i = 0; i < strs.length; i++) {
      newStrs.push(strs[i].toUpperCase())
    }
    return newStrs
  }, ['strs'])

  this.graph.add('name-toUpper', this.graph.subgraph)
    .builds('strs-toUpper')
      .using({strs: []})
    .returns('strs-toUpper.0')

  return this.graph.newBuilder()
    .builds('name-toUpper')
    .run()
    .then(function (data) {
      test.equal(data['name-toUpper'], undefined, "Name should be undefined")
    })
})

// test that an object can be upcast into an array from a builder
builder.add(function testBuilderArrayUpcast(test) {
  var name = 'Jeremy'

  this.graph.add('strs-toUpper', function (strs) {
    var newStrs = []
    for (var i = 0; i < strs.length; i++) {
      newStrs.push(strs[i].toUpperCase())
    }
    return newStrs
  }, ['strs'])

  return this.graph.newBuilder()
    .builds('strs-toUpper')
      .using({strs: ['name']})
    .run({name: name})
    .then(function (data) {
      test.equal(data['strs-toUpper'][0], name.toUpperCase(), "Name should be upper-cased")
    })
})

// test that an object can be built from other objects
builder.add(function testBuilderObjectUpcast(test) {
  var name = 'Jeremy'
  var age = 29

  this.graph.add('user-echo', this.graph.subgraph, ['user'])

  this.graph.add('user-fromNameAndAge', this.graph.subgraph, ['name', 'age'])
    .builds('user-echo')
      .using({user: {name: 'args.name', age: 'args.age'}})

  return this.graph.newBuilder()
    .builds('user-fromNameAndAge')
      .using({name: this.graph.literal(name)}, {age: this.graph.literal(age)})
    .run()
    .then(function (data) {
      test.equal(data['user-fromNameAndAge'].name, name, "Name should be returned")
      test.equal(data['user-fromNameAndAge'].age, age, "Age should be returned")
    })
})

// test .using() on a run input
builder.add(function testUsingRunInput(test) {
  var self = this
  this.graph.add('context')
  .builds('contextId')
  .fn(function (contextId) {
    return {contextId: contextId}
  })

  this.graph.add('stats')
    .builds('context').using({contextId: this.graph.literal(0xdeadbeef)})
  .fn(function (context) {
    return {context: context}
  })

  return self.graph.newBuilder()
    .builds('stats')
    .builds('context')
    .run({contextId: 1})
  .then(function (result) {
    test.ok(false, 'Expected error')
  })
  .fail(function (e) {
    var message = 'Bad override of input contextId at node ' +
        'BUILDER->builderOutput-anonymousBuilder1_2->context-peerGroup2'
    if (e.message != message) throw e
  })
})
