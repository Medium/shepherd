// Copyright 2013 The Obvious Corporation.

var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)
var shepherd = require ('../lib/shepherd')
var graph

var order

exports.setUp = function (done) {
  graph = new shepherd.Graph

  order = []

  graph.add('num', function (n) {
    order.push(n)
    return n
  }, ['n'])

  graph.add('add', function (a, b) {
    order.push('add(' + a + ',' + b + ')')
    return a + b
  }, ['a', 'b'])

  graph.add('one').builds('num').using({n: 1})
  graph.add('two').builds('num').using({n: 2})
  graph.add('three').builds('add').using({a: 'one'}, {b: 'two'})

  done()
}

builder.add(function testLazyNode(test) {
  graph.addLazy('threeLazy').builds('three')

  return graph.newBuilder()
      .builds('threeLazy')
      .run()
      .then(function (data) {
        test.deepEqual([], order)
        return data['threeLazy']()
      })
      .then(function (result) {
        test.equal(3, result)
        test.deepEqual([1, 2, 'add(1,2)'], order)
      })
})

builder.add(function testConditionalNode(test) {
  graph.addLazy('threeLazy').builds('three')

  graph.add('ifTrueThree', function (condition, threeLazy) {
    if (condition) {
      return threeLazy()
    } else {
      return 0
    }
  }, ['condition'])
  .builds('threeLazy')

  return graph.newBuilder()
      .builds('ifTrueThree').using({condition: true})
      .run()
      .then(function (data) {
        test.equal(3, data['ifTrueThree'])
        test.deepEqual([1, 2, 'add(1,2)'], order)
        order = []

        return graph.newBuilder()
            .builds('ifTrueThree').using({condition: false})
            .run()
      })
      .then(function (data) {
        test.equal(0, data['ifTrueThree'])
        test.deepEqual([], order)
      })
})

builder.add(function testLazyNodeWithUsing(test) {
  graph.addLazy('threeLazy')
      .builds('add').using({a: 'one'}, {b: 'two'})

  return graph.newBuilder()
      .builds('threeLazy')
      .run()
      .then(function (data) {
        test.deepEqual([], order)
        return data['threeLazy']()
      })
      .then(function (result) {
        test.equal(3, result)
        test.deepEqual([1, 2, 'add(1,2)'], order)
      })
})

builder.add(function testLazyNodeWithCompileTimeArguments(test) {
  graph.addLazy('addLazy', function (a, b) {
        order.push('add(' + a + ',' + b + ')')
        return a + b
      }, ['a', 'b'])

  return graph.newBuilder()
      .builds('addLazy').using({a: 'one'}, {b: 'two'})
      .run()
      .then(function (data) {
        test.deepEqual([1, 2], order)
        return data['addLazy']()
      })
      .then(function (result) {
        test.equal(3, result)
        test.deepEqual([1, 2, 'add(1,2)'], order)
      })
})

builder.add(function testLazyNodeWithLateBoundArguments(test) {
  graph.addLazy('addLazy')
      .args('a', 'b')
      .fn(function (a, b) {
        order.push('add(' + a + ',' + b + ')')
        return a + b
      })

  return graph.newBuilder()
      .builds('addLazy').using({a: 'one'}, {b: 'two'})
      .run()
      .then(function (data) {
        test.deepEqual([1, 2], order)
        return data['addLazy']()
      })
      .then(function (result) {
        test.equal(3, result)
        test.deepEqual([1, 2, 'add(1,2)'], order)
      })
})


builder.add(function testLazyNodeWithDiamondDependencies(test) {
  graph.addLazy('threeLazy').builds('three')

  graph.add('six')
    .builds('threeLazy')
    .builds('one')
    .builds('two')
    .fn(function (threeLazy, one, two) {
      test.deepEqual([1, 2], order)
      return threeLazy().then(function (three) {
        test.deepEqual([1, 2, 'add(1,2)'], order)
        return three + two + one
      })
    })

  return graph.newBuilder()
      .builds('six')
      .run()
      .then(function (data) {
        test.equal(6, data['six'])
      })
})
