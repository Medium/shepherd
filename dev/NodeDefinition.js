var crypto = require('crypto')

function NodeDefinition(graph, name) {
  this._graph = graph
  this._name = name
  this._args = []
  this._builds = []
  this._modifiers = []
  this._fn = null
}

NodeDefinition.prototype.getModifiers = function () {
  return this._modifiers
}

NodeDefinition.prototype.getFunction = function () {
  return this._fn
}

NodeDefinition.prototype.getArgs = function () {
  return this._args
}

NodeDefinition.prototype.getBuilds = function () {
  return this._builds
}

NodeDefinition.prototype.args = function (var_args) {
  for (var i = 0; i < arguments.length; i += 1) {
    this._args.push(arguments[i])
  }
  return this
}

NodeDefinition.prototype.after = function (var_args) {
  for (var i = 0; i < arguments.length; i += 1) {
    this._args.push('!' + arguments[i])
  }
  return this
}

NodeDefinition.prototype.build = function (field) {
  this._builds.push({
    field: field,
    provides: []
  })
  this._args.push(field)
  return this
}

NodeDefinition.prototype.using = function (var_args) {
  this._builds[this._builds.length - 1].provides = Array.prototype.slice.call(arguments, 0)
  return this
}

NodeDefinition.prototype.modifiers = function (var_args) {
  this._modifiers = Array.prototype.slice.call(arguments, 0)
  return this
}

NodeDefinition.prototype.func = function (fn) {
  this._fn = fn
  return this
}

NodeDefinition.prototype.getHash = function () {
  // create a hash from all of the args and this NodeDefinition's name
  var md5sum = crypto.createHash('md5')
  md5sum.update(this._name)
  for (var i = 0; i < this._args.length; i += 1) {
    md5sum.update(this._args[i])
  }
  return md5sum.digest('hex')
}

module.exports = NodeDefinition