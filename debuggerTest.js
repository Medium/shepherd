var shepherd = require('./lib/shepherd')
var graph = new shepherd.Graph()
var dbg = new shepherd.Debugger(4812).start()
var Q = require('kew')

graph.add('bool-true', graph.literal(true))
graph.add('bool-false', graph.literal(false))
graph.add('bool-timeout', function () {
  return Q.defer()
})

graph.add('bool-takesInput', function (myBool) {
  return myBool
}, ['bool'])

graph.add('throws-ifFalse', function (myBool) {
  if (!myBool) throw new Error("NOOOO")
  return myBool
}, ['bool', 'user'])

graph.add('throws-withFalse', graph.subgraph)
  .builds('bool-false')
  .builds('throws-ifFalse')
    .using('bool-false', {user: graph.literal({userId: '123', name: 'Jeremy'})})

var builder1 = graph.newBuilder()
  .builds('throws-withFalse')
  .setDebugger(dbg)
  .compile([])

var builder2 = graph.newBuilder()
  .builds('bool-timeout')
  .setDebugger(dbg)
  .compile([])

builder1.run()
builder2.run()