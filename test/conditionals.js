// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  this.graph.disableCallbacks()
  done()
}

// test guards with else
builder.add(function testGuardsWithElse(test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: 'Jon'}
  ]
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str, myChar) {
    return myChar + str + myChar
  }, ['str', 'char'])

  this.graph.add('str-echo', function (str) {
    return str
  }, ['str'])

  this.graph.add('char-fromLiteral', function (val) {
    return val
  }, ['val'])

  this.graph.add('str-transform', this.graph.subgraph, ['str', 'method'])
    .define('str-output')
      .builds('str-toUpper')
        .using('args.str')
        .when({isUpper: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('upper')})

      .builds('str-toLower')
        .using('args.str')
        .when({isLower: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('lower')})

      .builds('!char-fromLiteral')
            .using({val: this.graph.literal('"')})
      .builds('str-quotes')
        .using('args.str', 'char-fromLiteral')
        .when({isQuote: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('quotes')})

      .builds('str-echo')
        .using('args.str')
    .end()

  return this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.equal(data.str1, testInputs[0].output, data.str1 + " should be " + testInputs[0].output)
      test.equal(data.str2, testInputs[1].output, data.str2 + " should be " + testInputs[1].output)
      test.equal(data.str3, testInputs[2].output, data.str3 + " should be " + testInputs[2].output)
      test.equal(data.str4, testInputs[3].output, data.str4 + " should be " + testInputs[3].output)
      test.equal(data.str5, testInputs[4].output, data.str5 + " should be " + testInputs[4].output)
    })
})

// test guards without else
builder.add(function testGuardsWithoutElse(test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: undefined}
  ]
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str, myChar) {
    return myChar + str + myChar
  }, ['str', 'char'])

  this.graph.add('str-echo', function (str) {
    return str
  }, ['str'])

  this.graph.add('char-fromLiteral', function (val) {
    return val
  }, ['val'])

  this.graph.add('str-transform', this.graph.subgraph, ['str', 'method'])
    .define('str-output')
      .builds('str-toUpper')
        .using('args.str')
        .when({isUpper: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('upper')})

      .builds('str-toLower')
        .using('args.str')
        .when({isLower: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('lower')})

      .builds('!char-fromLiteral')
            .using({val: this.graph.literal('"')})
      .builds('str-quotes')
        .using('args.str', 'char-fromLiteral')
        .when({isQuote: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('quotes')})
    .end()

  return this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.equal(data.str1, testInputs[0].output, data.str1 + " should be " + testInputs[0].output)
      test.equal(data.str2, testInputs[1].output, data.str2 + " should be " + testInputs[1].output)
      test.equal(data.str3, testInputs[2].output, data.str3 + " should be " + testInputs[2].output)
      test.equal(data.str4, testInputs[3].output, data.str4 + " should be " + testInputs[3].output)
      test.equal(data.str5, testInputs[4].output, data.str5 + " should be " + testInputs[4].output)
    })
})

