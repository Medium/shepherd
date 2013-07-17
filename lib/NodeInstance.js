// Copyright 2013 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for NodeInstance which represents
 *     a node that is being built within a Builder and any dependencies that the
 *     node might have
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */
var utils = require('./utils')

var NodeDefinition = require('./NodeDefinition')

/**
 * A node to be added to a graph which defines a handler for a given
 * unit of work which takes in specific inputs. Also exists within
 * the context of a specific Builder. This is currently only used
 * for the outputs of Builders.
 *
 * @param {Builder} builder the builder that the node instance is for
 * @param {Graph} graph the graph to add the node to
 * @param {string} name the name of the node to be added
 * @constructor
 */
function NodeInstance(builder, graph, name) {
  NodeDefinition.call(this, graph, name)
  this._builder = builder
  this._outputFieldNames = []
}
require('util').inherits(NodeInstance, NodeDefinition)

/**
 * Retrieve the list of all outputs (in their appropriate order)
 * for this node
 *
 * @return {Array.<string>}
 */
NodeInstance.prototype.getOutputNodeNames = function () {
  return this._outputFieldNames
}

/**
 * Specify that this node should build another node as an input
 *
 * @param {string} field the node to build
 * @return {NodeDefinition} the current node
 */
NodeInstance.prototype.builds = function (name) {
  var nodeInfo = utils.getNodeInfoFromBuild(this.getGraph(), name)
  if (utils.isPrivateNode(name)) throw new Error("Builders may not build silent nodes")
  if (!this.isConditional() && !nodeInfo.isVoid()) {
    var outputNodeInfo = nodeInfo.getOutputNodeInfo(this.getGraph())
    if (this._outputFieldNames.indexOf(outputNodeInfo.fullName) === -1) {
      this._outputFieldNames.push(outputNodeInfo.fullName)
    }
  }
  return NodeDefinition.prototype.builds.apply(this, arguments)
}

/**
 * Specify that a node to be built should take in a list of inputs
 *
 * @param {Object|string} var_args a variable number of arguments
 *     which are either node names or a map of arg name to node name
 * @return {NodeDefinition} the current node
 */
NodeInstance.prototype.using = function (var_args) {
  var nodeIdx = this._builds.length - 1
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i]

    var nodeInfo = utils.getNodeInfoFromInput(this._graph, arg)
    var nodeNames = nodeInfo.nodeName

    if (!Array.isArray(nodeNames)) {
      if (utils.isPrivateNode(nodeNames)) throw new Error("Private nodes may not be called from builders")
    }
  }

  return NodeDefinition.prototype.using.apply(this, arguments)
}

/**
 * Proxy function which can be used to chain compile() requests back
 * to the builder
 */
NodeInstance.prototype.compile = function () {
  this.ensureLastConditionalClosed()
  return this._builder.compile.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain run() requests back
 * to the builder
 */
NodeInstance.prototype.run = function () {
  this.ensureLastConditionalClosed()
  return this._builder.run.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain getCompiledNodes() requests back
 * to the builder
 */
NodeInstance.prototype.getCompiledNodes = function () {
  return this._builder.getCompiledNodes.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain getDotGraph() requests back
 * to the builder
 */
NodeInstance.prototype.getDotGraph = function () {
  return this._builder.getDotGraph.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain preRun() requests back
 * to the builder
 */
NodeInstance.prototype.preRun = function () {
  return this._builder.preRun.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain postRun() requests back
 * to the builder
 */
NodeInstance.prototype.postRun = function () {
  return this._builder.postRun.apply(this._builder, arguments)
}

module.exports = NodeInstance
