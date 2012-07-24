var asyncBuilder = require("./lib2/asyncBuilder")
var BuilderResponse = asyncBuilder.BuilderResponse
var q = require("q")
var assert = require("assert")

process.on('uncaughtException', function(e) {
  console.log(e.stack)
})

// basic request object for testing
var request = {
  currentUser: {
    username: "jeremy"
  }
}

// retrieve the salt we expect to create through the factories
var expectedSalt = function () {
  var delimiter = joinDelimiters('<', '-', '>')
  var currentUser = getCurrentUser(request)
  var currentSeconds = getSecondsNow(getMillisNow())
  return createUserSalt(currentUser.username, delimiter, currentSeconds)
}()

var testMethods = [
    testLiteral
  , testDelay
  , testSynchronous
  , testCallbacks
  , testPromises
  , testThrowCallback
  , testThrowSynchronouslyCallback
  , testRemapObject
  , testRemapArray
  , testMissingNodes
  , testScope
]
function runNextTest() {
  if (testMethods.length) {
    testMethod = testMethods.shift()
    process.nextTick(function () {
      testMethod(runNextTest)
    })
  }
}
runNextTest()

function singleDelimiter(delimiter) {
  return delimiter
}

function joinDelimiters(delimiter1, delimiter2, delimiter3) {
  return delimiter1 + delimiter2 + delimiter3
}

function createDelimiter(factory) {
  var builder = factory
    .add('delimiter1', singleDelimiter, ['firstDelimiter'])
    .add('delimiter2', singleDelimiter, ['secondDelimiter'])
    .add('delimiter3', singleDelimiter, ['thirdDelimiter'])
    .add('finalDelimiter', joinDelimiters, ['delimiter1', 'delimiter2', 'delimiter3'])
    .newBuilder('finalDelimiter')

  return function (firstDelimiter, secondDelimiter, thirdDelimiter, next) {
    builder.build({
      firstDelimiter: firstDelimiter,
      secondDelimiter: secondDelimiter,
      thirdDelimiter: thirdDelimiter
    }, function (err, data) {
      next(err, data.finalDelimiter)
    })
  }
}

/**
 * uppercase a string
 *
 * @param {string} str the string to uppercase
 * @param {Function} next
 */
function upperCase(str, next) {
  next(null, str.toUpperCase())
}

/**
 * lowercase a string
 *
 * @param {string} str the string to lowercase
 * @param {Function} next
 */
function lowerCase(str, next) {
  next(null, str.toLowerCase())
}

/**
 * split a string into substrings by spaces
 *
 * @param {string} str the string to uppercase
 * @param {Function} next
 */
function split(str, next) {
  next(null, str.split(' '))
}

/**
 * join 2 strings with a space in between
 *
 * @param {string} strA the first string
 * @param {string} strB the second string
 * @param {Function} next
 */
function join(strA, strB, next) {
  next(null, strA + ' ' + strB)
}

function Scoped(name) {
  this.name = name
}

Scoped.prototype.getName = function (lastName) {
  return this.name + " " + lastName
}

Scoped.prototype.getNameDelayed = function (lastName, next) {
  setTimeout(function () {
    next(null, this.getName(lastName))
  }.bind(this), 5000)
}

/**
 * Test scoping of a handler
 */
function testScope(next) {
  console.log("test scope")
  var scoped = new Scoped("Jeremy")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add('name', [scoped.getName, scoped, 'Stanley'])
  try {
    var builder = factory.newBuilder('name')
    builder.build({}, function (err, data) {
      assert.equal(data.name, 'Jeremy Stanley')
      next()
    })
  } catch (e) {
    console.error(e)
  }
}

/**
 * Test delaying of a handler
 */
function testDelay(next) {
  console.log("test delay")
  var scoped = new Scoped("Jeremy")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add('name', [scoped.getNameDelayed, scoped, 'Stanley'])
  try {
    var builder = factory.newBuilder('name')
    builder.build({}, function (err, data) {
      try {
        assert.equal(data.name, 'Jeremy Stanley')
        next()
      } catch (e) {
        console.error(e)
      }
    })
  } catch (e) {
    console.error(e)
  }
}

/**
 * Test running a builder with missing nodes
 *
 * @param {Function} next
 */
function testMissingNodes(next) {
  console.log("test missing nodes")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add('toUpper', upperCase, ['str'])
  factory.add('join', join, ['strA', 'strB'])
  try {
    var builder = factory.newBuilder('toUpper', 'join')
    builder.build({}, function (err, data) {})
    assert.equal(false, true, "Shouldn't have passed this build step")
  } catch (e) {
    assert.equal(e.message, "toUpper requires [str]; join requires [strA, strB]")
    next()
  }
}

/**
 * Test adding a specific value in the provideTo method
 *
 * @param {Function} next
 */
function testLiteral(next) {
  console.log("testing literal")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add('str-toUpper', upperCase, ['str'])
  factory.provideTo('str-toUpper', {str: factory.literal('jeremy')})
  factory.newBuilder('str-toUpper')
  .build({str: 'jeremys'}, function (err, data) {
    try {
      assert.deepEqual(data['str-toUpper'], 'JEREMY')
    } catch (e) {
      console.error(e)
    }
    next()
  })
}

/**
 * Test remapping the inputs of a node with a deps object
 *
 * @param {Function} next
 */
function testRemapObject(next) {
  console.log("testing remap object")

  var factory = new asyncBuilder.BuilderFactory()
  factory.add('str-toUpper', upperCase, ['str'])
  factory.add('str-toLower', lowerCase, ['str'])
  factory.add('split', split, ['str'])

  factory.provideTo('str-toUpper', {'str': 'name'})
  factory.provideTo('split', {'str': 'str-toUpper'})

  factory.newBuilder(['split'])
  .build({name: 'Jeremy Stanley'}, function (err, data) {
    try {
      assert.deepEqual(data.split, ['JEREMY', 'STANLEY'])
    } catch (e) {
      console.error(e)
    }
    next()
  })
}

