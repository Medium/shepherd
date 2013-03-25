// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

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
exports.testInputThroughSubgraphLiterals = function (test) {
  var self = this
  this.graph.add('user-new', this.createUser, ['userId', 'name', 'email'])

  this.graph.add('user-newFromSubgraph', this.graph.subgraph)
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email:this.graph.literal(this.email)})

  this.graph.newBuilder()
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

  this.graph.newBuilder()
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

  this.graph.newBuilder()
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

  this.graph.newBuilder()
    .builds('user-new')
      .using({userId: this.userId}, {name: this.graph.literal(this.name)}, {email: this.graph.literal(this.email)})
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

  this.graph.newBuilder()
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

  this.graph.newBuilder()
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

  this.graph.newBuilder()
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

  this.graph.newBuilder()
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

// test that an object can be upcast into an array
exports.testArrayUpcast = function (test) {
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

  this.graph.newBuilder()
    .builds('name-toUpper')
    .run({name: name})
    .then(function (data) {
      test.equal(data['name-toUpper'], name.toUpperCase(), "Name should be upper-cased")
    })
    .fail(function (e) {
      test.fail("Should not return through .fail()")
    })
    .fin(function () {
      test.done()
    })
}

// test that an empty array can be passed in
exports.testArrayUpcastEmpty = function (test) {
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

  this.graph.newBuilder()
    .builds('name-toUpper')
    .run()
    .then(function (data) {
      test.equal(data['name-toUpper'], undefined, "Name should be undefined")
    })
    .fail(function (e) {
      test.fail("Should not return through .fail()", e.stack)
    })
    .fin(function () {
      test.done()
    })
}

// test that an object can be upcast into an array from a builder
exports.testBuilderArrayUpcast = function (test) {
  var name = 'Jeremy'

  this.graph.add('strs-toUpper', function (strs) {
    var newStrs = []
    for (var i = 0; i < strs.length; i++) {
      newStrs.push(strs[i].toUpperCase())
    }
    return newStrs
  }, ['strs'])

  this.graph.newBuilder()
    .builds('strs-toUpper')
      .using({strs: ['name']})
    .run({name: name})
    .then(function (data) {
      test.equal(data['strs-toUpper'][0], name.toUpperCase(), "Name should be upper-cased")
    })
    .fail(function (e) {
      console.error(e.stack)
      test.fail("Should not return through .fail()")
    })
    .fin(function () {
      test.done()
    })
}

// test that an object can be built from other objects
exports.testBuilderObjectUpcast = function (test) {
  var name = 'Jeremy'
  var age = 29

  this.graph.add('user-echo', this.graph.subgraph, ['user'])

  this.graph.add('user-fromNameAndAge', this.graph.subgraph, ['name', 'age'])
    .builds('user-echo')
      .using({user: {name: 'args.name', age: 'args.age'}})

  this.graph.newBuilder()
    .builds('user-fromNameAndAge')
      .using({name: this.graph.literal(name)}, {age: this.graph.literal(age)})
    .run()
    .then(function (data) {
      test.equal(data['user-fromNameAndAge'].name, name, "Name should be returned")
      test.equal(data['user-fromNameAndAge'].age, age, "Age should be returned")
    })
    .fail(function (e) {
      console.error(e.stack)
      test.fail("Should not return through .fail()")
    })
    .fin(function () {
      test.done()
    })
}