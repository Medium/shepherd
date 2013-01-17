// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for NodeDefinition which
 *     represents a node that has been added to a Graph instance and any
 *     dependencies it might have.
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var utils = require('./utils')
var clone = utils.clone

/**
 * A node to be added to a graph which defines a handler for a given
 * unit of work which takes in specific inputs
 *
 * @param {Graph} graph the graph to add the node to
 * @param {string} name the name of the node to be added
 * @constructor
 */
function NodeDefinition(graph, name) {
  this._description = null
  this._graph = graph
  this._name = name
  this._inputArgs = []
  this._inputNames = []
  this._args = []
  this._builds = []
  this._modifiers = []
  this._cacheDisabled = false
  this._fn = null
}

/**
 * Update the name of this node
 *
 * @param {string} name
 */
NodeDefinition.prototype.setName = function (name) {
  this._name = name
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
  def._inputArgs = this._inputArgs
  def._args = clone(this._args)
  def._builds = clone(this._builds)
  def._buildRefs = clone(this._buildRefs)
  def._modifiers = clone(this._modifiers)
  def._fn = this._fn
  return def
}

/**
 * Specify that this node should never be cached in a builder context
 *
 * @return {NodeDefinition} returns the current NodeDefinition instance
 */
NodeDefinition.prototype.disableCache = function () {
  this._cacheDisabled = true
  return this
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
 * Set the description for this node
 *
 * @param {string} description
 * @return {NodeDefinition} returns the current NodeDefinition instance
 */
NodeDefinition.prototype.description = function (description) {
  this._description = description
  return this
}

/**
 * Get the description for this node
 *
 * @return {string} returns the description for this node
 */
NodeDefinition.prototype.getDescription = function () {
  return this._description
}

/**
 * Get the handler function for this node
 *
 * @return {function}
 */
NodeDefinition.prototype.getFunction = function () {
  return this._fn
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
    this._inputArgs.push(utils.getNodeRootName(arguments[i]))
    this._inputNames.push(arguments[i])
  }
  return this
}

NodeDefinition.prototype.getInputNames = function () {
  return this._inputNames
}

NodeDefinition.prototype.configure = function (field) {
  return this.builds('?' + field)
}

NodeDefinition.prototype.builds = function (field) {
  var nodeInfo = utils.getNodeInfoFromBuild(this._graph, field)

  this._builds.push({
    field: field,
    provides: [],
    modifiers: []
  })
  this._args.push(field)
  return this
}

NodeDefinition.prototype.using = function (var_args) {
  var nodeIdx = this._builds.length - 1
  for (var i = 0; i < arguments.length; i++) {
    this._builds[nodeIdx].provides.push(arguments[i])
  }
  return this
}

NodeDefinition.prototype._getNode = function (alias) {
  for (var i = 0; i < this._builds.length; i++) {
    var nodeInfo = utils.getNodeInfoFromBuild(this._graph, this._builds[i].field)
    if (nodeInfo.aliasRealName == alias) return this._builds[i]
  }

  return null
}

NodeDefinition.prototype._getArgIdx = function (alias) {
  for (var i = 0; i < this._args.length; i++) {
    var nodeInfo = utils.getNodeInfoFromBuild(this._graph, this._args[i])
    if (nodeInfo.alias == alias) return i
  }

  return -1
}

NodeDefinition.prototype.modifiers = function (var_args) {
  var name = this._name

  for (var i = 0; i < arguments.length; i += 1) {
    if (this._builds.length) {
      // create a new last field which pulls from the previous last
      var previousField = this._builds[this._builds.length - 1]

      // find a safe name to move this node to
      var nodeInfo = utils.getNodeInfoFromBuild(this._graph, previousField.field)
      var nodeName
      var j = 0
      do {
        j++
        nodeName = utils.generateModifierNodeName(nodeInfo.alias, j)
      } while (this._getNode(nodeName))

      // find the existing arg info
      var argIdx = this._getArgIdx(nodeInfo.alias)

      // rename the node
      var newNodeInfo = {}
      newNodeInfo[nodeName] = nodeInfo.fullName
      previousField.field = newNodeInfo
      this._args[argIdx] = newNodeInfo

      // retrieve the modifier info
      var modifierNodeInfo = utils.getNodeInfoFromModifier(this._graph, arguments[i], nodeInfo.alias)

      // create a new field or clone the already configured field
      var fieldData = {}
      fieldData[nodeInfo.alias] = modifierNodeInfo.nodeName
      var modifierNode = this._getNode(modifierNodeInfo.nodeName)

      if (modifierNode) {
        // clone the existing node
        this._builds.push(clone(modifierNode))
        this._builds[this._builds.length - 1].field = fieldData
      } else {
        // create a new node
        this.builds(fieldData)
        this._args.pop()
      }
      this._args.push(fieldData)


      // map the old node to the new node
      var usingData = {}
      usingData[modifierNodeInfo.arg] = nodeName
      this.using(usingData)
    } else {
      this._graph._addModifier(name, arguments[i])
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
 * Proxy function which can be used to chain newBuilder() requests back
 * to the graph
 */
NodeDefinition.prototype.newBuilder = function () {
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