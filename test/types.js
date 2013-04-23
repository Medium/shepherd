// Copyright 2013 The Obvious Corporation.
var Q = require('kew')
var shepherd = require ('../lib/shepherd')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new shepherd.Graph
  done()
}

// test that dot notation for child values work
exports.testChildVariables = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('user', User)

  this.graph.add('user-withName', function () {
    var user = new User()
    user.name = "Joe"
    return user
  })

  var promises = []

  this.graph
    .newBuilder()
    .builds('user-withName.name')
    .run()
    .then(test.ok.bind(test, "User name should be returned"))
    .fail(test.fail.bind(test, "User name should be returned"))
    .fin(test.done)
}

// test that the same type can only be added once
exports.testDuplicateTypesFail = function (test) {
  try {
    this.graph
      .type('number', Number)
      .type('number', Number)
    test.fail("You may not add the same type twice")
  } catch (e) {
    test.equal(e.message, "A type already exists for 'number'")
  }

  test.done()
}

// test that enforcing types doesn't error with enforceTypes off
exports.testMissingType = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph
    .add('number-string', this.graph.literal(4))
    .newBuilder()
    .builds('number-string')
    .run()
    .then(test.fail.bind(test, "All responses must be typed"))
    .fail(test.ok.bind(test, "All responses must be typed"))
    .fin(test.done)
}

// test that nodes don't error with type checking disabled
exports.testTypeCheckingDisabled = function (test) {
  this.graph.type('number', Number)

  this.graph
    .add('number-string', this.graph.literal('Hello'))
    .newBuilder()
    .builds('number-string')
    .run()
    .then(test.ok.bind(test, "Type checking is disabled"))
    .fail(test.fail.bind(test, "Type checking is disabled"))
    .fin(test.done)
}

// test that enforcing types doesn't error with enforceTypes off
exports.testTypeCheckingWarning = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.WARN)

  this.graph.type('number', Number)

  console.log("*** FOLLOWING LINES SHOULD WARN, IGNORE ***")
  this.graph
    .add('number-string', this.graph.literal('Hello'))
    .newBuilder()
    .builds('number-string')
    .run()
    .then(test.ok.bind(test, "Type checking is disabled"))
    .fail(test.fail.bind(test, "Type checking is disabled"))
    .fin(function () {
      console.log("*** YOU MAY RETURN TO WORRYING ABOUT WARNINGS ***")
      test.done()
    })
}