// test guards with syntax error
builder.add(function testGuardsWithSyntaxError(test) {
  var testInputs = [
    {name: 'Jeremy', method: 'upper', output: 'JEREMY'},
    {name: 'Elizabeth', method: 'lower', output: 'elizabeth'},
    {name: 'Dan', method: 'quotes', output: '"Dan"'},
    {name: 'Sho', method: 'lower', output: 'sho'},
    {name: 'Jon', method: 'unspecified', output: undefined}
  ]
  this.graph.add('bool-isEqual', function (str1, str2) {
    return str1 == str2
  }, ['str1', 'str2'])

  this.graph.add('str-toUpper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-toLower', function (str) {
    return strasdfasdf.toLowerCase()
  }, ['str'])

  this.graph.add('str-quotes', function (str, myChar) {
    return myChar + str + myChar
  }, ['str', 'char'])

  this.graph.add('str-echo', function (str) {
    return str
  }, ['str'])

  this.graph.add('char-fromLiteral', function (val) {
    return val
  }, ['val'])

  this.graph.add('str-transform', this.graph.subgraph, ['str', 'method'])
    .define('str-output')
      .builds('str-toUpper')
        .using('args.str')
        .when({isUpper: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('upper')})

      .builds('str-toLower')
        .using('args.str')
        .when({isLower: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('lower')})

      .builds('!char-fromLiteral')
            .using({val: this.graph.literal('"')})
      .builds('str-quotes')
        .using('args.str', 'char-fromLiteral')
        .when({isQuote: 'bool-isEqual'})
          .using({str1: 'args.method'}, {str2: this.graph.literal('quotes')})
    .end()

  return this.graph.newBuilder()
    .builds({str1: 'str-transform'})
      .using({str: this.graph.literal(testInputs[0].name)}, {method: this.graph.literal(testInputs[0].method)})
    .builds({str2: 'str-transform'})
      .using({str: this.graph.literal(testInputs[1].name)}, {method: this.graph.literal(testInputs[1].method)})
    .builds({str3: 'str-transform'})
      .using({str: this.graph.literal(testInputs[2].name)}, {method: this.graph.literal(testInputs[2].method)})
    .builds({str4: 'str-transform'})
      .using({str: this.graph.literal(testInputs[3].name)}, {method: this.graph.literal(testInputs[3].method)})
    .builds({str5: 'str-transform'})
      .using({str: this.graph.literal(testInputs[4].name)}, {method: this.graph.literal(testInputs[4].method)})
    .run()
    .then(function (data) {
      test.fail("Should fail due to a syntax error")
    })
    .fail(function (e) {
      test.ok("Failed due to a syntax error")
    })
})

// test that .when() can verify the existence of an input
builder.add(function testInputExists(test) {
  var counter = 0
  var users = {
    'aaa': {name: 'Jeremy'},
    'bbb': {name: 'Fred'}
  }

  this.graph.add('user-byUserId', function (userId) {
    counter++
    return users[userId]
  }, ['userId'])

  this.graph.add('name-forUserId', function (user) {
    if (!user) return undefined
    return user.name
  }, ['!userId'])
    .define('user')
      .builds('user-byUserId')
        .using('args.userId')
      .when('args.userId')
    .end()

  return this.graph.newBuilder()
    .builds({nameA: 'name-forUserId'})
      .using({userId: this.graph.literal('aaa')})
    .builds({nameB: 'name-forUserId'})
      .using({userId: this.graph.literal('bbb')})
    .builds({nameC: 'name-forUserId'})
      .using({userId: this.graph.literal(undefined)})
    .run({})
    .then(function (data) {
      test.equal(data.nameA, users.aaa.name, "First user should be returned")
      test.equal(data.nameB, users.bbb.name, "Second user should be returned")
      test.equal(data.nameC, undefined, "Third user should be undefined")
      test.equal(counter, 2, "User retrieval function should only have been called twice")
    })
})

// test that .when() can verify the existence of an existing node
builder.add(function testExistingNodeExists(test) {
  var counter = 0
  var users = {
    'aaa': {name: 'Jeremy'},
    'bbb': {name: 'Fred'}
  }

  this.graph.add('userId-fromInput', function (userId) {
    return userId
  }, ['userId'])

  this.graph.add('user-byUserId', function (userId) {
    counter++
    return users[userId]
  }, ['userId'])

  this.graph.add('name-forUserId', function (user) {
    if (!user) return undefined
    return user.name
  }, ['!userId'])
    .builds('!userId-fromInput')
      .using('args.*')
    .define('user')
      .builds('user-byUserId')
        .using('userId-fromInput')
      .when('userId-fromInput')
    .end()

  return this.graph.newBuilder()
    .builds({nameA: 'name-forUserId'})
      .using({userId: this.graph.literal('aaa')})
    .builds({nameB: 'name-forUserId'})
      .using({userId: this.graph.literal('bbb')})
    .builds({nameC: 'name-forUserId'})
      .using({userId: this.graph.literal(undefined)})
    .run({})
    .then(function (data) {
      test.equal(data.nameA, users.aaa.name, "First user should be returned")
      test.equal(data.nameB, users.bbb.name, "Second user should be returned")
      test.equal(data.nameC, undefined, "Third user should be undefined")
      test.equal(counter, 2, "User retrieval function should only have been called twice")
    })
})

