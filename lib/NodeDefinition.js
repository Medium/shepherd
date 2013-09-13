// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for NodeDefinition which
 *     represents a node that has been added to a Graph instance and any
 *     dependencies it might have.
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var util = require('util')
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
  this._scope = 'default'
  this._inputArgs = []

  /** @private {Array.<utils.NodeInfo>} */
  this._args = []

  /** @private {Array.<{field: utils.NodeInfo, provides: Array.<Object|string>,
                        condition: NodeCondition=}>} */
  this._builds = []
  this._modifiers = []
  this._cacheDisabled = false
  this._fn = null
  this._hasGettersEnabled = false

  /** @private {boolean} */
  this._lazyDependency = false
}

/**
 * A condition that a built node depends on.
 * @constructor
 */
function NodeCondition(field, value) {

  /** @type {utils.NodeInfo} */
  this.field = field

  /** @type {Array.<Object|string>} */
  this.provides = []

  /**
   * The truthiness value that this will compare against.
   * @type {boolean}
   */
  this.value = value
}

/**
 * Return whether this node requires getter wrapper objects for its inputs
 *
 * @return {boolean}
 */
NodeDefinition.prototype.hasGettersEnabled = function () {
  return this._hasGettersEnabled
}

/**
 * Specify that this node requires getter wrapper objects for its inputs
 *
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.enableGetters = function () {
  this._hasGettersEnabled = true
  return this
}

/**
 * Retrieve the graph for this node
 *
 * @return {Graph}
 */
NodeDefinition.prototype.getGraph = function () {
  return this._graph
}

/**
 * Retrieve an array of arguments for this node
 *
 * @return {Array.<utils.NodeInfo>} args
 */
NodeDefinition.prototype.getArgs = function () {
  return this._args
}

/**
 * Retrieve an array of all nodes to build for this node
 *
 * @return {Array.<Object|string>} builds
 */
