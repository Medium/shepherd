// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/shepherd')).Graph
  done()
}

// test that the function for a node can be retrieved
exports.testFunction = function (test) {
  var echo = function (input) { return input }
  this.graph.add('echo', echo, ['input'])
  test.equal(this.graph.getFunction('echo'), echo, "The handler function should be returned")
  test.done()
}

// test that handlers are required for nodes
exports.testMissingNodesGraph = function (test) {
  this.graph.add('testFn')

  try {
    this.graph.newBuilder()
      .builds('testFn')
      .compile()
    test.fail('Functions without callbacks should throw errors')
  } catch (e) {
    test.equal(e.message.indexOf('requires a callback') > 0, true, 'Functions without callbacks should throw errors')
  }
  test.done()
}

// test that handlers are required for nodes
exports.testMissingNodesBuilder = function (test) {
  this.graph.add('testFn')

  this.graph.newBuilder()
    .builds('testFn')
    .run()
    .then(function () {
      test.fail('Functions without callbacks should throw errors')
    })
    .fail(function (e) {
      test.equal(e.message.indexOf('requires a callback') > 0, true, 'Functions without callbacks should throw errors')
    })
    .fin(test.done.bind(test))
}

// test passing args inline vs chained
exports.testArgs = function (test) {
  var name = 'Jeremy'
  var returnInput = function () {
    return arguments[0]
  }
  this.graph.add('name-inlineArgs', returnInput, ['name'])
  this.graph.add('name-chainedArgs', returnInput)
    .args('name')

  this.graph.newBuilder()
    .builds('name-inlineArgs')
    .builds('name-chainedArgs')
    .run({name: name}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through callback')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through promise')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test passing func inline vs chained
exports.testFunc = function (test) {
  var name = 'Jeremy'
  var returnInput = function () {
    return arguments[0]
  }
  this.graph.add('name-inlineArgs', returnInput)
    .args('name')
  this.graph.add('name-chainedArgs')
    .args('name')
    .fn(returnInput)

  this.graph.newBuilder()
    .builds('name-inlineArgs')
    .builds('name-chainedArgs')
    .run({name: name}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through callback')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-inlineArgs'], name, 'Response should be returned through promise')
      test.equal(result['name-chainedArgs'], name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (object) through graph.literal()
exports.testAddLiteralObjectThroughFunction = function (test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (object) through val passed to graph.add() directly
exports.testAddLiteralObjectThroughVal = function (test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, nodeValue)

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (object) through val passed through {_literal:VAL}
exports.testAddLiteralObjectThroughObject = function (test) {
  var nodeName = 'user'
  var nodeValue = {name: 'Jeremy'}
  this.graph.add(nodeName, {_literal: nodeValue})

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (number) through val passed through graph.literal
exports.testAddLiteralNumberThroughFunction = function (test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (number) through val passed to graph.add() directly
exports.testAddLiteralNumberThroughVal = function (test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, nodeValue)

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (number) through val passed through {_literal:VAL}
exports.testAddLiteralNumberThroughObject = function (test) {
  var nodeName = 'size'
  var nodeValue = 1234
  this.graph.add(nodeName, {_literal: nodeValue})

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (string) through val passed to graph.literal()
exports.testAddLiteralStringThroughFunction = function (test) {
  var nodeName = 'name'
  var nodeValue = 'Jeremy'
  this.graph.add(nodeName, this.graph.literal(nodeValue))

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// adding literal (string) through val passed through {_literal:VAL}
exports.testAddLiteralStringThroughObject = function (test) {
  var nodeName = 'name'
  var nodeValue = 'Jeremy'
  this.graph.add(nodeName, {_literal: nodeValue})

  this.graph.newBuilder()
    .builds(nodeName)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// anonymous functions should be be added to the graph correctly and should have valid dependencies
exports.testAddAnonymous = function (test) {
  var nodeHint = 'name'
  var nodeValue = 'Jeremy'
  var nodeName = this.graph.addAnonymous(nodeHint, function () {
    return nodeValue
  })
  var nodeName2 = this.graph.addAnonymous(nodeHint, function (val) {
    return val
  }, [nodeName])

  test.equal(nodeName.substr(0, nodeHint.length), nodeHint, 'Anonymous node prefix should match node hint')

  this.graph.newBuilder()
    .builds(nodeName)
    .builds(nodeName2)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[nodeName], nodeValue, 'Response should be returned through callback')
      test.equal(result[nodeName2], nodeValue, 'Response w/ dependency should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[nodeName], nodeValue, 'Response should be returned through promise')
      test.equal(result[nodeName2], nodeValue, 'Response w/ dependency should be returned through callback')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// functions should be clonable via graph.add('newNodeName', 'oldNodeName')
exports.testClone = function (test) {
  var nodeHint = 'name'
  var nodeValue = 'Jeremy'
  var nodeName = this.graph.addAnonymous(nodeHint, function () {
    return nodeValue
  })
  var clonedNode = 'name-cloned'
  this.graph.add(clonedNode, nodeName)

  this.graph.newBuilder()
    .builds(clonedNode)
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result[clonedNode], nodeValue, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result[clonedNode], nodeValue, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// functions should take an expected number of arguments
exports.testNumArguments = function (test) {
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

  this.graph.newBuilder()
    .builds('e')
    .run({})
    .then(function () {
      test.done()
    })
    .end()
}

// functions should run in order based on normal and silent dependencies
exports.testNodeOrder = function (test) {
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

  this.graph.newBuilder()
    .builds('d')
    .builds('e')
      .using('!d')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(output, 'abcde', 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(output, 'abcde', 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// required fields for merged nodes should return a single array of dependencies for both
exports.testMergedRequiredFields = function (test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.deepEqual(requiredFields, ['name', 'age'])
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])
  this.graph.add('obj-second', getObj, ['obj', '_requiredFields'])

  this.graph.newBuilder()
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
    .then(function () {
      test.done()
    })
    .end()
}

// required fields of a node should be passed as an array if always referenced via members
exports.testRequiredFieldsMembers = function (test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.deepEqual(requiredFields, ['name', 'age'])
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  this.graph.newBuilder()
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
    .then(function () {
      test.done()
    })
    .end()
}

// node should receive '*' as requiredFields if only referenced as an entire object
exports.testRequiredFieldEntireObject = function (test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.equal(requiredFields, '*')
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  this.graph.newBuilder()
    .builds('obj-first')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first'], obj, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['obj-first'], obj, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node should receive '*' as requiredFields if referenced as an entire object as well as via members
exports.testRequiredFieldEntireObject = function (test) {
  var obj = {name: "Jeremy"}

  function getObj(obj, requiredFields) {
    test.equal(requiredFields, '*')
    return obj
  }
  this.graph.add('obj-first', getObj, ['obj', '_requiredFields'])

  this.graph.newBuilder()
    .builds('obj-first')
    .builds('obj-first.name')
    .run({obj: obj}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['obj-first'], obj, 'Response should be returned through callback')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['obj-first'], obj, 'Response should be returned through promise')
      test.equal(result['obj-first.name'], obj.name, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node should be uncacheable
exports.testDisablingCache = function (test) {
  var count = 0
  function incrementCount() {
    return ++count
  }
  this.graph.add('count-incremented', incrementCount)
    .disableCache()

  this.graph.newBuilder()
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
    .then(function () {
      test.done()
    })
    .end()
}

// node should be cacheable
exports.testEnablingCache = function (test) {
  var count = 0
  function incrementCount() {
    return ++count
  }
  this.graph.add('count-incremented', incrementCount)

  this.graph.newBuilder()
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
    .then(function () {
      test.done()
    })
    .end()
}

// nodes should only be added with a 2-part hyphen-delimited name
exports.testHyphenatedNames = function (test) {
  this.graph = this.graph.clone()
  this.graph.enforceTwoPartNames()

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
}