// test that unless works as expected
builder.add(function testUnless(test) {
  this.graph.add('user-addId_', function (user) {
    user.id = Math.floor(Math.random() * 100000) + 1
  }, ['user'])

  this.graph.add('user-addId', this.graph.subgraph, ['user'])
    .define('userWithId')
      .builds('user-addId_')
        .using('args.user')
        .unless('args.user.id')
    .end()
    .returns('args.user')

  return this.graph.newBuilder()
    .builds({user1: 'user-addId'})
      .using({user: this.graph.literal({name: "Jeremy"})})
    .builds({user2: 'user-addId'})
      .using({user: this.graph.literal({id: 111, name: "Jon"})})
    .run()
    .then(function (data) {
      test.ok(('id' in data.user1), "User1 has a new id")
      test.equal(data.user2.id, 111, "User2 has its existing id")
    })
})

// test that unless works with property references
builder.add(function testUnless2(test) {
  this.graph.add('user-jon', function () {
    return {name: "Jon"}
  })
  this.graph.add('user-jeremy', function () {
    return {id: 345, name: "Jeremy"}
  })

  this.graph.add('user-addId', function (user) {
    user.id = Math.floor(Math.random() * 100000) + 1
  }, ['user'])

  return this.graph.newBuilder()
    .builds('user-jeremy')
    .builds('user-jon')
    .define('jonWithId')
      .builds({'user1': 'user-addId'})
        .using('user-jon')
      .unless('user-jon.id')
    .define('jeremyWithId')
      .builds({'user2': 'user-addId'})
        .using('user-jeremy')
      .unless('user-jeremy.id')
    .end()
    .run()
    .then(function (data) {
      test.equal('Jon', data['user-jon'].name, "Wrong user")
      test.ok('id' in data['user-jon'], "User doesn't have an id")

      test.equal('Jeremy', data['user-jeremy'].name, "Wrong user")
      test.ok('id' in data['user-jeremy'], "User doesn't have an id")
      test.equal(345, data['user-jeremy'].id, "User has the wrong id")
    })
})

builder.add(function testUnless3(test) {
  this.graph.add('jon', function () {
    return {name: "Jon"}
  })
  this.graph.add('jeremy', function () {
    return {id: 345, name: "Jeremy"}
  })

  this.graph.add('user-addId', function (user) {
    user.id = Math.floor(Math.random() * 100000) + 1
  }, ['user'])

  this.graph.add('bool-userHasId', function (user) {
    return !!user.id
  }, ['user'])

  return this.graph.newBuilder()
    .builds('jeremy')
    .builds('jon')
    .define('jonWithId')
      .builds({'user1': 'user-addId'})
        .using({'user': 'jon'})
      .unless('bool-userHasId')
        .using({'user': 'jon'})
    .end()
    .run()
    .then(function (data) {
      test.equal('Jon', data['jon'].name, "Wrong user")
      test.ok('id' in data['jon'], "User doesn't have an id")
    })
})

builder.add(function testIncompleteBlock(test) {
  try {
    this.graph.newBuilder().define('incomplete').run()
    test.ok(false, 'Expected error')
  } catch (e) {
    test.ok(e.message.indexOf('Incomplete') != -1, e.stack)
  }
  test.done()
})


exports.testUnless4 = function (test) {
  this.graph.add('user-jeremy', function () {
    return {id: 345, name: "Jeremy"}
  })

  this.graph.add('user-addId2', function (user) {
    user.id = Math.floor(Math.random() * 100000) + 1
  }, ['user'])

  this.graph.add('bool-userHasId', function (user) {
    return !!user.id
  }, ['user'])

  // Make sure that user-addId2 doesn't get built
  // if the 'unless' clause fails.
  this.graph.add('user-addId', this.graph.subgraph, ['user'])
    .builds('user-addId2')
      .using('args.user')
    .returns('args.user')

  this.graph.newBuilder()
    .builds('user-jeremy')
    .define('jeremyWithId')
      .builds('user-addId')
        .using('user-jeremy')
      .unless('bool-userHasId')
        .using('user-jeremy')
    .end()
    .run()
    .then(function (data) {
      test.equal(345, data['user-jeremy'].id, "User has the wrong id")
    })
    .fail(function (e) {
      test.fail(e.stack)
    })
    .fin(function () {
      test.done()
    })
}

