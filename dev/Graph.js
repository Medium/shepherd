var Builder = require('./Builder')
var NodeDefinition = require('./NodeDefinition')

function Graph() {
  this._nodeDefinitions = {}
  this._anonymousFnCounter = 0
}

function literal(val) {
  return val
}

Graph.prototype.literal = function (val) {
  return literal.bind(val)
}

Graph.prototype.addAnonymous = function (nameHint, fn) {
  var name = nameHint.replace(/[^\w\d\-]+/g, '') + "-anonFn" + (++this._anonymousFnCounter)
  return name
}

Graph.prototype.add = function (name, fn, deps) {
  var node = this._nodeDefinitions[name] = new NodeDefinition(this, name)
  if (fn) node.func(fn)
  if (deps) node.args.apply(node, deps)
  return node
}

Graph.prototype.clone = function () {
  return this
}

Graph.prototype.newAsyncBuilder = function () {
  return new Builder(this)
}

module.exports = Graph