/**
 * Test remapping the inputs of a node with a new deps array
 *
 * @param {Function} next
 */
function testRemapArray(next) {
  console.log("testing remap array")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add('str-toUpper', upperCase, ['str'])
  factory.add('str-toLower', lowerCase, ['str'])
  factory.add('split', split, ['str'])

  factory.provideTo('str-toLower', ['name'])
  factory.provideTo('split', ['str-toLower'])

  factory.newBuilder(['split'])
  .build({name: 'Jeremy Stanley'}, function (err, data) {
    try {
      assert.deepEqual(data.split, ['jeremy', 'stanley'])
    } catch (e) {
      console.error(e)
    }
    next()
  })
}

/**
 * Test the builder with methods that return synchronously (usePromises() supports synchronous returns)
 */
function testSynchronous(next) {
  console.log("testing synchronous")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add("currentUser", getCurrentUser, ["req"])
  factory.add("millisNow", getMillisNow)
  factory.add("secondsNow", getSecondsNow, ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", createUserSalt, ["currentUser.username", "delimiter", "secondsNow"])
  .add('username', function (username){return username}, ['req.currentUser.username'])
  testFactory(factory, [null, {username: request.currentUser.username, userSalt: expectedSalt}], next)
}

/**
 * Test the builder with methods that expect to return via a node-style callback (function(err, response))
 * as the last argument
 */
function testCallbacks(next) {
  console.log("testing callbacks")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add("currentUser", withCallback(getCurrentUser), ["req"])
  factory.add("millisNow", withCallback(getMillisNow))
  factory.add("secondsNow", withCallback(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", withCallback(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  .add('username', function (username){return username}, ['req.currentUser.username'])
  testFactory(factory, [null, {username: request.currentUser.username, userSalt: expectedSalt}], next)
}

/**
 * Test the builder with methods that expect to return via promises
 */
function testPromises(next) {
  console.log("testing promises")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add("currentUser", withPromise(getCurrentUser), ["req"])
  factory.add("millisNow", withPromise(getMillisNow))
  factory.add("secondsNow", withPromise(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", withPromise(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  .add('username', function (username){return username}, ['req.currentUser.username'])
  testFactory(factory, [null, {username: request.currentUser.username, userSalt: expectedSalt}], next)
}

/**
 * Test throwing errors through a callback
 */
function testThrowCallback(next) {
  console.log("testing throwing through callbacks")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add("currentUser", withCallback(getCurrentUser), ["req"])
  factory.add("millisNow", withCallback(getMillisNow))
  factory.add("secondsNow", withCallback(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", throwCallback(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  .add('username', function (username){return username}, ['req.currentUser.username'])
  testFactory(factory, [new Error("I'm done here"), null], next)
}

/**
 * Test throwing errors synchronously
 */
function testThrowSynchronouslyCallback(next) {
  console.log("testing throwing synchronously through callbacks")
  var factory = new asyncBuilder.BuilderFactory()
  factory.add("currentUser", withCallback(getCurrentUser), ["req"])
  factory.add("millisNow", withCallback(getMillisNow))
  factory.add("secondsNow", withCallback(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", throwSynchronously(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  .add('username', function (username){return username}, ['req.currentUser.username'])
  testFactory(factory, [new Error("I'm done here"), null], next)
}

/**
 * Take a specified factory and create a builder to create userSalt
 */
function testFactory(factory, expectedOutput, next) {
  // create and run the builder
  var builder = factory.newBuilder(["userSalt", "username"])
  builder.build({req: request, d1: '<', d2: '-', d3: '>'}, function (err, data) {
    try {
      assert.deepEqual(Array.prototype.slice.call(arguments, 0), expectedOutput)
    } catch (e) {
      console.log(e)
    }
    if (next) next()
  })
}

/**
 * Wrap a function in a callback handler
 */
function withCallback(fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments, 0)
    var next = args.pop()
    next(null, fn.apply(null, args))
  }
}

/**
 * Wrap a function in a callback that expects a promise
 */
function withPromise(fn) {
  return function () {
    var d = q.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    process.nextTick(function () {
      d.resolve(fn.apply(null, args))
    })
    return d.promise
  }
}

/**
 * Throw an error synchronously
 */
function throwSynchronously(fn) {
  return function() {
    throw new Error("I'm done here")
  }
}

/**
 * Throw an error through a callback
 */
 function throwCallback(fn) {
  return function() {
    var args = Array.prototype.slice.call(arguments, 0)
    var next = args.pop()
    next(new Error("I'm done here"))
  }
}

/**
 * Throw an error through a promise
 */
 function throwPromise(fn) {
  return function () {
    var d = q.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    process.nextTick(function () {
      d.reject(new Error("I'm done here"))
    })
    return d.promise
  }
 }

/**
 * Retrieve the current user from the request object synchronously
 */
function getCurrentUser(req) {
  return req.currentUser
}

//save millis off to a variable so that our asserts don't accidentally cross the second boundary
var millis

/**
 * Get the current time in milliseconds synchronously
 */
function getMillisNow() {
  if (!millis) millis = Date.now()
  return millis
}

/**
 * Get the current time in seconds and return synchronously
 */
function getSecondsNow(millis) {
  return Math.floor(millis/1000)
}

/**
 * Create a user salt and return synchronously
 */
function createUserSalt(username, delimiter, millis) {
  return username + delimiter + millis
}