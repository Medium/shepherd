var clone = require ('./clone')

/**
 * A node to be added to a graph which defines a handler for a given
 * unit of work which takes in specific inputs
 *
 * @param {Graph} graph the graph to add the node to
 * @param {string} name the name of the node to be added
 * @constructor
 */
function NodeDefinition(graph, name) {
  this._graph = graph
  this._name = name
  this._args = []
  this._builds = []
  this._modifiers = []
  this._fn = null
}

/**
 * Create a copy of this node and attach it to a specified graph
 *
 * @param {Graph} graph the graph to add the new node to
 * @return {NodeDefinition} the cloned node
 */
NodeDefinition.prototype.clone = function (graph) {
  var def = new NodeDefinition(graph, this._name)
  def._name = this._name
  def._args = clone(this._args)
  def._builds = clone(this._builds)
  def._modifiers = clone(this._modifiers)
  def._fn = this._fn
  return def
}

/**
 * Overwrite an input into this node by changing the node it points to
 *
 * @param {key} the current node
 * @param {val} the new node to point to
 */
NodeDefinition.prototype.overwriteArg = function (key, val) {
  for (var i = 0; i < this._args.length; i += 1) {
    if (this._args[i] == key) {
      this._args[i] = val
      return
    }
  }
  this._args.push(val)
}

/**
 * Define any inputs into this node (may be either explicit inputs with
 * no existing node defined *or* nodes with 0 dependencies)
 *
 * @param {string} var_args a variable number of arguments, each of which
 *     is a string representing a node name which represents a node with 0
 *     arguments or the name of a value that should be passed in by the caller
 * @return {NodeDefinition} returns the current NodeDefinition instance
 */
NodeDefinition.prototype.args = function (var_args) {
  for (var i = 0; i < arguments.length; i += 1) {
    this._args.push(arguments[i])
  }
  return this
}

NodeDefinition.prototype.builds = function (field) {
  this._builds.push({
    field: field,
    provides: [],
    modifiers: []
  })
  this._args.push(field)
  return this
}

NodeDefinition.prototype.using = function (var_args) {
  this._builds[this._builds.length - 1].provides = Array.prototype.slice.call(arguments, 0)
  return this
}

NodeDefinition.prototype.modifiers = function (var_args) {
  for (var i = 0; i < arguments.length; i += 1) {
    if (this._builds.length) {
      this._builds[this._builds.length - 1].modifiers.push(arguments[i])
    } else {
      this._modifiers.push(arguments[i])
    }
  }
  return this
}

/**
 * Set the handler function for this node
 *
 */
NodeDefinition.prototype.fn = function (fn) {
  this._fn = fn
  return this
}

/**
 * Proxy function which can be used to chain newAsyncBuilder() requests back
 * to the graph
 */
NodeDefinition.prototype.newAsyncBuilder = function () {
  return this._graph.newBuilder.apply(this._graph, arguments)
}

/**
 * Proxy function which can be used to chain newBuilder() requests back
 * to the graph
 */
NodeDefinition.prototype.newBuilder = function () {
  return this._graph.newBuilder.apply(this._graph, arguments)
}

/**
 * Proxy function which can be used to chain add() requests back
 * to the graph
 */
NodeDefinition.prototype.add = function () {
  return this._graph.add.apply(this._graph, arguments)
}

/**
 * Proxy function to the graph which can be used to chain provideTo() requests back
 * to the graph
 */
NodeDefinition.prototype.provideTo = function () {
  return this._graph.provideTo.apply(this._graph, arguments)
}

module.exports = NodeDefinition