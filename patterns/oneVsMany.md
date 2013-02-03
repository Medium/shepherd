Within **Shepherd**, there is no native way to handle iterating over an array of items and running a graph node on each of them. The preferred pattern is to instead build a node which is capable of handling multiple items and then writing a wrapper node to handle the single case:

```javascript
// generic uppercase function for an array of strings
function uppercaseStrings(strs) {
  var newStrs = []
  for (var i = 0; i < strs.length; i++) {
    newStrs.push(str[i].toUpperCase())
  }
  return newStrs
}
graph.add('strs-toUppercase', uppercaseStrings, ['strs'])

// upcast the string input into an array, uppercase all elements
// then return the first element in that array
graph.add('str-toUppercase', graph.subgraph, ['str'])
  .builds('strs-toUppercase')
    .using({strs: ['args.str']})
  .returns('strs-toUppercase.0')
```

This may seem suboptimal, but **Shepherd** actually optimizes the calls to subgraph and the array upcasting to be reasonably performant.

In addition, we've found that when we write 2 separate functions, in practice, we inevitably end up having one call the other and the arguments to one of them ends up changing at some point. This leaves a busted function call if you don't change the caller as well (which is hard to know that you need to do without robust unit testing).

In the example above, the graph takes care of any missing dependencies if you change one node or the other.