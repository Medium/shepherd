function NodeInstance(builder, nodeDefinition) {
  this._builder = builder
  this._nodeDefinition = nodeDefinition
  this._inputs = []
  this._modifiers = []
}

NodeInstance.prototype.getDefinition = function () {
  return this._nodeDefinition
}

NodeInstance.prototype.getInputs = function () {
  return this._inputs
}

NodeInstance.prototype.using = function (var_args) {
  this._inputs = Array.prototype.slice.call(arguments, 0)
  return this
}

NodeInstance.prototype.modifiers = function (var_args) {
  this._modifiers = Array.prototype.slice.call(arguments, 0)
  return this
}

NodeInstance.prototype.outputs = function () {
  return this._builder.outputs.apply(this._builder, arguments)
}

NodeInstance.prototype.build = function () {
  return this._builder.build.apply(this._builder, arguments)
}

module.exports = NodeInstance