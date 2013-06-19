// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var shepherd = require ('../lib/shepherd')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

var logBuffer = []
var oldLog = null

var globalThis = this
exports.setUp = function (done) {
  this.graph = new shepherd.Graph

  logBuffer.length = 0
  if (oldLog == null) {
    oldLog = console.log
    console.log = function (msg) {
      logBuffer.push(msg)
      oldLog.apply(console, arguments)
    }
  }

  done()
}

exports.tearDown = function (done) {
  console.log = oldLog
  oldLog = null
  done()
}

builder.add(function testResolveDebug(test) {
  var graph = this.graph
  var echo = function (input) { return graph.newTracer(input) }
  graph.add('echo', echo, ['input'])
  return this.graph.newBuilder('x')
    .builds('echo').using({'input': graph.literal(1)})
    .run({})
    .then(function (data) {
      test.equal(3, logBuffer.length)
      test.equal(
        '[Trace x] Resolved "echo-peerGroup1" <- [object Object]', logBuffer[0])
      test.equal(
        '[Trace x] Injecting "echo-peerGroup1" -> "builderOutput-x_1"', logBuffer[1])
      test.equal(
        '[Trace x] Resolved "builderOutput-x_1" <- [object Object]', logBuffer[2])
    })
})

builder.add(function testResolveDebugDepth0(test) {
  var graph = this.graph
  var echo = function (input) { return graph.newTracer(input, 0) }
  graph.add('echo', echo, ['input'])
  return this.graph.newBuilder('x')
    .builds('echo').using({'input': graph.literal(1)})
    .run({})
    .then(function (data) {
      test.equal(2, logBuffer.length)
      test.equal(
        '[Trace x] Resolved "echo-peerGroup1" <- [object Object]', logBuffer[0])
      test.equal(
        '[Trace x] Injecting "echo-peerGroup1" -> "builderOutput-x_1"', logBuffer[1])
    })
})
