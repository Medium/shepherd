var utils = require('./utils')

/**
 * Create an object which tracks relationships of dependencies between nodes
 *
 * @param {Graph} graph an instance of Graph which contains the NodeDefinition
 *     instances to use
 * @constructor
 */
function DependencyManager(graph) {
  this._graph = graph
  this._nodeNames = {}
  this._deps = {}
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

  if (!this._deps[nodeObj.alias]) {
    this._deps[nodeObj.alias] = {}
    this._nodeNames[nodeObj.alias] = nodeObj.rootName
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

  if (!this._deps[depNodeObj.alias]) this._deps[depNodeObj.alias] = {}

  this._deps[nodeObj.alias][depNodeObj.alias] = true
}

module.exports = DependencyManager