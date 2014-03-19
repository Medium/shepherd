// Copyright 2012 The Obvious Corporation.
/**
 * @fileoverview Contains the class definition for DependencyManager which
 *     maintains a mapping of dependencies between nodes in a peer group
 *     (as created by Builder#_compilePeers). This is primarily used for
 *     determining the order that nodes should be instantiated when
 *     creating multiple nodes within a group.
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var utils = require('./utils')

/**
 * Create an object which tracks relationships of dependencies between nodes
 *
 * @param {./Graph} graph an instance of Graph which contains the NodeDefinition
 *     instances to use
 * @constructor
 */
function DependencyManager(graph) {
  this._graph = graph
  this._nodeNames = {}
  this._deps = {}
}

/**
 * Return a list of node aliases that have been provided to this dependency
 * manager
 *
 * @return {Array.<string>} node names
 */
DependencyManager.prototype.getAliases = function () {
  return Object.keys(this._deps)
}

/**
 * Return a list of dependencies for a node alias
 *
 * @param {string} alias
 * @return {Array.<string>} a list of dependent node names
 */
DependencyManager.prototype.getDependencies = function (alias) {
  return Object.keys(this._deps[alias])
}

/**
 * Return the actual node name that an aliased node points to
 *
 * @param {string} alias
 * @return {string} the actual node name
 */
DependencyManager.prototype.getNodeName = function (alias) {
  return this._nodeNames[alias] || alias
}

/**
 * Specify that a node should be built and added to the list of nodes
 *
 * @param {string|Object} node a node name or alias to node mapping
 * @return {Object} an Object containing the node arg and nodeName
 *     as provided by utils.getNodeInfoFromBuild
 */
DependencyManager.prototype.addNode = function (node) {
  var nodeObj = utils.getNodeInfoFromBuild(this._graph, node)

  var alias = nodeObj.getAlias()
  if (!this._deps[alias]) {
    this._deps[alias] = {}
    this._nodeNames[alias] = nodeObj.rootName
  }

  return nodeObj
}

/**
 * Specify that a node should have another node as its dependency
 *
 * @param {string|Object} node a node name or alias to node mapping
 * @param {string|Object} depNode another node name or alias to node
 *     mapping which should be a dependency of the first node
 */
DependencyManager.prototype.addDependency = function (node, depNode) {
  var nodeObj = this.addNode(node)
  var depNodeObj = utils.getNodeInfoFromBuild(this._graph, depNode)
  var depAlias = depNodeObj.getAlias()

  if (!this._deps[depAlias]) this._deps[depAlias] = {}

  this._deps[nodeObj.getAlias()][depAlias] = true
}

module.exports = DependencyManager
