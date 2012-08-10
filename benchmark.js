var asyncBuilder = require("./lib/asyncBuilder")
var microtime = require('microtime')

var nodeA = function (next) {
  next(null, {'a': 'a'})
}

var nodeB = function (next) {
  next(null, 'b')
}

var nodeC = function (next) {
  next(null, 'c')
}

var factory = new asyncBuilder.BuilderFactory()
factory.add("a", nodeA)
factory.add("b", nodeB)
factory.add("c", nodeC)

var builder = factory.newBuilder('a.a', 'b', 'c')
builder.configure({
  validateDependencies: false
})

var start = Date.now()
builder.build({}, function (err, data) {
  console.log("Completed in", Date.now() - start, arguments)
})
.end()