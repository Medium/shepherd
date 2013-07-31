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

// test that the function for a node can be retrieved
builder.add(function testFunction(test) {
  var echo = function (input) { return input }
  this.graph.add('echo', echo, ['input'])
  test.equal(this.graph.getFunction('echo'), echo, "The handler function should be returned")
  test.done()
})

// test that adding an undefined literal works
builder.add(function testUndefinedLiteral(test) {
  try {
    var undefinedVal = undefined
    var nullVal = null
    var numVal = 4

    this.graph.add('val-notProvided', this.graph.literal())
    this.graph.add('val-undefined', this.graph.literal(undefined))
    this.graph.add('val-null', this.graph.literal(null))
    this.graph.add('val-number', this.graph.literal(1))
    this.graph.add('val-str', this.graph.literal('abc'))
    this.graph.add('val-obj', this.graph.literal({name:'hello'}))
    this.graph.add('val-fn', this.graph.literal(function () {}))
    this.graph.add('val-varNum', this.graph.literal(numVal))
    this.graph.add('val-varNull', this.graph.literal(nullVal))
    this.graph.add('val-varUndefined', this.graph.literal(undefinedVal))

    this.graph.add('val-notProvided2', this.graph.literal())
    this.graph.add('val-undefined2', this.graph.literal(undefined))
    this.graph.add('val-null2', this.graph.literal(null))
    this.graph.add('val-number2', this.graph.literal(1))
    this.graph.add('val-str2', this.graph.literal('abc'))
    this.graph.add('val-obj2', this.graph.literal({name:'hello'}))
    this.graph.add('val-fn2', this.graph.literal(function () {}))
    this.graph.add('val-varNum2', this.graph.literal(numVal))
    this.graph.add('val-varNull2', this.graph.literal(nullVal))
    this.graph.add('val-varUndefined2', this.graph.literal(undefinedVal))

    test.ok("Able to add an undefined literal")
  } catch (e) {
    test.fail(e.stack)
  }

  test.done()
})

// test that literals deduplicate correctly
builder.add(function testLiteralDeduplication(test) {
  this.graph.add('name-a', this.graph.literal('Jeremy'))
  this.graph.add('name-b', this.graph.literal('Jeremy'))
  var counter = 0

  this.graph.add('name-echo', function (name) {
    counter++
    return name
  }, ['name'])

  return this.graph.newBuilder()
    .builds({nameA: 'name-echo'})
      .using('name-a')
    .builds({nameB: 'name-echo'})
      .using('name-b')
    .run()
    .then(function (data) {
      test.equal(data.nameA, 'Jeremy', "Name should match")
      test.equal(data.nameB, 'Jeremy', "Name should match")
      test.equal(counter, 1, "Echo should only have ran once")
    })
})

// test that adding the same node twice fails
builder.add(function testAddTwice(test) {
  this.graph.add('a', function () {
    return 1
  })

  try {
    this.graph.add('a', function () {
      return 2
    })
    test.fail("Should have failed due to existing node")
  } catch (e) {
    test.ok(e.message, "This node already exists \"a\"", "Should have failed due to existing node")
  }

  test.done()
})

// test that force adding a node overrides the existing value
builder.add(function testForceAdd(test) {
  this.graph.add('a', function () {
    return 1
  })

  this.graph.add('+a', function () {
    return 2
  })

  return this.graph.newBuilder()
    .builds('a')
    .run()
    .then(function (data) {
      test.equal(data['a'], 2, "A should have been overwritten")
    })
})

// test that handlers are required for nodes
builder.add(function testMissingNodesGraph(test) {
  this.graph.add('testFn')

  try {
    this.graph.newBuilder()
      .builds('testFn')
      .compile()
    test.fail('Functions without callbacks should throw errors')
  } catch (e) {
    test.equal(e.message.indexOf('requires a callback') > 0, true,
               'Functions without callbacks should throw different errors: ' + e)
  }
  test.done()
})

// test that handlers are required for nodes
builder.add(function testMissingNodesBuilder(test) {
  this.graph.add('testFn')

  return this.graph.newBuilder()
    .builds('testFn')
    .run()
    .then(function () {
      test.fail('Functions without callbacks should throw errors')
    })
    .fail(function (e) {
      test.equal(e.message.indexOf('requires a callback') > 0, true,
                 'Functions without callbacks should throw different errors: ' + e)
    })
})

