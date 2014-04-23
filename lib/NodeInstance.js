// Copyright 2013 The Obvious Corporation.
/**
 * @fileoverview Contains the class definition for NodeInstance which represents
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
 * @param {./Builder} builder the builder that the node instance is for
 * @param {./Graph} graph the graph to add the node to
 * @param {string} name the name of the node to be added
 * @constructor
 * @extends {NodeDefinition}
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

/** @override */
NodeInstance.prototype.builds = function (name) {
  var nodeInfo = utils.getNodeInfoFromBuild(this.getGraph(), name)
  if (!nodeInfo.isImportant() && !nodeInfo.isVoid() && !nodeInfo.isPartial()) {
    var outputNodeInfo = nodeInfo.getOutputNodeInfo(this.getGraph())
    if (this._outputFieldNames.indexOf(outputNodeInfo.fullName) === -1) {
      this._outputFieldNames.push(outputNodeInfo.fullName)
    }
  }
  return NodeDefinition.prototype.builds.apply(this, arguments)
}

/**
 * Proxy function which can be used to chain compile() requests back
 * to the builder
 */
NodeInstance.prototype.compile = function () {
  return this._builder.compile.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain compile() requests back
 * to the builder
 */
NodeInstance.prototype.setCompileInputs = function () {
  return this._builder.setCompileInputs.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain run() requests back
 * to the builder
 */
NodeInstance.prototype.run = function () {
  return this._builder.run.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain createInjector() requests back
 * to the builder
 */
NodeInstance.prototype.createInjector = function () {
  return this._builder.createInjector.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain mapOutputKeysToArgs() requests back
 * to the builder
 */
NodeInstance.prototype.mapOutputKeysToArgs = function () {
  return this._builder.mapOutputKeysToArgs.apply(this._builder, arguments)
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
