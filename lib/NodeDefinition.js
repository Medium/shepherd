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

var ConditionalError = require('./ConditionalError')

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
  this._inputNames = []
  this._args = []
  this._builds = []
  this._modifiers = []
  this._cacheDisabled = false
  this._fn = null
  this._hasGettersEnabled = false
  this._ignoredErrors = []

  this._conditionalState = {
    idx: 0,
    alias: null,
    candidates: [],
    nextCandidate: null
  }
}

/**
 * Get the list of nodes that this node should ignore errors
 * for
 *
 * @return {Array.<string>}
 */
NodeDefinition.prototype.getIgnoredErrors = function () {
  return this._ignoredErrors
}

/**
 * Ignore errors from a given set of input nodes
 *
 * @param {Array.<string>|string} var_args a variable length
 *     list of node names or an array of node names
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.ignoreErrors = function (var_args) {
  var_args = Array.isArray(var_args) ? var_args : Array.prototype.slice.call(arguments, 0)
  for (var i = 0; i < var_args.length; i++) {
    this._ignoredErrors.push(var_args[i])
  }
  return this
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
 * @return {Array.<Object|string>} args
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
  def._inputNames = clone(this._inputNames)
  def._args = clone(this._args)
  def._builds = clone(this._builds)
  def._modifiers = clone(this._modifiers)
  def._fn = this._fn
  def._hasGettersEnabled = this._hasGettersEnabled
  def._ignoredErrors = clone(this._ignoredErrors)
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

/**
 * Get the names of all inputs to this node
 *
 * @return {Array.<string>}
 */
NodeDefinition.prototype.getInputNames = function () {
  return this._inputNames
}

/**
 * Start configuring a node for use in .modifiers()
 *
 * @param {string} field
 * @return {NodeDefinition} the current node
 */
NodeDefinition.prototype.configure = function (field) {
  return this.builds('?' + field)
}

/**
 * Start defining a field for conditional guard purposes
 *
 * @param {string} fieldName the name of the field
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.define = function (fieldName) {
  this._conditionalState.nextCandidate = null
  this._conditionalState.idx++
  this._conditionalState.alias = fieldName
  this._conditionalState.candidates = []
  return this
}

/**
 * Add a when or an unless condition
 *
 * @param {string} field
 * @param {boolean} isUnless if this is an unless condition
 * @return {NodeDefinition}
 */
NodeDefinition.prototype._addCondition = function (field, isUnless) {
  var nodeInfo = utils.getNodeInfoFromBuild(this._graph, field)
  var isArg = nodeInfo.fullName.indexOf('args.') === 0

  // set up the nodes for when a condition succeeds
  var throwFailure = this._graph.addAnonymous('throwsOnFailure', isUnless ? throwIfTruthy : throwIfNotTruthy, ['val'])
  var successObj = {}
  successObj[this._getFutureWhenName(true)] = throwFailure
  this._buildsWithWhen(successObj, true)
    .using({val: isArg ? nodeInfo.fullName : utils.getNodeRealName(nodeInfo.alias)})

  // set up the nodes for when a condition fails
  var throwSuccess = this._graph.addAnonymous('throwsOnSuccess', isUnless ? throwIfNotTruthy : throwIfTruthy, ['val'])
  var failureObj = {}
  failureObj[this._getFutureWhenName(false)] = throwSuccess
  this._buildsWithWhen(failureObj, true)
    .using({val: isArg ? nodeInfo.fullName : utils.getNodeRealName(nodeInfo.alias)})

  // add the previous candidate
  if (!isArg && !this._getNode(nodeInfo.alias)) {
    var response = this._buildsWithWhen(field, true)
    if (this._conditionalState.candidates.length) {
      response.using('!' + this._getFutureWhenName(false, -1))
    }
  }
  this._conditionalState.candidates.push(this._conditionalState.nextCandidate)
  return this
}

/**
 * Specify the unless clause for the last publicly visible .builds()
 * node
 *
 * @param {string} field
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.when = function (field) {
  return this._addCondition(field, false)
}

/**
 * Specify the when clause for the last publicly visible .builds()
 * node
 *
 * @param {string} field
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.unless = function (field) {
  return this._addCondition(field, true)
}

/**
 * Complete the current define block and wrap it together with an aggregator
 * node
 *
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype.end = function () {
  if (this._conditionalState.nextCandidate) {
    // if an else needs to be built

    // add an else node to the graph
    var elseNodeName = this._graph.addAnonymous('conditionalElse', this._graph.literal(true))
    var elseNode = this._graph.getNode(elseNodeName)

    // build the else condition
    var elseWhenName = this._getFutureWhenName(true)
    var elseObj = {}
    elseObj[elseWhenName] = elseNodeName
    var elseBuild = this._buildsWithWhen(elseObj, true)
      .using('!' + this._getFutureWhenName(false, -1))

    // add the else .builds() node as the last candidate for the aggregator
    this._conditionalState.candidates.push(this._conditionalState.nextCandidate)
  }

  // create arguments for inputs into the aggregator node
  var args = []
  var using = []
  for (var i = 0; i < this._conditionalState.candidates.length; i++) {
    var candidate = this._conditionalState.candidates[i]
    var argName = 'arg' + (i + 1)
    args.push(argName)

    var usingObj = {}
    usingObj[argName] = candidate
    using.push(usingObj)
  }

  // create the aggregator node
  var selectorName = this._graph.addAnonymous('val-fromConditional', getValueFromConditional.bind(null, this._conditionalState.candidates.length), args)
  var selectorNode = this._graph.getNode(selectorName).enableGetters()
    .ignoreErrors(utils.DYNAMIC_NODE_REF)

  // remap the aggregator node name to the original define name
  var alias = {}
  alias[this._conditionalState.alias] = selectorName
  this._conditionalState.alias = null

  // build the aggregator node
  var toBuild = this.builds(alias)
  return toBuild.using.apply(toBuild, using)
}

/**
 * Specify that this node should build another node as an input
 *
 * @param {string} field the node to build
 * @return {NodeDefinition} the current node
 */