NodeDefinition.prototype.getBuilds = function () {
  return this._builds
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
 * Retrieve the name for this node
 *
 * @return {string}
 */
NodeDefinition.prototype.getName = function () {
  return this._name
}

/**
 * Update the call scope of this node
 *
 * @param {string} scope
 */
NodeDefinition.prototype.setScope = function (scope) {
  this._scope = scope
}

/**
 * Retrieve the call scope for this node
 *
 * @return {string}
 */
NodeDefinition.prototype.getScope = function () {
  return this._scope
}

/**
 * Create a copy of this node and attach it to a specified graph
 *
 * @param {Graph} graph the graph to add the new node to
 * @return {NodeDefinition} the cloned node
 */
NodeDefinition.prototype.clone = function (graph) {
  var def = new NodeDefinition(graph, this._name)
  def._description = this._description
  def._name = this._name
  def._scope = this._scope
  def._inputArgs = clone(this._inputArgs)
  def._args = clone(this._args)
  def._builds = clone(this._builds)
  def._modifiers = clone(this._modifiers)
  def._fn = this._fn
  def._hasGettersEnabled = this._hasGettersEnabled
  def._cacheDisabled = clone(this._cacheDisabled)

  return def
}

/**
 * Specify that this node should never be cached in a builder context
 *
 * @return {NodeDefinition} returns the current NodeDefinition instance
 */
NodeDefinition.prototype.disableNodeCache = function () {
  this._cacheDisabled = true
  return this
}

/**
 * Check whether the cache is disabled for this node
 *
 * @return {boolean}
 */
NodeDefinition.prototype.isCacheDisabled = function () {
  return this._cacheDisabled
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
  var arr = []
  arr.push.apply(arr, arguments)
  return this.argList(arr)
}

/**
 * Define any inputs into this node (may be either explicit inputs with
 * no existing node defined *or* nodes with 0 dependencies)
 *
 * @param {Array.<string>} argList
 * @return {NodeDefinition} returns the current NodeDefinition instance
 */
NodeDefinition.prototype.argList = function (argList) {
  if (!Array.isArray(argList)) throw new Error('Expected an array, got ' + argList)

  for (var i = 0; i < argList.length; i += 1) {
    var argInfo = utils.getNodeInfoFromBuild(this._graph, argList[i])
    this._args.push(argInfo)
    this._inputArgs.push(argInfo.rootName)
  }

  if (this._argumentMirrors) {
    for (i = 0; i < this._argumentMirrors.length; i++) {
      this._argumentMirrors[i].argList(argList)
    }
  }

  return this
}

/**
 * Start configuring a node for use in .modifiers()
 *
 * @param {string} field
 * @return {NodeDefinition} the current node
 */
NodeDefinition.prototype.configure = function (field) {
  if (typeof field == 'string') {
    return this.builds(utils.OUTPUT_PREFIX_PARTIAL + field)
  } else if (typeof field == 'object') {
    var keys = Object.keys(field)
    if (keys.length == 1) {
      var newField = {}
      newField[utils.OUTPUT_PREFIX_PARTIAL + keys[0]] = field[keys[0]]
      return this.builds(newField)
    }
  }
  throw new Error('Invalid configure() parameter ' + util.inspect(field))
}

/**
 * Specify that this node should build another node as an input
 *
 * @param {string} field the node to build
 * @return {NodeDefinition} the current node
 */
NodeDefinition.prototype.builds = function (field) {
  var nodeInfo = utils.getNodeInfoFromBuild(this._graph, field)
  if (this._getArgIdx(nodeInfo) !== -1) {
    throw new Error("You may only use the same alias in a .builds() once in a subgraph")
  }

  this._builds.push({
    field: nodeInfo,
    provides: []
  })

  this._args.push(nodeInfo)

  return this
}

function buildObjectFromKeysAndArguments(keys, var_args) {
  var obj = {}
  for (var i = 0; i < keys.length; i++) {
    obj[keys[i]] = arguments[i + 1]
  }
  return obj
}

/**
 * Specify that a node to be built should take in a list of inputs
 *
 * @param {...(Object|string)} var_args a variable number of arguments
 *     which are either node names or a map of arg name to node name
 * @return {NodeDefinition} the current node
 */
NodeDefinition.prototype.using = function (var_args) {
  var args = Array.prototype.slice.call(arguments, 0)
  var nodeIdx = this._builds.length - 1
  for (var i = 0; i < args.length; i++) {
    var arg = args[i]

    var nodeInfo = utils.getNodeInfoFromInput(this._graph, arg)
    var nodeNames = nodeInfo.nodeName

    if (Array.isArray(nodeNames)) {
      if (!nodeNames.length) {
        // node has an empty array for inputs
        arg[nodeInfo.arg] = this._graph.literal(nodeNames)

      } else {
        // the node has an array for inputs, build that as a separate node
        // and pass it as an input
        var wrapperArgs = []
        var wrapperUsing = []
        for (var j = 0; j < nodeNames.length; j++) {
          var argName = 'arg' + (j + 1)
          var mappingObj = {}
          mappingObj[argName] = nodeNames[j]

          wrapperArgs.push(argName)
          wrapperUsing.push(mappingObj)
        }
        var wrapperNodeName = this._graph.addAnonymous(nodeInfo.arg, this._graph.argsToArray, wrapperArgs)
        var newBuilds = this.builds(utils.OUTPUT_PREFIX_IMPORTANT + wrapperNodeName)
        newBuilds.using.apply(newBuilds, wrapperUsing)
        arg[nodeInfo.arg] = wrapperNodeName
      }

    } else if (typeof nodeNames == 'object' && nodeNames != null) {
      // the node has an object for inputs, build that as a separate node
      // and pass it as an input
      var wrapperArgs = []
      var wrapperUsing = []
      var keys = Object.keys(nodeNames)
      for (var j = 0; j < keys.length; j++) {
        var argName = 'arg' + (j + 1)
        var mappingObj = {}
        mappingObj[argName] = nodeNames[keys[j]]

        wrapperArgs.push(argName)
        wrapperUsing.push(mappingObj)
      }
      var wrapperNodeName = this._graph.addAnonymous(nodeInfo.arg, buildObjectFromKeysAndArguments.bind(null, keys), wrapperArgs)
      var newBuilds = this.builds(utils.OUTPUT_PREFIX_IMPORTANT + wrapperNodeName)
      newBuilds.using.apply(newBuilds, wrapperUsing)
      arg[nodeInfo.arg] = wrapperNodeName

    } else if (typeof nodeNames == 'string' && utils.isArgRef(nodeInfo.nodeName)) {
      // check that an existing arg is referenced
      var inputArg = utils.getArgRef(nodeInfo.nodeName).split('.')[0]
      if (!utils.isWildcardArgRef(nodeInfo.nodeName) && this._inputArgs.indexOf(inputArg) === -1) {
        throw new Error(nodeInfo.nodeName + " is referenced but is not provided as an input")
      }
    }

    // If this .using() belongs to a conditional node, append to that,
    // otherwise append to the previous .builds() node.
    var target = this._builds[nodeIdx].condition || this._builds[nodeIdx]
    target.provides.push(arg)
  }
  return this
}

/**
 * Specify that this node should return a specific sub-node if this
 * is a subgraph
 *
 * @param {string} nodeName the name of the node to return
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.returns = function (nodeName) {
  if (this._fn !== this._graph.subgraph) throw new Error("Only able to call .returns() on a subgraph")

  var wrapperNode = this._graph.addAnonymous(utils.NODE_PREFIX_AGGREGATOR_RETURN_VAL, this._graph.subgraph, ['nodeName'])
  return this.builds(wrapperNode)
    .using({nodeName: nodeName})
}

NodeDefinition.prototype.modifiers = function (var_args) {
  var name = this._name

  for (var i = 0; i < arguments.length; i += 1) {
    if (this._builds.length) {
      // create a new last field which pulls from the previous last
      var previousField = this._builds[this._builds.length - 1]

      // find a safe name to move this node to
      var nodeInfo = previousField.field
      var nodeName
      var j = 0
      do {
        j++
        nodeName = nodeInfo.aliasRealName + '-modifier' + j
      } while (this._getNode(nodeName))

      // find the existing arg info
      var argIdx = this._getArgIdx(nodeInfo)

      // rename the node
      var newNodeInfo = {}
      newNodeInfo[utils.OUTPUT_PREFIX_IMPORTANT + nodeName] = nodeInfo.fullName
      this._args[argIdx] = previousField.field = utils.getNodeInfoFromBuild(this._graph, newNodeInfo)

      // retrieve the modifier info
      var modifierNodeInfo = utils.getNodeInfoFromModifier(this._graph, arguments[i], nodeInfo.getAlias())

      // create a new field or clone the already configured field
      var fieldData = {}
      fieldData[nodeInfo.getAlias()] = modifierNodeInfo.nodeName
      var fieldDataInfo = utils.getNodeInfoFromBuild(this._graph, fieldData)
      var modifierNode = this._getNode(modifierNodeInfo.nodeName)

      if (modifierNode) {
        // clone the existing node
        this._builds.push(clone(modifierNode))
        this._builds[this._builds.length - 1].field = fieldDataInfo
      } else {
        // create a new node
        this.builds(fieldData)
        this._args.pop()
      }
      this._args.push(fieldDataInfo)


      // map the old node to the new node
      var usingData = {}
      usingData[modifierNodeInfo.arg] = nodeName
      this.using(usingData)
    } else {
      throw new Error("The ability to add modifiers directly to a graph node has been deprecated")
    }
  }
  return this
}

/**
 * Add a conditional node for the previous input node
 *
 * @param {Object|string} field
 * @param {boolean} condition The truthiness value to compare the
 *     conditional against.
 * @return {NodeDefinition} This
 */
NodeDefinition.prototype._addCondition = function(field, condition) {
  var nodeIdx = this._builds.length - 1
  var nodeInfo = utils.getNodeInfoFromInput(this._graph, field)
  var nodeName = nodeInfo.nodeName
  // TODO(kyle): Same logic as in .using(), factor out
  if (typeof nodeName == 'string' && utils.isArgRef(nodeInfo.nodeName)) {
    // check that an existing arg is referenced
    var inputArg = utils.getArgRef(nodeInfo.nodeName).split('.')[0]
    if (!utils.isWildcardArgRef(nodeInfo.nodeName) && this._inputArgs.indexOf(inputArg) === -1) {
      throw new Error(nodeInfo.nodeName + " is referenced but is not provided as an input")
    }
  }

  this._builds[nodeIdx].condition = new NodeCondition(nodeInfo, condition)
  return this
}

NodeDefinition.prototype.when = function(field) {
  return this._addCondition(field, true)
}

NodeDefinition.prototype.unless = function(field) {
  return this._addCondition(field, false)
}

/**
 * Set the handler function for this node
 */
NodeDefinition.prototype.fn = function (fn) {
  this._fn = fn
  return this
}

/**
 * Set the handler function for this node, but inject based on parameter name instead
 * of based on order.
 *
 * If the parameters can't be found, this will throw an error.
 *
 * @param {!Function} fn
 */
NodeDefinition.prototype.inject = function (fn) {
  var paramNames = utils.parseFnParams(fn)

  var shortArgsNames = []
  var i = 0
  for (i = 0; i < this._args.length; i++) {
    shortArgsNames.push(utils.getNodeInjectorName(this._args[i].aliasRealName))
  }

  // Sort the arguments  so that the parameters get injected in the
  // right order.
  var newArgs = []
  for (i = 0; i < paramNames.length; i++) {
    var idx = shortArgsNames.indexOf(paramNames[i])
    if (idx === -1) {
      throw new Error('No injector found for parameter: ' + paramNames[i])
    }

    newArgs.push(this._args[idx])
    this._args.splice(idx, 1)
    shortArgsNames.splice(idx, 1)
  }

  // Push any args that are not included.
  newArgs.push.apply(newArgs, this._args)
  this._args = newArgs

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
 * Proxy function which can be used to chain add() requests back
 * to the graph
 */
NodeDefinition.prototype.add = function () {
  return this._graph.add.apply(this._graph, arguments)
}

/**
 * In thunks, we have a series of nodes that all share the same arguments.
 *
 * Any arguments added to this node need to be mirrored on the mirrorNode.
 *
 * @param {NodeDefinition} mirrorNode
 */
NodeDefinition.prototype.addArgumentMirror = function (mirrorNode) {
  if (!this._argumentMirrors) {
    this._argumentMirrors = []
  }
  this._argumentMirrors.push(mirrorNode)
}

/**
 * If we're building a thunk, we create a lazy dependency from
 * the thunk to its synchronous subtree.
 *
 * This tells the Builder that it's OK to send the thunk function to nodes
 * that require it, event though its dependencies haven't resolved yet.
 *
 * This function should only be called from Graph.js, which sets up the necessary
 * dependencies so that calling the thunk function forces the subtree to resolve.
 *
 * @param {boolean} val
 */
NodeDefinition.prototype.setLazyDependencyInternal = function (val) {
  this._lazyDependency = val
  return this
}

/**
 * @return {boolean} Whether this is a lazy dependency.
 */
NodeDefinition.prototype.isLazyDependency = function () {
  return this._lazyDependency
}

/**
 * Get build info for a node that will be built by this node definition by its alias
 *
 * @param {string} alias the alias for the node
 * @return {Object} returns null if the build doesn't exist
 */
NodeDefinition.prototype._getNode = function (alias) {
  for (var i = 0; i < this._builds.length; i++) {
    if (this._builds[i].field.aliasRealName == alias) return this._builds[i]
  }

  return null
}

/**
 * Get the index for a node that will be built by this node definition
 *
 * @param {NodeInfo} nodeInfo The node
 * @return {number} returns -1 if the alias doesn't exist
 */
NodeDefinition.prototype._getArgIdx = function (nodeInfo) {
  for (var i = 0; i < this._args.length; i++) {
    if (nodeInfo.isSameAlias(this._args[i])) return i
  }

  return -1
}

module.exports = NodeDefinition