// test passing args inline vs chained
builder.add(function testArgs(test) {
  var name = 'Jeremy'
  var returnInput = function () {
    return arguments[0]
  }
  this.graph.add('name-inlineArgs', returnInput, ['name'])
  this.graph.add('name-chainedArgs', returnInput)
    .args('name')

  return this.graph.newBuilder()
    .builds('name-inlineArgs')
    .builds('name-chainedArgs')
    .run({name: name}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through callback')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through promise')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through promise')
    })
})

// test passing func inline vs chained
builder.add(function testFunc(test) {
  var name = 'Jeremy'
  var returnInput = function () {
    return arguments[0]
  }
  this.graph.add('name-inlineArgs', returnInput)
    .args('name')
  this.graph.add('name-chainedArgs')
    .args('name')
    .fn(returnInput)

  return this.graph.newBuilder()
    .builds('name-inlineArgs')
    .builds('name-chainedArgs')
    .run({name: name}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through callback')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through promise')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through promise')
    })
})

// adding literal (object) through graph.literal()
builder.add(function testAddLiteralObjectThroughFunction(test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (object) through val passed to graph.add() directly
builder.add(function testAddLiteralObjectThroughVal(test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, nodeValue)

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (object) through val passed through {_literal:VAL}
builder.add(function testAddLiteralObjectThroughObject(test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, {_literal: nodeValue})

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (number) through val passed through graph.literal
builder.add(function testAddLiteralNumberThroughFunction(test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (number) through val passed to graph.add() directly
builder.add(function testAddLiteralNumberThroughVal(test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, nodeValue)

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (number) through val passed through {_literal:VAL}
builder.add(function testAddLiteralNumberThroughObject(test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, {_literal: nodeValue})

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (string) through val passed to graph.literal()
builder.add(function testAddLiteralStringThroughFunction(test) {
  var nodeName = 'name'
  var nodeValue = 'Jeremy'
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// adding literal (string) through val passed through {_literal:VAL}
builder.add(function testAddLiteralStringThroughObject(test) {
  var nodeName = 'name'
  var nodeValue = 'Jeremy'
  this.graph.add(nodeName, {_literal: nodeValue})

  return this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
})

// anonymous functions should be be added to the graph correctly and should have valid dependencies
builder.add(function testAddAnonymous(test) {
  var nodeHint = 'name'
  var nodeValue = 'Jeremy'
  var nodeName = this.graph.addAnonymous(nodeHint, function () {
    return nodeValue
  })
  var nodeName2 = this.graph.addAnonymous(nodeHint, function (val) {
    return val
  }, [nodeName])

  test.equal(nodeName.substr(0, nodeHint.length), nodeHint, 'Anonymous node prefix should match node hint')

  return this.graph.newBuilder()
    .builds(nodeName)
    .builds(nodeName2)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
      test.equal(result[nodeName2], nodeValue, 'Response w/ dependency should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
      test.equal(result[nodeName2], nodeValue, 'Response w/ dependency should be returned through callback')
    })
})

// functions should be clonable via graph.add('newNodeName', 'oldNodeName')
builder.add(function testClone(test) {
  var nodeHint = 'name'
  var nodeValue = 'Jeremy'
  var nodeName = this.graph.addAnonymous(nodeHint, function () {
    return nodeValue
  })
  var clonedNode = 'name-cloned'
  this.graph.add(clonedNode, nodeName)

  return this.graph.newBuilder()
    .builds(clonedNode)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[clonedNode], nodeValue, 'Response should be returned through callback')
    })
    .then(function (result) {
      test.equal(result[clonedNode], nodeValue, 'Response should be returned through promise')
    })
})

// functions should take an expected number of arguments
builder.add(function testNumArguments(test) {
  var argCounter = function (numExpected) {
    return function () {
      // expect 1 more argument than specified (for the callback)
      test.equal(arguments.length, numExpected + 1, 'Expected ' + numExpected + ' args')
      return true
    }
  }

  this.graph.add('a', argCounter(0))
  this.graph.add('b', argCounter(1), ['a'])
  this.graph.add('c', argCounter(0), ['!b'])
  this.graph.add('d', argCounter(2), ['a', 'b', '!c'])
  this.graph.add('e', argCounter(4), ['a', 'b', 'c', 'd'])

  return this.graph.newBuilder()
    .builds('e')
    .run({})
})

// functions should run in order based on normal and important dependencies
builder.add(function testNodeOrder(test) {
  var output = ''
  var appender = function (str) {
    return function () {
      output += str
      return true
    }
  }

  this.graph.add('e', appender('e'), ['a', 'b', 'c', 'd'])
  this.graph.add('d', appender('d'), ['a', 'b', '!c'])
  this.graph.add('c', appender('c'), ['!b'])
  this.graph.add('b', appender('b'), ['a'])
  this.graph.add('a', appender('a'))

  return this.graph.newBuilder()
    .builds('e')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(output, 'abcde')
    })
    .then(function (result) {
      test.equal(output, 'abcde')
    })
})

// required fields for merged nodes should return a single array of dependencies for both
builder.add(function testMergedRequiredFields(test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.deepEqual(requiredFields, ['name', 'age'])
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])
  this.graph.add('obj-second', getObj, ['obj', '_requiredFields'])

  return this.graph.newBuilder()
    .builds('obj-first.name')
    .builds('obj-second.age')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through callback')
      test.equal(result['obj-second.age'], obj.age, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through promise')
      test.equal(result['obj-second.age'], obj.age, 'Response should be returned through promise')
    })
})

// required fields of a node should be passed as an array if always referenced via members
builder.add(function testRequiredFieldsMembers(test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.deepEqual(requiredFields, ['name', 'age'])
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  return this.graph.newBuilder()
    .builds('obj-first.name')
    .builds('obj-first.age')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through callback')
      test.equal(result['obj-first.age'], obj.age, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through promise')
      test.equal(result['obj-first.age'], obj.age, 'Response should be returned through promise')
    })
})