NodeDefinition.prototype.builds = function (field) {
  return this._buildsWithWhen(field, false)
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
 * @param {Object|string} var_args a variable number of arguments
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
        var newBuilds = this.builds('!' + wrapperNodeName)
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
      var newBuilds = this.builds('!' + wrapperNodeName)
      newBuilds.using.apply(newBuilds, wrapperUsing)
      arg[nodeInfo.arg] = wrapperNodeName
    }

    this._builds[nodeIdx].provides.push(arg)
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

  var wrapperNode = this._graph.addAnonymous('returnVal', this._graph.subgraph, ['nodeName'])
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
      newNodeInfo['!' + nodeName] = nodeInfo.fullName
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
      throw new Error("The ability to add modifiers directly to a graph node has been deprecated")
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
 * Proxy function which can be used to chain add() requests back
 * to the graph
 */
NodeDefinition.prototype.add = function () {
  return this._graph.add.apply(this._graph, arguments)
}

/**
 * Get build info for a node that will be built by this node definition by its alias
 *
 * @param {string} alias the alias for the node
 * @return {Object} returns null if the build doesn't exist
 */
NodeDefinition.prototype._getNode = function (alias) {
  for (var i = 0; i < this._builds.length; i++) {
    var nodeInfo = utils.getNodeInfoFromBuild(this._graph, this._builds[i].field)
    if (nodeInfo.aliasRealName == alias) return this._builds[i]
  }

  return null
}

/**
 * Get the index for a node that will be built by this node definition
 *
 * @param {string} alias the alias for the node
 * @return {number} returns -1 if the alias doesn't exist
 */
NodeDefinition.prototype._getArgIdx = function (alias) {
  for (var i = 0; i < this._args.length; i++) {
    var nodeInfo = utils.getNodeInfoFromBuild(this._graph, this._args[i])
    if (nodeInfo.alias == alias) return i
  }

  return -1
}

/**
 * Build a ndoe name for the current conditional clause's when dependency
 *
 * @param {boolean} shouldSucceed whether the when should succeed or fail
 * @param {number} offset optional offset for referencing previous whens
 * @return {string}
 */
NodeDefinition.prototype._getFutureWhenName = function (shouldSucceed, offset) {
  var prefix = (shouldSucceed ? 'onSuccess' : 'onFailure')
  offset = offset || 0
  var suffix = this._conditionalState.candidates.length + 1 + offset
  return prefix + '-define_' + this._conditionalState.idx + '_' + suffix
}

/**
 * Build a node with information as to whether the node is part of a when()
 * clause or not
 *
 * @param {string} field the build info for the node
 * @param {boolean} isWhen whether the node is part of a when() clause
 * @return {NodeDefinition} the current instance
 */
NodeDefinition.prototype._buildsWithWhen = function (field, isWhen) {
  var whenNode = null
  var nodeInfo = utils.getNodeInfoFromBuild(this._graph, field)

  if (this._conditionalState.alias) {
    // if this is in the middle of a conditional
    if (!isWhen) {
      whenNode = this._getFutureWhenName(true)
    }

    if (!utils.isSilentNode(nodeInfo.alias)) {
      // silent nodes still need to depend on the conditional
      field = {}
      field['!' + nodeInfo.alias] = nodeInfo.fullName
      if (!isWhen) this._conditionalState.nextCandidate = nodeInfo.alias
    }

    this.ignoreErrors(utils.getNodeRealName(nodeInfo.alias))
  }

  utils.getNodeInfoFromBuild(this._graph, field)

  this._builds.push({
    field: field,
    provides: [],
    modifiers: [],
    isConditional: !!this._conditionalState.alias
  })

  this._args.push(field)

  if (whenNode) {
    // if there is a when, wait for the when to complete
    this.using('!' + whenNode)
  }
  return this
}

/**
 * Helper function which will throw an error if an input is truthy
 *
 * @param {Object} val
 * @return {boolean}
 * @throws ConditionalError
 */
function throwIfTruthy(val) {
  if (val) throw new ConditionalError("is truthy")
  return true
}

/**
 * Helper function which will throw an error if an input is not truthy
 *
 * @param {Object} val
 * @return {boolean}
 * @throws ConditionalError
 */
function throwIfNotTruthy(val) {
  if (!val) throw new ConditionalError("is not truthy")
  return true
}

/**
 * Helper function which will iterate over a set of input NodeResponseGetter
 * instances and return the first value that isn't an error
 *
 * @param {NodeResponseGetter} var_args a variable length list of input
 *     NodeResponseGetters
 * @return {Object}
 */
function getValueFromConditional(numCandidates, var_args) {
  for (var i = 1; i <= numCandidates; i++) {
    var err = arguments[i].getError()
    if (!err) {
      return arguments[i].get()
    }
    if (!(err instanceof ConditionalError)) {
      throw err
    }
  }
  return undefined
}

module.exports = NodeDefinition