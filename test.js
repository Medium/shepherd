var asyncBuilder = require("./asyncBuilder")
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
    testSynchronous
  , testGetters
  , testCallbacks
  , testPromises
  , testPromisesAndGetters
  , testThrowCallback
  , testThrowSynchronouslyCallback
  , testThrowPromises
  , testThrowSynchronouslyPromises
]
function runNextTest() {
  if (testMethods.length) {
    testMethod = testMethods.shift()
    testMethod(runNextTest)
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
  var delimiter = singleDelimiter
  var joiner = joinDelimiters

  if (factory.wrapsInputs) {
    delimiter = withGetters(delimiter)
    joiner = withGetters(joiner)
  }

  if (!factory.usesPromises) {
    delimiter = withCallback(delimiter)
    joiner = withCallback(joiner)
  }

  var graph = factory.newGraph('firstDelimiter', 'secondDelimiter', 'thirdDelimiter')
  graph.add("delimiter1", delimiter, ['firstDelimiter'])
  graph.add("delimiter2", delimiter, ['secondDelimiter'])
  graph.add("delimiter3", delimiter, ['thirdDelimiter'])
  graph.add("finalDelimiter", joiner, ["delimiter1", "delimiter2", "delimiter3"])
  return graph.given("finalDelimiter").then(function (finalDelimiter) {
    return factory.wrapsInputs ? finalDelimiter.get() : finalDelimiter
  })
}

/**
 * Test the builder with methods that return synchronously (usePromises() supports synchronous returns)
 */
function testSynchronous(next) {
  console.log("testing synchronous")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.add("currentUser", getCurrentUser, ["req"])
  factory.add("millisNow", getMillisNow)
  factory.add("secondsNow", getSecondsNow, ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", createUserSalt, ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: expectedSalt}], next)
}

/**
 * Test the builder with methods that return synchronously and expect arguments in the form of objects
 * with a get() method
 */
function testGetters(next) {
  console.log("testing getters")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.wrapInputs()
  factory.add("currentUser", withGetters(getCurrentUser), ["req"])
  factory.add("millisNow", withGetters(getMillisNow))
  factory.add("secondsNow", withGetters(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", withGetters(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: new BuilderResponse(expectedSalt)}], next)
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
  testFactory(factory, [null, {userSalt: expectedSalt}], next)
}

/**
 * Test the builder with methods that expect to return via promises
 */
function testPromises(next) {
  console.log("testing promises")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.add("currentUser", withPromise(getCurrentUser), ["req"])
  factory.add("millisNow", withPromise(getMillisNow))
  factory.add("secondsNow", withPromise(getSecondsNow), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", withPromise(createUserSalt), ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: expectedSalt}], next)
}

/**
 * Test the builder with promises & and getters
 */
function testPromisesAndGetters(next) {
  console.log("testing promises and getters")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.wrapInputs()
  factory.add("currentUser", withPromise(withGetters(getCurrentUser)), ["req"])
  factory.add("millisNow", withPromise(withGetters(getMillisNow)))
  factory.add("secondsNow", withPromise(withGetters(getSecondsNow)), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", withPromise(withGetters(createUserSalt)), ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: new BuilderResponse(expectedSalt)}], next)
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
  testFactory(factory, [new Error("I'm done here"), null], next)
}

/**
 * Test throwing errors through a promise
 */
 function testThrowPromises(next) {
  console.log("testing throwing through promises")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.wrapInputs()
  factory.add("currentUser", withPromise(withGetters(getCurrentUser)), ["req"])
  factory.add("millisNow", withPromise(withGetters(getMillisNow)))
  factory.add("secondsNow", withPromise(withGetters(getSecondsNow)), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", throwPromise(withGetters(createUserSalt)), ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: new BuilderResponse(null, new Error("I'm done here"))}], next)
}

/**
 * Test throwing errors through a promise
 */
 function testThrowSynchronouslyPromises(next) {
  console.log("testing throwing synchronously through promises")
  var factory = new asyncBuilder.BuilderFactory()
  factory.usePromises()
  factory.wrapInputs()
  factory.add("currentUser", withPromise(withGetters(getCurrentUser)), ["req"])
  factory.add("millisNow", withPromise(withGetters(getMillisNow)))
  factory.add("secondsNow", withPromise(withGetters(getSecondsNow)), ["millisNow"])
  factory.add("delimiter", createDelimiter(factory), ['d1', 'd2', 'd3'])
  factory.add("userSalt", throwSynchronously(withGetters(createUserSalt)), ["currentUser.username", "delimiter", "secondsNow"])
  testFactory(factory, [null, {userSalt: new BuilderResponse(null, new Error("I'm done here"))}], next)
}

/**
 * Take a specified factory and create a builder to create userSalt
 */
function testFactory(factory, expectedOutput, next) {
  // create and run the builder
  var builder = factory.newBuilder(["userSalt"])
  builder.build({req: request, d1: '<', d2: '-', d3: '>'}, function (err, data) {
    try {
      assert.deepEqual(Array.prototype.slice.call(arguments, 0), expectedOutput)
      console.log(data)
    } catch (e) {
      console.log(e)
    }
    if (next) next()
  })
}

/**
 * Wrap a function such that all of it's arguments' get() methods are called
 */
function withGetters(fn) {
  return function () {
    var args = Array.prototype.map.call(arguments, function (arg) {
      return arg.get()
    })
    return fn.apply(null, args)
  }
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