exports.testIncompleteBlock = function (test) {
  try {
    this.graph.newBuilder().define('incomplete').run()
    test.ok(false, 'Expected error')
  } catch (e) {
    test.ok(e.message.indexOf('Incomplete') != -1, e.stack)
  }
  test.done()
}

// test that multiple defines work
builder.add(function testMultipleDefines(test) {
  var counter = 0

  this.graph.add('counter-incr', function () {
    return ++counter
  })
  .disableNodeCache()

  this.graph.add('bool-true', function () {
    return true
  })

  this.graph.add('counter-incrTwice', this.graph.subgraph)
    .builds('!bool-true')
    .define('first')
      .builds({counter1: 'counter-incr'})
      .when('bool-true')
    .end()
    .define('second')
      .builds({counter2: 'counter-incr'})
      .when('bool-true')
    .end()
    .returns(['first', 'second'])

  return this.graph.newBuilder()
    .builds('counter-incrTwice')

    .run()
    .then(function (data) {
      test.equal(data['counter-incrTwice'][0], 1, "The first increment")
      test.equal(data['counter-incrTwice'][1], 2, "The second increment")
    })
})

// test two defines (the Jon way)
builder.add(function testTwoDefines(test) {
  this.graph.add('animalSounds', function (cowSound, goatSound) {
    test.equal(cowSound, 'MOO')
    test.equal(goatSound, 'AAHGHGH')
  }, [])
    .define('cowSound')
      .builds({sound1: this.graph.literal('MOO')})
      .when({cowIsAnAnimal: this.graph.literal(true)})
      .end()
    .define('goatSound')
      .builds({sound2: this.graph.literal('AAHGHGH')})
      .when({goatIsAnAnimal: this.graph.literal(true)})
      .end()

  return this.graph.newBuilder()
    .builds('animalSounds')
    .run()
})

// Test a define in a builder
builder.add(function testDefineInBuilder(test) {
  this.graph.add('greeting-english', function () { return 'Hello!'})
  this.graph.add('greeting-french', function () { return 'Bonjour!'})
  this.graph.add('bool-isFrancophile', function () { return true})

  return this.graph.newBuilder()
    .define('greeting')
      .builds({french1: 'greeting-french'})
        .when('bool-isFrancophile')
      .builds({english1: 'greeting-english'})
    .end()
    .builds({english2: 'greeting-english'})
    .run()
    .then(function (data) {
      test.equal(data['greeting'], 'Bonjour!', "The greeting should be in french!")
      test.equal(data['english2'], 'Hello!', 'The second english value should be returned')
    })
})

// Test that nodes can be built in the same define
builder.add(function testMultipleNodesInBuilderDefine(test) {
  this.graph.add('greeting-addExclamation', function (greeting) {
    return greeting + '!'
  }, ['greeting'])

  this.graph.add('greeting-english', function () { return 'Hello'})
  this.graph.add('greeting-french', function () { return 'Bonjour'})
  this.graph.add('bool-isFrancophile', function () { return true})
  this.graph.add('bool-isNotFrancophile', function () { return false})

  return this.graph.newBuilder()
    .define('greeting1')
      .builds({'greeting-french1': 'greeting-french'})
      .builds({'greeting-addExclamation1': 'greeting-addExclamation'})
        .using('greeting-french1')
        .when('bool-isFrancophile')
      .builds({'greeting-english1': 'greeting-english'})
    .end()

    .define('greeting2')
      .builds({'greeting-french2': 'greeting-french'})
      .builds({'greeting-addExclamation2': 'greeting-addExclamation'})
        .using('greeting-french2')
        .when('bool-isNotFrancophile')
      .builds({'greeting-english2': 'greeting-english'})
    .end()

    .run()
    .then(function (data) {
      test.equal(data['greeting1'], 'Bonjour!', "The greeting should be in french!")
      test.equal(data['greeting2'], 'Hello', "The greeting should be in english")
    })
})
