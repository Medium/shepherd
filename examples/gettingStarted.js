// Copyright 2012 The Obvious Corporation.
var shepherd = require('../lib/shepherd')

// To get started with **shepherd**, you need to create a `Graph`.
// A `Graph` is a registry of all of the things you want to be able to do (units of work).
// First, instantiate the Graph:
var graph = new shepherd.Graph()

// Next, you need to add some nodes to the `Graph` which perform said units of work.
// Let's add 2 nodes to the Graph:

// create a node which returns the current timestamp in millis
graph.add('timestamp-nowMillis', Date.now)

// create a node which will uppercase a string
function toUpper(str) {
  return str.toUpperCase()
}
graph.add('str-toUpper', toUpper, ['str'])

// Now that you have a `Graph` of things that can be done,
// you need to create a `Builder` which will connect those different pieces together to produce a desired result.
// In this case we'll create a `Builder` which will uppercase an input string and return the current timestamp in millis:
var builder = graph.newBuilder()
  .builds('str-toUpper')
  .builds('timestamp-nowMillis')

// Finally, you can run the `Builder` with a given set of inputs and it will optimally run through the units of work:
builder.run({str: "Hello"}, function (err, data) {
  // data['str-toUpper'] should be HELLO
  // data['timestamp-nowMillis'] should be the current timestamp in millis
  console.log(data)
})