// test that single numbers work
exports.testNumber = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('number', Number)

  var promises = []

  promises.push(
    this.graph
      .add('number-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('number-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid number"))
      .fail(test.fail.bind(test, "Undefined is a valid number"))
  )

  promises.push(
    this.graph
      .add('number-null', this.graph.literal(null))
      .newBuilder()
      .builds('number-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid number"))
      .fail(test.fail.bind(test, "Null is a valid number"))
  )

  promises.push(
    this.graph
      .add('number-number', this.graph.literal(4))
      .newBuilder()
      .builds('number-number')
      .run()
      .then(test.ok.bind(test, "4 is a valid number"))
      .fail(test.fail.bind(test, "4 is a valid number"))
  )

  promises.push(
    this.graph
      .add('number-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('number-string')
      .run()
      .then(test.fail.bind(test, "'Hello' is not a valid number"))
      .fail(test.ok.bind(test, "'Hello' is not a valid number"))
  )

  promises.push(
    this.graph
      .add('number-bool', this.graph.literal(true))
      .newBuilder()
      .builds('number-bool')
      .run()
      .then(test.fail.bind(test, "true is not a valid number"))
      .fail(test.ok.bind(test, "true is not a valid number"))
  )

  promises.push(
    this.graph
      .add('number-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('number-object')
      .run()
      .then(test.fail.bind(test, "Object is not a valid number"))
      .fail(test.ok.bind(test, "Object is not a valid number"))
  )

  promises.push(
    this.graph
      .add('number-array', this.graph.literal([]))
      .newBuilder()
      .builds('number-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid number"))
      .fail(test.ok.bind(test, "Array is not a valid number"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that single booleans work
exports.testBoolean = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('boolean', Boolean)

  var promises = []

  promises.push(
    this.graph
      .add('boolean-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('boolean-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid boolean"))
      .fail(test.fail.bind(test, "Undefined is a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-null', this.graph.literal(null))
      .newBuilder()
      .builds('boolean-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid boolean"))
      .fail(test.fail.bind(test, "Null is a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-number', this.graph.literal(4))
      .newBuilder()
      .builds('boolean-number')
      .run()
      .then(test.fail.bind(test, "4 is not a valid boolean"))
      .fail(test.ok.bind(test, "4 is not a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('boolean-string')
      .run()
      .then(test.fail.bind(test, "'Hello' is not a valid boolean"))
      .fail(test.ok.bind(test, "'Hello' is not a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-bool', this.graph.literal(true))
      .newBuilder()
      .builds('boolean-bool')
      .run()
      .then(test.ok.bind(test, "true is a valid boolean"))
      .fail(test.fail.bind(test, "true is a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('boolean-object')
      .run()
      .then(test.fail.bind(test, "Object is not a valid boolean"))
      .fail(test.ok.bind(test, "Object is not a valid boolean"))
  )

  promises.push(
    this.graph
      .add('boolean-array', this.graph.literal([]))
      .newBuilder()
      .builds('boolean-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid boolean"))
      .fail(test.ok.bind(test, "Array is not a valid boolean"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that single strings work
exports.testString = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('string', String)

  var promises = []

  promises.push(
    this.graph
      .add('string-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('string-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid string"))
      .fail(test.fail.bind(test, "Undefined is a valid string"))
  )

  promises.push(
    this.graph
      .add('string-null', this.graph.literal(null))
      .newBuilder()
      .builds('string-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid string"))
      .fail(test.fail.bind(test, "Null is a valid string"))
  )

  promises.push(
    this.graph
      .add('string-number', this.graph.literal(4))
      .newBuilder()
      .builds('string-number')
      .run()
      .then(test.fail.bind(test, "4 is not a valid string"))
      .fail(test.ok.bind(test, "4 is not a valid string"))
  )

  promises.push(
    this.graph
      .add('string-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('string-string')
      .run()
      .then(test.ok.bind(test, "'Hello' is a valid string"))
      .fail(test.fail.bind(test, "'Hello' is a valid string"))
  )

  promises.push(
    this.graph
      .add('string-bool', this.graph.literal(true))
      .newBuilder()
      .builds('string-bool')
      .run()
      .then(test.fail.bind(test, "true is not a valid string"))
      .fail(test.ok.bind(test, "true is not a valid string"))
  )

  promises.push(
    this.graph
      .add('string-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('string-object')
      .run()
      .then(test.fail.bind(test, "Object is not a valid string"))
      .fail(test.ok.bind(test, "Object is not a valid string"))
  )

  promises.push(
    this.graph
      .add('string-array', this.graph.literal([]))
      .newBuilder()
      .builds('string-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid string"))
      .fail(test.ok.bind(test, "Array is not a valid string"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that single objects work
exports.testObject = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('object', Object)

  var promises = []

  promises.push(
    this.graph
      .add('object-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('object-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid object"))
      .fail(test.fail.bind(test, "Undefined is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-null', this.graph.literal(null))
      .newBuilder()
      .builds('object-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid object"))
      .fail(test.fail.bind(test, "Null is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-number', this.graph.literal(4))
      .newBuilder()
      .builds('object-number')
      .run()
      .then(test.fail.bind(test, "4 is not a valid object"))
      .fail(test.ok.bind(test, "4 is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('object-string')
      .run()
      .then(test.fail.bind(test, "'Hello' is not a valid object"))
      .fail(test.ok.bind(test, "'Hello' is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-bool', this.graph.literal(true))
      .newBuilder()
      .builds('object-bool')
      .run()
      .then(test.fail.bind(test, "true is not a valid object"))
      .fail(test.ok.bind(test, "true is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('object-object')
      .run()
      .then(test.ok.bind(test, "Object is a valid object"))
      .fail(test.fail.bind(test, "Object is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-array', this.graph.literal([]))
      .newBuilder()
      .builds('object-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid object"))
      .fail(test.ok.bind(test, "Array is not a valid object"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that single objects work
exports.testObject = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('object', Object)

  var promises = []

  promises.push(
    this.graph
      .add('object-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('object-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid object"))
      .fail(test.fail.bind(test, "Undefined is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-null', this.graph.literal(null))
      .newBuilder()
      .builds('object-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid object"))
      .fail(test.fail.bind(test, "Null is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-number', this.graph.literal(4))
      .newBuilder()
      .builds('object-number')
      .run()
      .then(test.fail.bind(test, "4 is not a valid object"))
      .fail(test.ok.bind(test, "4 is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('object-string')
      .run()
      .then(test.fail.bind(test, "'Hello' is not a valid object"))
      .fail(test.ok.bind(test, "'Hello' is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-bool', this.graph.literal(true))
      .newBuilder()
      .builds('object-bool')
      .run()
      .then(test.fail.bind(test, "true is not a valid object"))
      .fail(test.ok.bind(test, "true is not a valid object"))
  )

  promises.push(
    this.graph
      .add('object-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('object-object')
      .run()
      .then(test.ok.bind(test, "Object is a valid object"))
      .fail(test.fail.bind(test, "Object is a valid object"))
  )

  promises.push(
    this.graph
      .add('object-array', this.graph.literal([]))
      .newBuilder()
      .builds('object-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid object"))
      .fail(test.ok.bind(test, "Array is not a valid object"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that single user objects work
exports.testUserType = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('user', User)

  var promises = []

  promises.push(
    this.graph
      .add('user-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('user-undefined')
      .run()
      .then(test.ok.bind(test, "Undefined is a valid user"))
      .fail(test.fail.bind(test, "Undefined is a valid user"))
  )

  promises.push(
    this.graph
      .add('user-null', this.graph.literal(null))
      .newBuilder()
      .builds('user-null')
      .run()
      .then(test.ok.bind(test, "Null is a valid user"))
      .fail(test.fail.bind(test, "Null is a valid user"))
  )

  promises.push(
    this.graph
      .add('user-number', this.graph.literal(4))
      .newBuilder()
      .builds('user-number')
      .run()
      .then(test.fail.bind(test, "4 is not a valid user"))
      .fail(test.ok.bind(test, "4 is not a valid user"))
  )

  promises.push(
    this.graph
      .add('user-string', this.graph.literal('Hello'))
      .newBuilder()
      .builds('user-string')
      .run()
      .then(test.fail.bind(test, "'Hello' is not a valid user"))
      .fail(test.ok.bind(test, "'Hello' is not a valid user"))
  )

  promises.push(
    this.graph
      .add('user-bool', this.graph.literal(true))
      .newBuilder()
      .builds('user-bool')
      .run()
      .then(test.fail.bind(test, "true is not a valid user"))
      .fail(test.ok.bind(test, "true is not a valid user"))
  )

  promises.push(
    this.graph
      .add('user-object', this.graph.literal({name: "Hello"}))
      .newBuilder()
      .builds('user-object')
      .run()
      .then(test.fail.bind(test, "Object is not a valid user"))
      .fail(test.ok.bind(test, "Object is not a valid user"))
  )

  promises.push(
    this.graph
      .add('user-user', this.graph.literal(new User()))
      .newBuilder()
      .builds('user-user')
      .run()
      .then(test.ok.bind(test, "User is a valid user"))
      .fail(test.fail.bind(test, "User is a valid user"))
  )

  promises.push(
    this.graph
      .add('user-array', this.graph.literal([]))
      .newBuilder()
      .builds('user-array')
      .run()
      .then(test.fail.bind(test, "Array is not a valid user"))
      .fail(test.ok.bind(test, "Array is not a valid user"))
  )

  Q.all(promises)
    .fin(test.done)
}

// test that arrays work
exports.testArray = function (test) {
  this.graph.enforceTypes(shepherd.ErrorMode.ERROR)

  this.graph.type('strs', [String])
  this.graph.type('users', [User])

  var promises = []

  promises.push(
    this.graph
      .add('strs-undefined', this.graph.literal(undefined))
      .newBuilder()
      .builds('strs-undefined')
      .run()
      .then(test.fail.bind(test, "undefined is not a valid array"))
      .fail(test.ok.bind(test, "undefined is not a valid array"))
  )

  promises.push(
    this.graph
      .add('strs-null', this.graph.literal(null))
      .newBuilder()
      .builds('strs-null')
      .run()
      .then(test.fail.bind(test, "null is not a valid array"))
      .fail(test.ok.bind(test, "null is not a valid array"))
  )

  promises.push(
    this.graph
      .add('strs-empty', this.graph.literal([]))
      .newBuilder()
      .builds('strs-empty')
      .run()
      .then(test.ok.bind(test, "Empty arrays are valid"))
      .fail(test.fail.bind(test, "Empty arrays are valid"))
  )

  promises.push(
    this.graph
      .add('strs-strs', this.graph.literal(['Hello', 'there']))
      .newBuilder()
      .builds('strs-strs')
      .run()
      .then(test.ok.bind(test, "All string arrays are valid"))
      .fail(test.fail.bind(test, "All string arrays are valid"))
  )

  promises.push(
    this.graph
      .add('strs-mixedValid', this.graph.literal(['Hello', 'there', null, undefined, 'one', 'two']))
      .newBuilder()
      .builds('strs-mixedValid')
      .run()
      .then(test.ok.bind(test, "Mixed string and null / undefined arrays are valid"))
      .fail(test.fail.bind(test, "Mixed string and null / undefined arrays are valid"))
  )

  promises.push(
    this.graph
      .add('strs-mixedInvalid1', this.graph.literal(['Hello', 'there', 4, null, undefined, 'one', 'two']))
      .newBuilder()
      .builds('strs-mixedInvalid1')
      .run()
      .then(test.fail.bind(test, "Numbers in string results are invalid"))
      .fail(test.ok.bind(test, "Numbers in string results are invalid"))
  )

  promises.push(
    this.graph
      .add('strs-mixedInvalid2', this.graph.literal(['Hello', 'there', {}, null, undefined, 'one', 'two']))
      .newBuilder()
      .builds('strs-mixedInvalid2')
      .run()
      .then(test.fail.bind(test, "Objects in string results are invalid"))
      .fail(test.ok.bind(test, "Objects in string results are invalid"))
  )

  promises.push(
    this.graph
      .add('strs-mixedInvalid3', this.graph.literal(['Hello', 'there', false, null, undefined, 'one', 'two']))
      .newBuilder()
      .builds('strs-mixedInvalid3')
      .run()
      .then(test.fail.bind(test, "Booleans in string results are invalid"))
      .fail(test.ok.bind(test, "Booleans in string results are invalid"))
  )

  promises.push(
    this.graph
      .add('users-mixed', this.graph.literal([new User(), null, undefined, new User()]))
      .newBuilder()
      .builds('users-mixed')
      .run()
      .then(test.ok.bind(test, "Mixed user and null / undefined arrays are valid"))
      .fail(test.fail.bind(test, "Mixed user and null / undefined arrays are valid"))
  )

  promises.push(
    this.graph
      .add('users-mixedInvalid', this.graph.literal([new User(), false, null, undefined, new User()]))
      .newBuilder()
      .builds('users-mixedInvalid')
      .run()
      .then(test.fail.bind(test, "Booleans in user arrays are invalid"))
      .fail(test.ok.bind(test, "Booleans in user arrays are invalid"))
  )

  Q.all(promises)
    .fin(test.done)
}

function User() {}

function returnUser(){ return new User() }
function returnObj(){ return {} }
function returnUndefined(){ return undefined }
function returnString(){ return 'hello' }
function returnNumber(){ return 1234 }
function returnBoolean(){ return true }
function returnNull(){ return null }
function wrapResponseInArray(fn) {
  return function () {
    return [fn()]
  }
}
