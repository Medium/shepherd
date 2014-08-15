// Copyright 2014 A Medium Corporation

var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var shepherd = require ('../lib/shepherd')
var graph

exports.setUp = function (done) {
  graph = new shepherd.Graph
  done()
}

builder.add(function testCaching(test) {
  var counterSingleton = 0
  graph.add('counterSingleton').fn(function () {
    return ++counterSingleton
  })
  .cacheSingleton()

  var counter = 0
  graph.add('counter').fn(function () {
    return ++counter
  })

  var builder = graph.newBuilder()
    .builds('counter')
    .builds('counterSingleton')

  return builder.run()
  .then(function () {
    test.equal(1, counter)
    test.equal(1, counterSingleton)
    return builder.run()
  })
  .then(function () {
    test.equal(2, counter)
    test.equal(1, counterSingleton)
  })
})

builder.add(function testInputArgs(test) {
  var counterSingleton = 0
  graph.add('counterSingleton').builds('input').fn(function () {
    return ++counterSingleton
  })
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('counterSingleton')

  return builder.run({'input': 1})
  .then(function () {
    test.fail('expected error')
  })
  .fail(function (err) {
    test.equal('Singleton node "counterSingleton" may not depend on runtime input "input"', err.message)
  })
})

builder.add(function testBadDependencies(test) {
  graph.add('notSingleton').fn(function () {
    return 1
  })

  var counterSingleton = 0
  graph.add('counterSingleton').builds('notSingleton').fn(function () {
    return ++counterSingleton
  })
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('counterSingleton')

  return builder.run()
  .then(function () {
    test.fail('expected error')
  })
  .fail(function (err) {
    test.equal('Singleton node "counterSingleton" may not depend on non-singleton input "notSingleton"', err.message)
  })
})


builder.add(function testBadUsingDependencies(test) {
  graph.add('notSingleton').fn(function () {
    return 1
  })

  graph.add('isSingleton', graph.subgraph)
  .cacheSingleton()

  var counterSingleton = 0
  graph.add('counterSingleton').builds('isSingleton').using('notSingleton').fn(function () {
    return ++counterSingleton
  })
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('counterSingleton')

  return builder.run()
  .then(function () {
    test.fail('expected error')
  })
  .fail(function (err) {
    // NOTE(nick): We might have to change this to print the whole dependency chain?
    // But i'm hoping this will be enough info.
    test.equal('Singleton node "isSingleton" may not depend on non-singleton input "notSingleton"',
        err.message)
  })
})


builder.add(function testBadArguments(test) {
  graph.add('isSingleton')
  .fn(function () {
    return 1
  })
  .cacheSingleton()

  graph.add('notSingleton', graph.subgraph)
  .args('foo')
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('notSingleton')
      .using({foo: 'isSingleton'})

  return builder.run()
  .then(function () {
    test.fail('expected error')
  })
  .fail(function (err) {
    test.equal('Singleton node "notSingleton" may not have arguments', err.message)
  })
})



builder.add(function testGoodDependencies(test) {
  graph.add('isSingleton', graph.subgraph)
  .cacheSingleton()

  var counterSingleton = 0
  graph.add('counterSingleton').builds('isSingleton').fn(function () {
    return ++counterSingleton
  })
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('counterSingleton')

  return builder.run()
})


builder.add(function testGoodDependenciesProperties(test) {
  graph.add('isSingleton')
  .fn(function () {
    return {foo: {bar: 2}}
  })
  .cacheSingleton()

  graph.add('propertySingleton', graph.subgraph).builds('isSingleton.foo.bar')
  .cacheSingleton()

  var builder = graph.newBuilder()
    .builds('propertySingleton')

  return builder.run()
  .then(function (data) {
    test.equal(data['propertySingleton'], 2)
  })
})


builder.add(function testImportantNodesBlockingSingleton(test) {
  var log = []
  graph.add('counterSingleton').fn(function () {
    log.push('counterSingleton')
    return 1
  })
  .cacheSingleton()

  var counter = 0
  graph.add('counterImportant').fn(function () {
    log.push('counterImportant')
    return 1
  })

  graph.add('callBoth')
    .builds('!counterImportant')
    .builds('counterSingleton')

  return graph.newBuilder()
    .builds('!counterImportant')
    .builds('counterSingleton')
    .builds('callBoth')
  .run()
  .then(function () {
    test.deepEqual(['counterImportant', 'counterSingleton'], log)
  })
})