// node should receive '*' as requiredFields if only referenced as an entire object
builder.add(function testRequiredFieldEntireObject(test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.equal(requiredFields, '*')
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  return this.graph.newBuilder()
    .builds('obj-first')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first'], obj, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called: ' + err)
    })
    .then(function (result) {
      test.equal(result['obj-first'], obj, 'Response should be returned through promise')
    })
})

// node should receive '*' as requiredFields if referenced as an entire object as well as via members
builder.add(function testRequiredFieldEntireObject2(test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.equal(requiredFields, '*')
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  return this.graph.newBuilder()
    .builds('obj-first')
    .builds('obj-first.name')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first'], obj, 'Response should be returned through callback')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called: ' + err)
    })
    .then(function (result) {
      test.equal(result['obj-first'], obj, 'Response should be returned through promise')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through promise')
    })
})

// node should be uncacheable
builder.add(function testDisablingCache(test) {
  var count = 0
  function incrementCount() {
    return ++count
  }
  this.graph.add('count-incremented', incrementCount)
    .disableNodeCache()

  return this.graph.newBuilder()
    .builds({'count1': 'count-incremented'})
    .builds({'count2': 'count-incremented'})
    .builds({'count3': 'count-incremented'})
    .builds({'count4': 'count-incremented'})
    .builds({'count5': 'count-incremented'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(count, 5, 'Response should be returned through callback')
      test.equal(result.count1 + result.count2 + result.count3 + result.count4 + result.count5, 1 + 2 + 3 + 4 + 5, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(count, 5, 'Response should be returned through promise')
      test.equal(result.count1 + result.count2 + result.count3 + result.count4 + result.count5, 1 + 2 + 3 + 4 + 5, 'Response should be returned through promise')
    })
})

// test that the disable cache flag forces a recalculation of dependencies
builder.add(function testDisablingCacheDependency(test) {
  var obj = {
    counter: 0
  }

  this.graph.add('obj-fromLiteral', this.graph.literal(obj))

  this.graph.add('bool-incrementCounter', function (obj) {
    obj.counter++
    return true
  }, ['obj']).disableNodeCache()

  this.graph.add('counter-fromObject', function (obj) {
    return obj.counter
  }, ['obj'])

  return this.graph.newBuilder()
    .builds({'myObject': 'obj-fromLiteral'})
    .builds({preCounter: 'counter-fromObject'})
      .using({obj: 'myObject'})
    .builds('bool-incrementCounter')
      .using({obj: 'myObject'})
    .builds({postCounter: 'counter-fromObject'})
      .using('!bool-incrementCounter', {obj: 'myObject'})

    .run()
    .then(function (data) {
      test.equal(data.preCounter, 0, "First counter should be 0")
      test.equal(data.postCounter, 1, "Second counter should be 1")
    })
})

builder.add(function testDisablingCacheRecursiveDependency(test) {
  try {
    this.graph.disableCallbacks()

    var counter = 0
    var users = {}
    var newUser = {
      id: "TestUser",
      name: "Fred"
    }

    this.graph.add('bool-saveUser_', function (user) {
      users[user.id] = user
      return true
    }, ['user'])
    .disableNodeCache()

    this.graph.add('bool-createUser', this.graph.subgraph, ['user'])
      .builds('bool-saveUser_')
        .using('args.user')

    this.graph.add('user-byUserId', function (userId) {
      counter++
      return users[userId]
    }, ['userId'])

    return this.graph.newBuilder()
      // should call normally
      .builds({preSave1: 'user-byUserId'})
        .using({userId: 'inputUser.id'})
      // should deduplicate with the first call
      .builds({preSave2: 'user-byUserId'})
        .using({userId: 'inputUser.id'})
      // should update the object
      .builds('bool-createUser')
        .using({user: 'inputUser'})
      // should cause a new load due to bool-saveUser_ not caching
      .builds({postSave1: 'user-byUserId'})
        .using('!bool-createUser', {userId: 'inputUser.id'})
      // should cause a new load due to bool-saveUser_ not caching
      .builds({postSave2: 'user-byUserId'})
        .using('!bool-createUser', {userId: 'inputUser.id'})
      .run({inputUser: newUser})
      .then(function (data) {
        test.equal(data.preSave1, undefined, "User pre-save should be undefined")
        test.equal(data.preSave1, undefined, "User pre-save should be undefined")
        test.equal(data.postSave1, newUser, "User post-save should be defined")
        test.equal(data.postSave2, newUser, "User post-save should be defined")
      })
  } catch (e) {
    console.error(e.stack)
  }
})

// node should be cacheable
builder.add(function testEnablingCache(test) {
  var count = 0
  function incrementCount() {
    return ++count
  }
  this.graph.add('count-incremented', incrementCount)

  return this.graph.newBuilder()
    .builds({'count1': 'count-incremented'})
    .builds({'count2': 'count-incremented'})
    .builds({'count3': 'count-incremented'})
    .builds({'count4': 'count-incremented'})
    .builds({'count5': 'count-incremented'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(count, 1, 'Response should be returned through callback')
      test.equal(result.count1 + result.count2 + result.count3 + result.count4 + result.count5, 1 + 1 + 1 + 1 + 1, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(count, 1, 'Response should be returned through promise')
      test.equal(result.count1 + result.count2 + result.count3 + result.count4 + result.count5, 1 + 1 + 1 + 1 + 1, 'Response should be returned through promise')
    })
})

// nodes should only be added with a 2-part hyphen-delimited name
builder.add(function testHyphenatedNames(test) {
  this.graph = this.graph.clone()
  this.graph.enforceTwoPartNames(shepherd.ErrorMode.ERROR)

  this.graph.add('test-delimited', this.graph.literal('ok'))

  try {
    this.graph.add('testNonDelimited', this.graph.literal('not ok'))
    test.fail("Should not be allowed to add the 'testNonDelimited' node")
  } catch (e) {
    test.ok(true, "Verified unable to add 'testNonDelimited' node")
  }

  try {
    this.graph.add('test-extra-delimited', this.graph.literal('not ok'))
    test.fail("Should not be allowed to add the 'test-extra-delimited' node")
  } catch (e) {
    test.ok(true, "Verified unable to add 'test-extra-delimited' node")
  }

  this.graph.add('+test-extra-delimited', this.graph.literal('not ok'))

  try {
    this.graph.add('-prefixed', this.graph.literal('not ok'))
    test.fail("Should not be allowed to add the '-prefixed' node")
  } catch (e) {
    test.ok(true, "Verified unable to add '-prefixed' node")
  }

  try {
    this.graph.add('suffixed-', this.graph.literal('not ok'))
    test.fail("Should not be allowed to add the 'suffixed-' node")
  } catch (e) {
    test.ok(true, "Verified unable to add 'suffixed-' node")
  }

  test.done()
})
