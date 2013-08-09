// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for Builder which creates an
 *     optimized path through a series of nodes in a Graph. Builder has a
 *     compile() function which runs through all of the nodes that need to
 *     be built, as defined at the Builder itself or defined by the nodes
 *     when they were initially added to the graph, and flattens them into
 *     a cohesive deduplicated mesh of dependencies. Once the compile phase
 *     has been ran, the resolution of each graph node in a Builder is
 *     very lightweight as it has explicit pointers to its dependencies.
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var crypto = require('crypto')
var DependencyManager = require('./DependencyManager')
var GraphResults = require('./GraphResults')
var NodeInstance = require('./NodeInstance')
var NodeResponseGetter = require('./NodeResponseGetter')
var oid = require('oid')
var Q = require('kew')
var typ = require('typ')
var utils = require('./utils')
var xxhash = require('xxhash')

// a map of the child part of '.' delimited node names to functions which parse the child
// data from a parent node
var childGetters = {}

// a map of literal hashes to promises
var literalPromises = {}

// a map of literal hashes to values
var literalValues = {}

// keep profile data in 1 minute buckets
var PROFILE_BUCKET_SIZE = 60 * 1000

// store the last 30 minutes of profile buckets
var MAX_PROFILE_BUCKETS = 30

// hash of magic strings that never name real nodes.
var MAGIC_NODE_NAMES = {
  _requiredFields: true
}

// default handler function to allow the compile step to finish without yelling,
// will be overridden by the compiler itself
var DEFAULT_HANDLER_FUNCTION = function defaultHandler() {
  throw new Error("Builder handler function should be overridden at compile time")
}

/** @constructor */
function InputMetadata(localName) {
  /** @type {string} */
  this.localName = localName

  /** @type {boolean} Whether this must be executed before all other inputs. */
  this.important = false

  /** @type {boolean} Whether this was implicitly added */
  this.implicit = false

  /** @type {boolean} Whether this is an argument to the callback */
  this.argument = false
}

InputMetadata.prototype.setImportant = function(val) {
  this.important = val
  return this
}

InputMetadata.prototype.setImplicit = function(val) {
  this.implicit = val
  return this
}

InputMetadata.prototype.setArgument = function(val) {
  this.argument = val
  return this
}


/** @constructor */
function CompiledNode(
    graph,
    config,
    originalNodeName,
    newNodeName,
    inputs,
    inputMetadata,
    def,
    ownerName) {
  /** @private {Graph} */
  this._graph = graph

  this._argInputs = []
  this._importantInputs = []
  this._implicitInputs = []
  this._voidInputs = []

  inputMetadata.forEach(function (m) {
    if (m.important) this._importantInputs.push(m.localName)
    else if (m.argument) this._argInputs.push(m.localName)
    else this._voidInputs.push(m.localName)
  }, this)

  /**
   * A map of the local name of an input to its global name
   * in the whole graph.
   * @type {Object.<string, string>}
   */
  this.inputs = inputs

  this.originalName = originalNodeName
  this.newName = newNodeName
  this.fn = def.getFunction()
  this.cacheDisabled = !!def.isCacheDisabled()
  this.hasGettersEnabled = def.hasGettersEnabled()
  this.requiredFields = []
  this.numUniqueInputs = 0
  this.outputNodes = []

  /**
   * Default priority. See setPrioritiesRecursive.
   * @private {number}
   */
  this._priority = 0

  this._ownerName = ownerName

  this.type = config.enforceTypes ? originalNodeName.split('-')[0] : null

  var literal = this.fn && this.fn._literal
  if (literal) {
    var literalHash = oid.hash(literal)
    if (!literalPromises[literalHash]) {
      literalPromises[literalHash] = Q.resolve(literal)
      literalValues[literalHash] = literal
    }
    this.literalPromise = literalPromises[literalHash]
    this.literalValue = literalValues[literalHash]
  }
}

/**
 * Set the new priority of a node. Notice that it's impossible to decrease the
 * priority of a node once it's been raised.
 * @param {number} newPriority
 * @return {boolean} If the priority changed.
 */
CompiledNode.prototype.raisePriority = function (newPriority) {
  if (newPriority > this._priority) {
    this._priority = newPriority
    return true
  }
  return false
}

/** @return {number} */
CompiledNode.prototype.getPriority = function () {
  return this._priority
}

/** @return {string} The name of the owner, for error messages. */
CompiledNode.prototype.getOwnerName = function () {
  return this._ownerName
}

/**
 * Convert a local name to the root of the global name.
 * @param {string} localName
 * @return {string}
 */
CompiledNode.prototype.localNameToGlobal = function (localName) {
  var inputName = this.inputs[localName]
  return utils.getNodeRootName(inputName)
}

/**
 * @param {string} localName The local name of the input.
 * @return {boolean} Whether this is a important input.
 */
CompiledNode.prototype.isImportantInput = function (localName) {
  return this._importantInputs.indexOf(localName) !== -1
}

/**
 * @param {string} localName The local name of the input.
 * @return {number} The index of the argument in this node.
 */
CompiledNode.prototype.getArgIndex = function (localName) {
  return this._argInputs.indexOf(localName)
}

/**
 * @param {string} localName The local name of the input.
 * @return {boolean} Whether the input must be evaluated
 *     before the current node.
 */
CompiledNode.prototype.isEvaluatedInput = function (localName) {
  return this._importantInputs.indexOf(localName) !== -1 ||
      this._argInputs.indexOf(localName) !== -1 ||
      this._voidInputs.indexOf(localName) !== -1
}

/**
 * Add this input as an implicit important input. This ensures
 * that a important node blocking A is evaluated before all of A's
 * descendants.
 * @param {string} dep
 */
CompiledNode.prototype.addImplicitImportantInput = function (dep) {
  this.inputs[dep] = dep
  this._importantInputs.push(dep)
  this._implicitInputs.push(dep)
}

/**
 * @param {string} localName
 * @return {boolean} Whether this is an implicit, important input (i.e., an
 *     important input of one of our ancestors).
 */
CompiledNode.prototype.isImplicitImportantInput = function (localName) {
  return this._implicitInputs.indexOf(localName) !== -1
}

/**
 * @return {Array.<string>} The global names of all the important inputs.
 */
CompiledNode.prototype.getImportantInputGlobalNames = function () {
  var result = []
  for (var i = 0; i < this._importantInputs.length; i++) {
    result.push(this.localNameToGlobal(this._importantInputs[i]))
  }
  return result
}

/**
 * @return {Array.<string>} The global names of all normal-priority inputs.
 */
CompiledNode.prototype.getNormalInputGlobalNames = function () {
  var result = []
  for (var i = 0; i < this._voidInputs.length; i++) {
    result.push(this.localNameToGlobal(this._voidInputs[i]))
  }
  for (var i = 0; i < this._argInputs.length; i++) {
    result.push(this.localNameToGlobal(this._argInputs[i]))
  }
  return result
}

/**
 * @return {Array.<string>} The names of all inputs.
 */
CompiledNode.prototype.getAllInputNames = function () {
  return this._importantInputs.concat(this._voidInputs).concat(this._argInputs)
}

/**
 * @return {Array.<string>} The local names of all important inputs.
 */
CompiledNode.prototype.getImportantInputLocalNames = function () {
  return this._importantInputs
}

/**
 * @return {Array.<string>} The local names of all inputs not passed as arguments.
 */
CompiledNode.prototype.getQuietInputNames = function () {
  return this._importantInputs.concat(this._voidInputs)
}

/**
 * @return {Array.<string>} The local names of all inputs passed as arguments.
 */
CompiledNode.prototype.getArgumentInputNames = function () {
  return this._argInputs
}

/** @return {boolean} */
CompiledNode.prototype.isPrivate = function () {
  return utils.isPrivateNode(this.originalName)
}

/** @return {boolean} */
CompiledNode.prototype.isSubgraph = function () {
  return this.fn === this._graph.subgraph
}

/** @return {boolean} */
CompiledNode.prototype.isArrayWrapper = function () {
  return this.fn === this._graph.argsToArray
}


/**
 * Retrieve a node and generate a list of recursive inputs for it. If a
 * child has an identical important dependency, remove the same dep
 * from this node
 *
 * @param {Object.<string, CompiledNode>} nodes A map of all the node inputs.
 * @return {Object} a map of node names to the original calling nodes
 */
CompiledNode.prototype.generateRecursiveInputs = function (nodes) {
  // if the node has getters enabled it may surpress the errors,
  // so we still need to depend on any deps
  var shouldSendInputs = !this.hasGettersEnabled

  // return early if the inputs are already built
  if (this._recursiveInputs) return shouldSendInputs ? this._recursiveInputs : {}

  // start building inputs
  this._recursiveInputs = {}
  var childNodeName, i

  // loop through all input nodes and retrieve their important inputs
  for (var inputName in this.inputs) {
    var inputNode = nodes[this.localNameToGlobal(inputName)]
    if (inputNode) {
      var childInputs = inputNode.generateRecursiveInputs(nodes)
      for (childNodeName in childInputs) {
        this._recursiveInputs[childNodeName] = childInputs[childNodeName]
      }
    }
  }

  // loop through all important inputs for this node and add to the list for
  // deduping of parents
  for (i = 0; i < this._importantInputs.length; i++) {
    childNodeName = this._importantInputs[i]
    if (this._recursiveInputs[childNodeName]) {
      this._importantInputs.splice(i, 1)
      i--
    } else {
      this._recursiveInputs[childNodeName] = this.newName
    }
  }

  return shouldSendInputs ? this._recursiveInputs : {}
}

/**
 * Generate the hashes for this node and its inputs, and store them on the node.
 *
 * This needs to be done after we've generated all the compiled nodes, because
 * the hash of one node will depend recursively on the hashes of its inputs.
 *
 * @param {Object.<string, CompiledNode>} nodes A map of all the node inputs.
 * @param {Object.<string, string>} fnOriginNames A memoization of function hashes to their original name.
 * @param {function(): number} idProvider A unique ID provider.
 */
CompiledNode.prototype.generateHashes = function (nodes, fnOriginNames, idProvider) {
  if (this.completeHash) return

  // Find hashes for all inputs.
  var argHashes = {}
  var importantHashes = {}
  var keys = Object.keys(this.inputs).sort()
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var inputRoot = this.localNameToGlobal(key)
    var inputSuffix = this.inputs[key].substr(inputRoot.length)

    var compiledInput = nodes[inputRoot]
    if (compiledInput) {
      compiledInput.generateHashes(nodes, fnOriginNames, idProvider)
    }
    var inputHashes = compiledInput || {completeHash: inputRoot, nonImportantHash: inputRoot}
    if (this.isImportantInput(key)) {
      importantHashes[key] = inputHashes.completeHash + inputSuffix
    }

    var argIndex = this.getArgIndex(key)
    if (argIndex !== -1) {
      argHashes[key] = {idx: argIndex, hash: inputHashes.nonImportantHash + inputSuffix}
    }
  }

  // Start with a hash of all inputs and outputs.
  var hashBuilder = new NodeHashBuilder()
      .add(importantHashes, true)
      .add(argHashes)
      .add(oid.hash(this.literalPromise))

  // compute the function hash, and mix that in.
  var fnHash = oid.hash(this.fn)
  var fnOriginName = fnOriginNames[fnHash]
  if (!fnOriginName) {
    fnOriginName = fnOriginNames[fnHash] = this.originalName
  }
  hashBuilder.add(fnOriginName)

  // If results caching is disabled, add a unique index for this node.
  if (this.cacheDisabled) {
    hashBuilder.add(idProvider())
  }

  this.completeHash = hashBuilder.buildCompleteHash()
  this.nonImportantHash = hashBuilder.buildNonImportantHash()
}

/**
 * Builds up hashes for a CompiledNode.
 *
 * We need two distinct types of hatches:
 * 1) A "complete" hash that includes important inputs, which we use for
 *    de-duping nodes.
 * 2) A "non-important" hash that only includes visible inputs and outputs,
 *    which we use for storing intermediate results in GraphResults.
 *
 * @constructor
 */
function NodeHashBuilder() {
  this._completeHashVals = []
  this._nonImportantHashVals = []
}

/**
 * @param {Object|number|string} val A value to add to the hash.
 * @param {boolean} opt_important Whether this value represents a important input.
 * @return {NodeHashBuilder} this, for easy chaining.
 */
NodeHashBuilder.prototype.add = function (val, opt_important) {
  if (typeof val == 'object' && val != null) {
    // if the val is an object, stringify it instead
    val = createHash(JSON.stringify(val))
  }

  var valType = typeof val
  if (valType !== 'string' && valType !== 'number' && val != null) {
    throw new Error('invalid hash val')
  }

  this._completeHashVals.push(val)
  if (!opt_important) {
    this._nonImportantHashVals.push(val)
  }
  return this
}

/** @return {string} The complete hash. */
NodeHashBuilder.prototype.buildCompleteHash = function () {
  // using a | delimiter for now for simplicity (it works well for all inputs to the hashing currently)
  return createHash(this._completeHashVals.join('|'))
}

/** @return {string} A hash of visible inputs/outputs. */
NodeHashBuilder.prototype.buildNonImportantHash = function () {
  return createHash(this._nonImportantHashVals.join('|'))
}


/**
 * Create a builder which takes in user inputs in order to perform the work
 * of traversing a Graph instance optimally
 *
 * @param {Graph} graph an instance of Graph which contains the NodeDefinition
 *     instances to use
 * @param {string} name the name of the builder
 * @param {Object} config an optional map of extra config options
 * @constructor
 */
function Builder(graph, name, config) {
  this._config = config || {}
  this._types = config.types || {}
  this._functionHashOriginalNodes = {}
  if (!this._config.enableProfiling) this._config.enableProfiling = false
  if (!this._config.freezeOutputs) this._config.freezeOutputs = false
  if (!this._config.enforceTypes) this._config.enforceTypes = undefined
  if (!this._config.enforceMatchingParams) this._config.enforceMatchingParams = false
  this._name = name
  this._description = null

  this._profileData = []
  this._currentProfileData = null
  this._profilingInterval = null

  this._outputNodeName = graph.addBuilderHandler(this, DEFAULT_HANDLER_FUNCTION)
  this._outputNode = graph.getNode(this._outputNodeName)

  this._graph = graph
  this._resolvers = {}

  this._handlers = {
    'pre': [],
    'post': []
  }

  this._boundProfiler = this._profile.bind(this)
  this._boundRun = this._run.bind(this)
}

/**
 * Set the compile inputs for this builder (may also pass them to .compile())
 *
 * @param {Array.<string>} inputs The nodes that will be passed as inputs to this builder
 */
Builder.prototype.setCompileInputs = function (inputs) {
  this._config.compileInputs = inputs
  return this
}

/**
 * Retrieve all of the compiled nodes
 *
 * @return {Object} a mapping of node names to their compiled forms
 */
Builder.prototype.getCompiledNodes = function () {
  this.compile()
  return this._compiled.nodes
}

/**
 * Force this builder to deep freeze the outputs of every node built
 *
 * @return {Builder} the current instance
 */
Builder.prototype.freezeOutputs = function () {
  this._config.freezeOutputs = true
  return this
}

/**
 * Return the name of this builder
 *
 * @return {string}
 */
Builder.prototype.getName = function () {
  return this._name
}

/**
 * Get the graph for this builder
 *
 * @return {Object} the graph
 */
Builder.prototype.getGraph = function () {
  return this._graph
}

/**
 * Toggle whether profiling is enabled or not
 *
 * @param {number} profilingFrequency a number 0-1 representing the frequency of profiling for this builder
 * @return {Builder} the current instance
 */
Builder.prototype.setProfilingFrequency = function (profilingFrequency) {
  this._config.enableProfiling = !!profilingFrequency
  this._config.profilingFrequency = profilingFrequency
  if (this._profilingInterval) clearInterval(this._profilingInterval)

  if (this._config.enableProfiling) {
    this._profilingInterval = setInterval(this._shiftProfilers.bind(this), PROFILE_BUCKET_SIZE)
    this._shiftProfilers()
  } else {
    this._profileData = []
  }
  return this
}

/**
 * Set the description for this builder
 *
 * @param {string} description
 * @return {Builder} the current instance
 */
Builder.prototype.description = function (description) {
  this._description = description
  return this
}

/**
 * Get the description for this builder
 *
 * @return {string} returns the description for this node
 */
Builder.prototype.getDescription = function () {
  return this._description
}

/**
 * Retrieve a list of input node names for a given node
 *
 * @param {string} nodeName the name of the node to retrieve inputs for
 * @return {Array.<string>} list of input node names
 */
Builder.prototype.getNodeInputs = function (nodeName) {
  this.compile()

  // load the node requested and find the actual source node in the case of clones
  var node = this._compiled.nodes[nodeName]

  // no node exists, must be an input to the builder (with no dependencies)
  if (!node) return []

  // add all inputs (and deduplicate)
  var inputNodes = {}
  for (var alias in node.inputs) inputNodes[node.inputs[alias]] = true

  // done
  return Object.keys(inputNodes)
}

/**
 * Return a DOT graph for this Builder which will show execution flow through
 * the Builder
 *
 * @param {Array.<string>} inputNodes an optional list of nodes which will
 *     be passed as inputs into this Builder at run time
 * @return {string} DOT graph output
 */
Builder.prototype.getDotGraph = function (inputNodes) {
  // start up graphviz
  var graphviz = require('graphviz')
  var g = graphviz.digraph('G')

  // grab the data from the builder
  this.compile(inputNodes)
  if (!inputNodes) inputNodes = []
  var nodes = {}


  var nodeName
  var node
  this._getNodeFromDotGraph(g, nodes, inputNodes, this._outputNodeName, true)

  return g.to_dot()
}

/**
 * Specify that this Builder should configure a specific node name. This is
 * the same as calling .builds('?NODE_NAME')
 *
 * @param {string|Object} field a field name to configure or an alias to field name mapping
 * @return {NodeInstance} a NodeInstance for the specified field
 */
Builder.prototype.configure = function (field) {
  return this._outputNode.configure(field)
}

/**
 * Specify that this Builder should build a specific node name
 *
 * @param {string|Object} field a field name to build or an alias to field name mapping
 * @return {NodeInstance} a NodeInstance for the specified field
 */
Builder.prototype.builds = function (field) {
  return this._outputNode.builds(field)
}

/**
 * Utility function which returns a function that will compile the
 * builder once ran
 *
 * @param {Array.<string>} runInputs a list of nodes that will be provided
 *     to run() for this method, causes the compile phase to throw an
 *     error if any nodes are missing
 * @return {function()}
 */
Builder.prototype.compiler = function (runInputs) {
  return this.compile.bind(this, runInputs)
}

/**
 * Recurse through all nodes that need to be built for this builder
 * and create a "compiled" block of data which represents an optimal
 * and deduplicated path through the nodes in this Graph.
 *
 * NOTICE: This will be implicitly called by run() if it has not already
 * been called. You do not need to run this explicitly, but it can help
 * with testing by throwing start-up time errors.
 *
 * @param {Array.<string>=} runInputs a list of nodes that will be provided
 *     to run() for this method, causes the compile phase to throw an
 *     error if any nodes are missing
 */
Builder.prototype.compile = function (runInputs) {
  if (this._compileError) throw Error(this._compileError)
  if (this._compiled) return this

  try {
    this._compileUnsafe(runInputs)
  } catch (e) {
    this._compileError = 'Broken graph: ' + e.message
    throw e
  }
  return this
}

/**
 * Run this builder with a given set of input and optional callback
 *
 * @param {Object|function(Error, Object)} data Any input to be fed into this
 *     Builder, or the callback if none
 * @param {function(Error, Object)|Object} callback A node-style callback which
 *     takes an error parameter as the first argument and the output of
 *     the build process as a key to value mapping as the second; if no data,
 *     then this is the callback scope
 * @param {Object=} callbackScope an optional scope provided for the
 *     callback
 * @return {Promise.<Object>} promise which returns a key to value
 *     mapping of the result if successful
 */
Builder.prototype.run = function (data, callback, callbackScope) {
  if (!data) {
    data = {}
  } else if (typeof data === 'function') {
    callbackScope = callback
    callback = data
    data = {}
  }

  var promise = Q.resolve(data)

  // add pre-handlers
  for (var i = 0; i < this._handlers.pre.length; i++) {
    promise = promise.then(this._handlers.pre[i])
  }

  // run the builder
  promise = promise.then(this._boundRun)

  // add post-handlers
  for (i = 0; i < this._handlers.post.length; i++) {
    promise = promise.then(this._handlers.post[i])
  }

  // handle callbacks
  if (callback) {
    promise
    .setContext({scope: callbackScope, callback: callback})
    .then(onRunSuccess)
    .fail(onRunFailure)
    .clearContext()
  }

  return promise
}

/**
 * Add a pre-run handler or multiple pre-run handlers. These
 * allow for modification of inputs on the way into .run()
 *
 * @param {function(Object)|Array.<function(Object)>} var_args a
 *     variable number of arguments to this function which can either
 *     be arrays of functions or functions which pre-process the input
 *     to run() calls
 * @return {Builder} current Builder instance
 */
Builder.prototype.preRun = function (var_args) {
  this._addHandlers.apply(this, ['pre'].concat(arguments))
  return this
}

/**
 * Add a post-run handler or multiple post-run handlers. These
 * allow for modification of outputs on the way out of .run()
 *
 * @param {function(Object)|Array.<function(Object)>} var_args a
 *     variable number of arguments to this function which can either
 *     be arrays of functions or functions which post-process the output
 *     of run() calls
 * @return {Builder} current Builder instance
 */
Builder.prototype.postRun = function (var_args) {
  this._addHandlers.apply(this, ['post'].concat(arguments))
  return this
}

/**
 * Retrieve the profile data for this builder
 *
 * @return {Array.<{bucketTimestampMs:number, timings:Object}>} an array of profile data buckets,
 *     each of which contains a timestamp and a map of node names to their response time buckets
 */
Builder.prototype.getProfileData = function () {
  return this._profileData
}

/**
 * Add a new profiling bucket and shift the remaining buckets to the left
 */
Builder.prototype._shiftProfilers = function () {
  var profileDate = Math.floor(Date.now() / PROFILE_BUCKET_SIZE) * PROFILE_BUCKET_SIZE
  this._currentProfileData = {
    bucketDate: profileDate,
    timings: {}
  }

  this._profileData.push(this._currentProfileData)

  if (this._profileData.length > MAX_PROFILE_BUCKETS) this._profileData.shift()
}

/**
 * Retrieve a GraphViz node from a list of GraphViz nodes representing this Builder
 *
 * @param {Object} g the current Graphviz graph
 * @param {Object} nodes a list of nodes currently added to the Graphviz graph
 * @param {Array.<string>} inputNodes a list of nodes provided as input to this builder
 * @param {string} nodeName the name of the node to retrieve and/or add to the provided
 *     Graphviz graph
 * @param {boolean} isBuilder whether this node is the builder's own subgraph
 * @return {Object} a Graphviz node which can be referenced for adding edges between nodes
 */
Builder.prototype._getNodeFromDotGraph = function (g, nodes, inputNodes, nodeName, isBuilder) {
  // nodes that are passed in as inputs are red, implicitly created nodes are blue
  var rootNode = utils.getNodeRootName(nodeName)
  var color
  if (isBuilder) {
    color = 'green'
  } else if (inputNodes.indexOf(rootNode) !== -1) {
    color = 'red'
  } else {
    color = 'blue'
  }

  if (!nodes[nodeName]) {
    // set up the parent
    var parentNode, matches
    if (matches = nodeName.match(/^(.*)\.[^\.]+$/)) parentNode = this._getNodeFromDotGraph(g, nodes, inputNodes, matches[1])

    // if the node is a clone of another node, use the clone instead
    var compiledNode = this._compiled.nodes[nodeName]

    // if we ended up at an actual graph at the node, add it with its real name and look at any inputs
    if (compiledNode) {
      nodes[nodeName] = g.addNode(nodeName + ' (' + (isBuilder ? 'BUILDER OUTPUT' : this._compiled.nodes[nodeName].originalName) + ')', {color: color})

      // set up inputs
      for (var input in this._compiled.nodes[nodeName].inputs) {
        nodes[input] = this._getNodeFromDotGraph(g, nodes, inputNodes, this._compiled.nodes[nodeName].inputs[input])
        g.addEdge(nodes[input], nodes[nodeName])
        if (isBuilder) nodes[input].set("color", "orange")
      }
    } else {
      // if the node doesn't exist in the graph, add it
      nodes[nodeName] = g.addNode(nodeName, {color: color})
    }

    // create the connection between this node and its parent
    if (parentNode) {
      g.addEdge(parentNode, nodes[nodeName])
      if (parentNode === this._outputNodeName) nodes[nodeName].set("color", "orange")
    }
  }

  return nodes[nodeName]
}



/*****************************************************************************
 * Compile Phase
 *****************************************************************************/

/**
 * Reset the compiler data to a starting state
 */
Builder.prototype._initCompiler = function () {
  this._compiled = {
    nodes: {},
    inputLiterals: {},
    startingNodes: [],
    nodePrefixIdx: 0
  }
}

/**
 * Recursively create compilation data for all outputs
 */
Builder.prototype._compileOutputs = function () {
  // create a list of all nodes at the root of the builder
  var depManager = new DependencyManager(this._graph)
  var modifiers = {}
  var inputs = {}

  var key = this._outputNodeName
  var nodeRoot = utils.getNodeRootName(key)
  inputs[nodeRoot] = {}
  modifiers[nodeRoot] = []
  depManager.addNode(nodeRoot)

  // compile all needed nodes
  this._compilePeers(key, depManager, inputs, modifiers, true)
}

/**
 * Deduplicate nodes which have the exact same hash
 */
Builder.prototype._deduplicateNodes = function () {
  var hashNodes = {}
  var remappedNodes = {}
  var key, node, i, inputName, remappedNode

  // build up maps of all hashes to nodes and nodes to their duplicate nodes
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    if (!hashNodes[node.completeHash]) {
      hashNodes[node.completeHash] = node
    } else {
      remappedNodes[key] = hashNodes[node.completeHash]
    }
  }

  // remap dependencies
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]

    for (var inputKey in node.inputs) {
      inputName = node.inputs[inputKey]
      remappedNode = remappedNodes[utils.getNodeRootName(inputName)]
      if (remappedNode) {
        node.inputs[inputKey] = utils.swapNodeRoot(inputName, remappedNode.newName)
      }
    }
  }

  // delete nodes which shouldn't stick around
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    if (hashNodes[node.completeHash] !== node) {
      // remove the duplicate node
      delete this._compiled.nodes[key]
    }
  }
}

/**
 * Iterate through all nodes and create a list of required
 * member variables for graph reflection
 */
Builder.prototype._calculateRequiredMembers = function () {
  // iterate over all nodes
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]

    // loop through all inputs for a node
    for (var inputKey in node.inputs) {
      // find the input
      var input = node.inputs[inputKey]
      var inputRoot = utils.getNodeRootName(input)
      var inputNode = this._compiled.nodes[inputRoot]

      // if the input doesn't exist (may be an input to the graph)
      if (!inputNode) continue

      // if the input has all fields required, return '*'
      if (inputNode.requiredFields == '*') continue

      // if the input has a member getter
      if (inputRoot != input) {
        inputNode.requiredFields.push(input.substr(inputRoot.length + 1))
      } else {
        inputNode.requiredFields = '*'
      }
    }
  }
}

/**
 * Validate that all outputs of the builder have all dependencies met
 *
 * @param {Array.<string>} runInputs an array of inputs to the graph
 */
Builder.prototype._validateBuilder = function (runInputs) {
  var i
  runInputs = runInputs || []

  // if an array of runtime inputs was passed in, recurse through the nodes looking for any nodes
  // that are missing and check if they are in the list of inputs
  var foundNodes = {}
  var missingCallbacks = {}
  var missingNodes = {}
  var mismatchedParams = {}
  var nodesRequestedBy = {}
  var nodesToCheck = []

  // inline function for convenience as this is mostly for debugging purposes. Adds a node to a
  // list of nodes that need to be checked for existence and adds the requester of the node
  // for later retrieval
  function addNodeFromSource(nodeName, source) {
    var nodeNameRoot = utils.getNodeRootName(nodeName)
    if (!nodesRequestedBy[nodeNameRoot]) {
      nodesRequestedBy[nodeNameRoot] = {}
      nodesToCheck.push({name: nodeNameRoot, prefix: source})
    }
    nodesRequestedBy[nodeNameRoot][source] = true
  }

  // start checking with nodes that we know need to be built
  addNodeFromSource(this._outputNodeName, 'BUILDER')

  // loop until we can't loop no more
  while (nodesToCheck.length) {
    var node = nodesToCheck.shift()
    var nodeName = node.name
    var namePrefix = node.prefix + '->'
    var compiledNode = this._compiled.nodes[nodeName]


    if (compiledNode && compiledNode.fn) {
      var allInputNames = compiledNode.getAllInputNames()
      for (i = 0; i < allInputNames.length; i += 1) {
        addNodeFromSource(compiledNode.inputs[allInputNames[i]], namePrefix + compiledNode.originalName)
      }

      // Check nodes for correctly declared parameters
      if (this._config.enforceMatchingParams &&
          nodeName.indexOf(utils.NODE_PREFIX_BUILDER_OUTPUT) !== 0 &&
          !compiledNode.isSubgraph()) {

        var actualParams = utils.parseFnParams(compiledNode.fn)

        // argInputs contains the aliased arg names (params_x vs. params.x),
        // so lookup the full arg name to properly shorten it.
        var declaredParams = compiledNode.getArgumentInputNames().map(function (param) {
          var fullParamName = compiledNode.inputs[param]
          return utils.getNodeShortName(fullParamName)
        })

        var paramsEqual = actualParams.length === declaredParams.length &&
            actualParams.every(function (el, i) { return el === declaredParams[i] })

        if (!paramsEqual) {
          mismatchedParams[nodeName] = {
            actual: actualParams,
            declared: declaredParams
          }
        }
      }
    } else {
      if (compiledNode && !compiledNode.fn) missingCallbacks[nodeName] = true
      if (runInputs.indexOf(nodeName) === -1 && !MAGIC_NODE_NAMES[nodeName]) missingNodes[nodeName] = true
    }
  }

  // show any missing callbacks
  var missingCallbackKeys = Object.keys(missingCallbacks)
  if (missingCallbackKeys.length) {
    throw new Error(missingCallbackKeys.map(function missingCallback(nodeName) {
      return 'Node \'' + nodeName + '\' requires a callback'
    }).join('. '))
  }

  // show any missing nodes
  var missingNodeKeys = Object.keys(missingNodes)
  if (missingNodeKeys.length) {
    throw new Error(missingNodeKeys.map(function missingNode(nodeName) {
      return 'Node \'' + nodeName + '\' was not found and is required by [' + Object.keys(nodesRequestedBy[nodeName]).join(', ') + ']'
    }).join('. '))
  }

  // Show any nodes with mismatched params
  var mismatchedParamKeys = Object.keys(mismatchedParams)
  if (this._config.enforceMatchingParams && mismatchedParamKeys.length) {
    throw new Error(mismatchedParamKeys.map(function (name) {
      var err = 'Node "' + name + '" has mismatched parameters: declared [' +
          mismatchedParams[name].declared.join(', ') +
          '] but were actually [' +
          mismatchedParams[name].actual.join(', ') + '].'
      return err
    }).join('\n'))
  }
}

/**
 * Create resolver functions for every node in the graph
 */
Builder.prototype._initResolvers = function () {
  // compile all of the resolvers
  for (var key in this._compiled.nodes) {
    this._getResolver(key)
  }
}

/**
 * Create a function which will iterate through all inputs
 * to a graph node and create a map for graph output
 */
Builder.prototype._createOutputMapper = function () {
  var compiledOutputNode = this._compiled.nodes[this._outputNodeName]
  compiledOutputNode.fn = createOutputMapper(this._outputNode.getOutputNodeNames())
  compiledOutputNode.isOutput = true
}

/**
 * Iterate through all nodes and create a count of inputs
 * for every node and a list of dependent nodes for every node
 */
Builder.prototype._createInputMappings = function () {
  var foundInputs = {}

  // loop through all nodes
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]
    foundInputs[key] = {}

    // loop through all inputs for a node
    for (var inputKey in node.inputs) {
      var inputRoot = node.localNameToGlobal(inputKey)

      // already mapped a dependency from this node
      if (foundInputs[key][inputRoot]) continue

      // make sure the node exists
      var inputNode = this._compiled.nodes[inputRoot]
      if (!inputNode) continue

      if (node.isEvaluatedInput(inputKey)) {
        // add this node as an output
        foundInputs[key][inputRoot] = true
        inputNode.outputNodes.push(key)
        node.numUniqueInputs++
      } else {
        delete node.inputs[inputKey]
      }
    }
  }
}

/**
 * Moves input literals into an object to be copied from when
 * _run() is called (and skips function unnecessary function calls
  */
Builder.prototype._prepareInputlessLiterals = function () {
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]
    if (node.literalPromise && node.numUniqueInputs === 0 && node.outputNodes.length > 0) {
      this._compiled.inputLiterals[key] = node.literalValue
      node.isInput = true
      for (var i = 0; i < node.outputNodes.length; i++) {
        var nodeName = node.outputNodes[i]
        var outputNode = this._compiled.nodes[nodeName]
        outputNode.numUniqueInputs--
      }
    }
  }
}

/**
 * Remove any inputs to nodes which aren't used by the node
 * in the build stage (primarily used for .configure())
 */
Builder.prototype._removeUnusedInputs = function () {
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]
    for (var inputKey in node.inputs) {
      if (!node.isEvaluatedInput(inputKey)) {
        delete node.inputs[inputKey]
      }
    }
  }
}

/**
 * Remove any nodes which aren't the builder output and don't
 * have any outputs of their own
 */
Builder.prototype._removeOutputlessNodes = function () {
  var found
  do {
    found = false
    for (var key in this._compiled.nodes) {
      if (key == this._outputNodeName) continue
      var node = this._compiled.nodes[key]
      if (!node.outputNodes.length) {
        for (var inputKey in node.inputs) {
          var inputRoot = node.localNameToGlobal(inputKey)
          var inputNode = this._compiled.nodes[inputRoot]
          if (inputNode) {
            inputNode.numUniqueOutputs--
            for (var i = 0; i < inputNode.outputNodes.length; i++) {
              if (inputNode.outputNodes[i] === key) {
                inputNode.outputNodes.splice(i, 1)
                i--
              }
            }
          }
        }
        delete this._compiled.nodes[key]
        found = true
      }
    }
  } while (found)
}

/**
 * Find all nodes which don't have any inputs from the graph
 */
Builder.prototype._findStartingNodes = function () {
  var nonStartingNodes = []
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]
    if (node.numUniqueInputs === 0 && !node.isInput) {
      this._compiled.startingNodes.push(key)
    }
  }
}

/**
 * Generate hashes for every node in the graph
 */
Builder.prototype._generateHashesForNodes = function () {
  var originalNames = {}
  var uniqueId = 0
  var idProvider = function () {
    return ++uniqueId
  }
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]
    if (node) {
      node.generateHashes(this._compiled.nodes, originalNames, idProvider)
    }
  }
}

/**
 * Prioritize the graph.
 *
 * If d is a regular dependency, and d has an important peer (e.g., !require-authorized),
 * then we should re-write the graph so that d depends on that peer.
 *
 * We do this in two steps: assign each node a priority, and then, if
 * d has an important peer p, add the peer as a dependency iff priority(d) < priority(p).
 */
Builder.prototype._prioritizeGraph = function () {
  this._setPrioritiesRecursive(this._compiled.nodes[this._outputNodeName], 256, {})
  this._addImportantDependenciesForNode(this._compiled.nodes[this._outputNodeName], [], {})
}

/**
 * Recursively set priorities.
 *
 * This post describes this algorithm in more detail, and proves its correctness.
 * https://hatch.dm/p/2e7370465cf8
 *
 * @param {CompiledNode} node
 * @param {boolean} importantBonus
 * @param {Object} visited
 */
Builder.prototype._setPrioritiesRecursive = function (node, importantBonus, visited) {
  // TODO(nick): This looks very similar to addImportantDependenciesForNode.
  // We should probably have a higher-order graph-traversal method.
  var i, inputNode, changed

  visited[node.newName] = true

  var hasImportantPeers = false
  var importantInputNames = node.getImportantInputGlobalNames()
  for (i = 0; i < importantInputNames.length; i++) {
    inputNode = this._compiled.nodes[importantInputNames[i]]
    if (inputNode) {
      if (!hasImportantPeers) {
        hasImportantPeers = true
        importantBonus = importantBonus / 2
      }
      changed = inputNode.raisePriority(node.getPriority() + importantBonus)
      if (changed || !visited[inputNode.newName]) {
        this._setPrioritiesRecursive(inputNode, importantBonus, visited)
      }
    }
  }

  var normalInputNames = node.getNormalInputGlobalNames()
  for (i = 0; i < normalInputNames.length; i++) {
    inputNode = this._compiled.nodes[normalInputNames[i]]
    if (inputNode) {
      changed = inputNode.raisePriority(node.getPriority())
      if (changed || !visited[inputNode.newName]) {
        this._setPrioritiesRecursive(inputNode, importantBonus, visited)
      }
    }
  }
}

/**
 * Recursively add important dependencies to nodes to preserve
 * ordering of important vs non-important dependencies
 *
 * @param {CompiledNode} node
 * @param {Array.<CompiledNode>} deps the important dependencies to add
 * @param {Object} visited
 */
Builder.prototype._addImportantDependenciesForNode = function (node, deps, visited) {
  var i, inputName, inputRootName, inputNode

  var changed = false
  for (i = 0; i < deps.length; i++) {
    var depNode = deps[i]
    var depName = depNode.newName
    var found = false
    for (inputName in node.inputs) {
      inputRootName = node.localNameToGlobal(inputName)
      if (inputRootName == depName) {
        found = true
      }
    }
    if (!found && depNode.getPriority() > node.getPriority()) {
      node.addImplicitImportantInput(depName)
      changed = true
    }
  }

  if (!changed && visited[node.newName]) return
  visited[node.newName] = true

  var childDeps = []
  var importantInputNames = node.getImportantInputLocalNames()
  for (i = 0; i < importantInputNames.length; i++) {
    inputRootName = node.localNameToGlobal(importantInputNames[i])
    inputNode = this._compiled.nodes[inputRootName]
    if (inputNode) {
      if (!node.isImplicitImportantInput(importantInputNames[i])) {
        this._addImportantDependenciesForNode(inputNode, deps, visited)
      }
      childDeps.push(inputNode)
    }
  }


  var normalInputNames = node.getNormalInputGlobalNames()
  for (i = 0; i < normalInputNames.length; i++) {
    inputNode = this._compiled.nodes[normalInputNames[i]]
    if (inputNode) {
      this._addImportantDependenciesForNode(inputNode, childDeps, visited)
    }
  }
}

/**
 * Remove important dependencies for node which their important dependencies already depend on
 */
Builder.prototype._removeDuplicateDependencies = function () {
  this._compiled.nodes[this._outputNodeName].generateRecursiveInputs(this._compiled.nodes)
}

/**
 * Remove fields from the compiled nodes which are only needed for the compilation steps
 */
Builder.prototype._reduceNodeOverhead = function () {
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]

    delete node.allInputs
    delete node.completeHash
    delete node._recursiveInputs
  }
}

/**
 * Generate the failure chain for a node and all of its dependencies
 *
 * @param {string} nodeName
 * @param {Array.<string>} failureChain an array of originalNames
 * @param {Object} callerNode the compiled caller node
 */
Builder.prototype._generateRecursiveFailureChainForNode = function (nodeName, failureChain, callerNode) {
  var node = this._compiled.nodes[nodeName]
  if (!node) return

  if (node.failureChain) {
    if (callerNode) node.callers.push(callerNode.originalName)
    return
  }

  failureChain.push(node.originalName)

  node.failureChain = failureChain.concat()
  node.failureChain.reverse()

  node.callers = callerNode ? [callerNode.originalName] : []

  for (var key in node.inputs) {
    if (!node.isImplicitImportantInput(key)) {
      this._generateRecursiveFailureChainForNode(node.localNameToGlobal(key), failureChain, node)
    }
  }

  failureChain.pop()
}

/**
 * Build lists of failure chains and callers for every node
 */
Builder.prototype._buildFailureChains = function () {
  this._generateRecursiveFailureChainForNode(this._outputNodeName, [], null)
}

/**
 * Perform the compile internally. May throw an error and leave
 * the builder in an inconsistent state.
 * @param {Array.<string>=} runInputs See #compile
 */
Builder.prototype._compileUnsafe = function (runInputs) {
  runInputs = runInputs || this._config.compileInputs || []

  var key, subkey, i, j, node

  // reset the compilation data
  this._initCompiler()

  // recurse through the graph and create an unoptimized map of all nodes and their deps
  this._compileOutputs()

  // remove any unused inputs (from configured)
  this._removeUnusedInputs()

  // rewrite the graph so that non-important nodes execute after their important peers.
  this._prioritizeGraph()

  // hash
  this._generateHashesForNodes()

  // deduplicate all nodes with the exact same hash
  this._deduplicateNodes()

  // set up required fields for all nodes
  this._calculateRequiredMembers()

  // validate the builder has all needed inputs and looks kosher
  this._validateBuilder(runInputs)

  // remove any dependencies which are already a dependency of child
  this._removeDuplicateDependencies()

  // set up the aggregator function for the output
  this._createOutputMapper()

  // create mappings of all nodes to their inputs and vice versa
  this._createInputMappings()

  // init the resolvers for future fetching
  this._initResolvers()

  // move any literals which have no inputs into the object to copy
  if (!this._config.enforceTypes) this._prepareInputlessLiterals()

  // remove any nodes that aren't the output and don't have outputs of their own
  this._removeOutputlessNodes()

  // create mapping of all nodes with no inputs
  this._findStartingNodes()

  // build failure chains for every node
  this._buildFailureChains()

  // remove unnecessary node information
  this._reduceNodeOverhead()

  // LEAVING THIS HERE FOR DEBUGGING
  // console.log(this._compiled.nodes)

  return this
}

/**
 * Iterate over all args passed in to this node and rename them if they were passed in as
 * peers and set up dependencies for later compilation.
 *
 * @param {DependencyManager} depManager the dependency manager to use for setting up dependencies
 * @param {NodeDefinition} def the definition of the node to setup arg nodes for
 * @param {Object} nodeInputs a mapping of node names to maps of arguments to
 *     their input node names
 * @param {Object} peers a mapping of peer names to their compiled (data) representations
 * @param {Array.<InputMetadata>} inputMetadata
 * @return {Object} a map of aliased node names to the Graph nodes that they actually represent
 */
Builder.prototype._setupArgumentsForNode = function (depManager, def, nodeInputs, peers, inputMetadata) {
  // create a map of the default arguments to this node
  var args = {}
  for (var i = 0; i < def.getArgs().length; i += 1) {
    var argNode = def.getArgs()[i]
    var argAliasRealName = argNode.aliasRealName

    // Partial nodes are only used for configuration of their peers.
    // They are not inputs to the parent node.
    var isImportant = argNode.isImportant()
    var isVoid = argNode.isVoid()
    if (!argNode.isPartial()) {
      inputMetadata.push(
          new InputMetadata(argAliasRealName)
          .setImportant(isImportant)
          .setArgument(!isImportant && !isVoid))
    }

    if (nodeInputs[argAliasRealName]) {
      var inputNode = nodeInputs[argAliasRealName]
      var inputRootNode = utils.getNodeRootName(inputNode)

      // check for a peer with a matching root node
      if (peers[inputRootNode]) {
        // swap out the root nodes if a peer was found
        args[argAliasRealName] = utils.swapNodeRoot(inputNode, peers[inputRootNode].newName)
      } else {
        // no peer was found, use normal input
        args[argAliasRealName] = inputNode
      }

      delete nodeInputs[argAliasRealName]
    } else {
      args[argAliasRealName] = utils.swapNodeRoot(argNode.fullName, argAliasRealName)
      var argObj = {}
      argObj[argAliasRealName] = argNode.rootName
      depManager.addNode(argObj)
    }
  }

  return args
}

/**
 * Iterate over all nodes provided to the current node via .builds() and setup
 * dependencies between those nodes as well as defining any modifiers that need
 * to be ran as defined by this node
 *
 * @param {NodeDefinition} def the definition of the node to setup arg nodes for
 * @param {DependencyManager} depManager the dependency manager to use for setting up dependencies
 * @param {Object} args a map of input args as aliased node names to the Graph nodes that they
 *     actually represent
 * @param {Object} peers a mapping of peer names to their compiled (data) representations
 * @return {{provideMap:Object, modifierMap:Object}} an object containing
 *     provideMap (a map of nodes to any inputs that have been defined as
 *     dependencies) and modifierMap (a map of nodes to any modifiers that
 *     have been defined as dependencies)
 */
Builder.prototype._setupChildNodes = function (def, depManager, args, peers) {
  var i, j, k
  var provideMap = {}
  var modifierMap = {}
  var scope = def.getScope()

  // set up nodes for any fields that need to be built
  for (i = 0; i < def.getBuilds().length; i += 1) {
    var toBuild = def.getBuilds()[i]
    var toBuildNode = toBuild.field

    if (utils.isPrivateNode(toBuildNode.rootName)) {
      var buildDef = this._graph._nodeDefinitions[toBuildNode.rootName]
      if (buildDef.getScope() !== scope) {
        throw new Error(
          "Unable to access node '" +
          toBuildNode.rootName + "' in scope '" + buildDef.getScope() + "'" +
          " from node '" + buildDef.getName() + "' in scope '" + scope + "'")
      }
    }

    var field = toBuildNode.getAliasRootName()

    depManager.addNode(field)
    if (!provideMap[field]) provideMap[field] = {}
    if (!modifierMap[field]) modifierMap[field] = []

    for (j = 0; j < toBuild.provides.length; j += 1) {
      var provided = utils.getNodeInfoFromInput(this._graph, toBuild.provides[j])
      var nodeName, nodeRoot, newRootNode

      if (utils.isWildcardArgRef(provided.nodeName)) {
        var buildInfo = toBuild.field
        var nodeToBuildInputs = this._graph._nodeDefinitions[buildInfo.rootName]._inputArgs
        var currentInputs = this._graph._nodeDefinitions[def.getName()]._inputArgs

        for (k = 0; k < currentInputs.length; k++) {
          var inputName = currentInputs[k]
          if (nodeToBuildInputs.indexOf(inputName) !== -1) {
            // node takes an argument that was passed into this node
            nodeName = inputName
            nodeRoot = utils.getNodeRootName(nodeName)
            newRootNode = args[nodeRoot]
            if (peers[newRootNode]) newRootNode = peers[newRootNode].newName
            provideMap[field][inputName] = utils.swapNodeRoot(inputName, newRootNode)
          }
        }

      } else if (utils.isArgRef(provided.nodeName)) {
        // node takes an argument that was passed into this node
        nodeName = utils.getArgRef(provided.nodeName)
        nodeRoot = utils.getNodeRootName(nodeName)

        newRootNode = args[nodeRoot]
        if (!newRootNode) throw new Error("Unable to find node '" + provided.nodeName + "' (passed from '" + def.getName() + "' to '" + toBuild.field.aliasRealName + "')")
        if (peers[newRootNode]) newRootNode = peers[newRootNode].newName
        provideMap[field][provided.arg] = utils.swapNodeRoot(nodeName, newRootNode)

      } else {
        // build a new node (as a peer)
        var provideRootNode = utils.getNodeRootName(provided.nodeName)
        provideMap[field][provided.arg] = provided.nodeName
        depManager.addDependency(field, provideRootNode)
      }
    }
  }

  return {
    provideMap: provideMap,
    modifierMap: modifierMap
  }
}

/**
 * Compile a node within a given peer group (define the inputs, hash, and handler)
 *
 * @param {string} originalNodeName the original node name as provided to NodeDefinition
 * @param {string} newNodeName the name to write the node to
 * @param {Object} peers a mapping of peer names to their compiled (data) representations
 * @param {Object} nodeInputs a mapping of input arguments to their remapped names
 * @param {string} ownerName The name of the owner, for debugging purposes.
 * @return {Object} a compiled (data) representation of the node
 */
Builder.prototype._compileNode =
    function (originalNodeName, newNodeName, peers, nodeInputs, ownerName) {
  var def = this._graph._nodeDefinitions[originalNodeName]
  var key, subkey, i, j

  // if no definition exists, expect that this is an input into the builder at run time
  if (!def) {
    return {
      originalName: originalNodeName
    , newName: originalNodeName
    }
  }

  // create a map of node deps for children
  var depManager = new DependencyManager(this._graph)
  var inputs = {}
  var modifiers = []
  var inputMetadata = []

  // determine where the input args from this node are actually coming from (peers, other nodes, etc)
  var args = this._setupArgumentsForNode(depManager, def, nodeInputs, peers, inputMetadata)

  // add any remaining nodes as important inputs
  for (key in nodeInputs) {
    var nodeRealName = utils.getNodeRealName(nodeInputs[key])
    var nodeRealRootName = utils.getNodeRootName(nodeRealName)
    if (peers[nodeRealRootName]) {
      nodeRealName = utils.swapNodeRoot(nodeRealName, peers[nodeRealRootName].newName)
    }
    inputs[key] = peers[nodeRealName] ? peers[nodeRealName].newName : nodeRealName
    inputMetadata.push(new InputMetadata(key).setImportant(true))
  }

  // read through any nodes that need to be built by this node and set up their inter-dependencies
  var childData = this._setupChildNodes(def, depManager, args, peers)

  // compile the child nodes
  var children = this._compilePeers(originalNodeName, depManager, childData.provideMap, childData.modifierMap, false)
  for (key in args) {
    var rootNode = utils.getNodeRootName(args[key])
    if (children[rootNode]) inputs[key] = utils.swapNodeRoot(args[key], children[rootNode].newName)
    else inputs[key] = args[key]
  }

  // create the node
  return this._compiled.nodes[newNodeName] = new CompiledNode(
      this._graph, this._config, originalNodeName, newNodeName, inputs,
      inputMetadata, def, ownerName)
}

/**
 * Takes a given set of nodes that all exist within the same context and builds
 * them all as a single group of "peers". Any nodes provided to .builds() within
 * a single Builder or a NodeDefinition are considered peers. This function
 * optimizes ordering of the peers such that each peer is built based on the
 * ordering of dependencies
 *
 * @param {string} ownerName The name of the owner, for debugging purposes.
 * @param {DependencyManager} depManager a map of the dependencies that should
 *     be compiled as peers
 * @param {Object} nodeInputs a mapping of node names to maps of arguments to
 *     their input node names
 * @param {Object} nodeModifiers a mapping of node names to arrays of modifiers
 * @param {boolean} isBuilder whether this compile is at the topmost level of a
 *     Builder
 * @return {Object} a mapping of all nodes that were built to their compiled data
 */
Builder.prototype._compilePeers = function (ownerName, depManager, nodeInputs, nodeModifiers, isBuilder) {
  var i
  var nodeSuffix = isBuilder ? '' : '-peerGroup' + (++this._compiled.nodePrefixIdx)
  var peers = {}
  var compiledAnyNode, compiledCurrentNode, key, subkey
  var depsToBuild = {}

  var aliases = depManager.getAliases()
  for (i = 0; i < aliases.length; i += 1) depsToBuild[aliases[i]] = true

  // keep looping until no more nodes are found that can be processed
  do {
    compiledAnyNode = false

    // loop through all nodes that haven't been compiled and initially mark as compilable
    for (key in depsToBuild) {
      var nodeName = utils.getNodeRootName(depManager.getNodeName(key))
      var deps = depManager.getDependencies(key)

      compiledCurrentNode = true

      for (i = 0; i < deps.length; i += 1) {
        // if a peer dependency doesn't exist, mark the node as uncompilable
        if (!peers[deps[i]]) compiledCurrentNode = false
      }

      if (compiledCurrentNode) {
        // compile the node and remove it from the list to be compiled
        compiledAnyNode = true;
        delete depsToBuild[key]
        peers[key] = this._compileNode(nodeName, key + nodeSuffix, peers, utils.clone(nodeInputs[key] || {}), ownerName)
      }
    }

  } while (compiledAnyNode)

  return peers
}



/*****************************************************************************
 * Run Phase
 *****************************************************************************/

/**
 * Profile a specific node request
 *
 * @param {string} key the node name
 * @param {number} msStart the start time of the node resolution
 */
Builder.prototype._profile = function (key, msStart) {
  var msBucket = roundToOneSigFig(Date.now() - msStart)
  if (String(msBucket) == 'NaN') console.log(msStart, Date.now())
  var dataBucket = this._currentProfileData

  if (!dataBucket.timings[key]) dataBucket.timings[key] = {}
  if (!dataBucket.timings[key][msBucket]) dataBucket.timings[key][msBucket] = 0

  dataBucket.timings[key][msBucket]++
}

/**
 * Add a variable number of handlers to this Builder at a given
 * stage of the build process
 *
 * @param {string} stage
 * @param {Array.<function(Object)>} fns handler functions
 */
Builder.prototype._addHandlers = function (stage, fns) {
  for (var i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      this._addHandler.apply(this, [stage].concat(fns[i]))
    } else {
      this._handlers[stage].push(fns[i])
    }
  }
}

/**
 * Run this builder and produce output
 *
 * @param {Object} inputData
 * @return {Promise.<Object>} a promise with the output of the builder
 */
Builder.prototype._run = function (inputData) {
  this.compile(Object.keys(inputData || {}))

  // create a clean object for running this build
  var data = new GraphResults(inputData, this._config, this._name)

  // creates a single inline function which can be used to call any function with the data as the only arg
  data.fnWrapper = function (fn) {
    return function fnWrapper() {
      fn(data)
    }
  }

  // add input literals
  for (var key in this._compiled.inputLiterals) {
    data._values[key] = this._compiled.inputLiterals[key]
  }

  // loop through all starting nodes and resolver
  var i
  for (i = 0; i < this._compiled.startingNodes.length; i++) {
    this._getResolver(this._compiled.startingNodes[i])(data)
  }

  return data.getPromise()
}

/**
 * Get the on success handler for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object, Object)} the onSuccess handler. first parameter is the
 *     response; second is the context
 */
Builder.prototype._getSuccessHandler = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var config = this._config
  var profiler = this._boundProfiler

  // type information for type validation
  var enforceTypes = node.type != utils.NODE_PREFIX_AGGREGATOR_RETURN_VAL
    && node.type != utils.NODE_PREFIX_BUILDER_OUTPUT
    && this._config.enforceTypes
  var type = enforceTypes && this._types[node.type]
  var isArray = typeof type != 'undefined' && Array.isArray(type)
  if (isArray) type = type[0]

  return function onSuccess(response, data) {
    if (enforceTypes) {
      if (typeof type == 'undefined') {
        // types are required
        handleTypeError(enforceTypes, "Type '" + node.type + "' is unknown for node '" + node.originalName + "'")

      } else {
        var err

        if (isArray && !Array.isArray(response)) {
          handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be an array")
        } else if (type != '*'){
          // build an array of values to check
          var checkArray = isArray ? response : [response]

          // check that each value looks good
          for (var i = 0; !err & i < checkArray.length; i++) {
            var val = checkArray[i]

            if (typeof val == 'undefined' || val === null) continue

            if (type === Boolean) {
              if (!typ.isBoolean(val)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be a boolean")

            } else if (type === Number) {
              if (!typ.isNumber(val)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be a number")

            } else if (type === String) {
              if (!typ.isString(val)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be a string")

            } else if (type === Object) {
              if (Array.isArray(val)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be a non-array object")
              if (!typ.isObject(val)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be an object")

            } else {
              if (!(val instanceof type)) handleTypeError(enforceTypes, "Response for '" + node.originalName + "' must be an instance of custom type: " + JSON.stringify(type))

            }
          }
        }
      }
    }


    if (data._startTimes[nodeName]) profiler(node.originalName, data._startTimes[nodeName])
    if (config.freezeOutputs && !node.isPrivate()) {
      deepFreeze(response)
    }
    data.setNodeResult(node, response)
  }
}

/**
 * Get the on complete handler for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object, Object)} the onComplete handler. first parameter is the
 *     response; second is the context
 */
Builder.prototype._getCompleteHandler = function (nodeName) {
  var nodes = this._compiled.nodes
  var node = this._compiled.nodes[nodeName]
  var resolvers = {}
  for (var i = 0; i < node.outputNodes.length; i++) {
    var outputNodeName = node.outputNodes[i]
    resolvers[outputNodeName] = this._getResolver(outputNodeName)
  }

  return function onComplete(response, data) {
    if (node.isOutput) {
      data.resolveOutputNode(nodeName)
      return
    }

    var nextNodes = []
    for (var i = 0; i < node.outputNodes.length; i++) {
      // increment the input count for the output node
      var outputNodeName = node.outputNodes[i]
      if (!data._numResolvedInputs[outputNodeName]) data._numResolvedInputs[outputNodeName] = 1
      else data._numResolvedInputs[outputNodeName]++

      var outputNode = nodes[outputNodeName]

      if (outputNode.numUniqueInputs === data._numResolvedInputs[outputNodeName]) {
        // if a node is ready to be built, add it to the list of next nodes
        nextNodes.push(outputNodeName)
      }
    }

    // if there are multiple nodes to build, build them on nextTick
    for (var i = 0; i < nextNodes.length; i++) {
      process.nextTick(data.fnWrapper(resolvers[nextNodes[i]]))
    }
  }
}

/**
 * Create a important input validator for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object)} the important input validator which will return an error
 *     if a quiet input has failed
 */
Builder.prototype._getQuietInputValidator = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var quietInputNames = node.getQuietInputNames()
  if (!quietInputNames.length) return undefined

  return function importantInputValidator(data) {
    var err

    // make sure all important inputs worked
    for (var i = 0; i < quietInputNames.length && !err; i++) {
      var inputName = node.inputs[quietInputNames[i]]
      var inputRootName = utils.getNodeRootName(inputName)
      if (data._errors[inputRootName]) {
        err = data._errors[inputRootName]
      } else if (inputName != inputRootName) {
        try {
          var val = getChildGetter(inputName)(data.getResult(inputRootName, node))
        } catch (e) {
          err = e
        }
      }
    }

    return err
  }
}

/**
 * Create a non-important input validator for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object, Array)} the non-important input validator which
 *     will return an error if a important input has failed. Modifies the array
 *     of arguments in place for consumption by the resolvers
 */
Builder.prototype._getArgumentInputValidator = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var argInputs = node.getArgumentInputNames()
  if (!argInputs.length) return undefined

  return function nonImportantInputValidator(data, args) {
    var err, val

    // grab all arg inputs
    for (var i = 0; i < argInputs.length && !err; i++) {
      var inputName = node.inputs[argInputs[i]]
      var inputRootName = utils.getNodeRootName(inputName)

      if (inputName == '_requiredFields') {
        err = undefined
        val = node.requiredFields
      } else {
        err = data._errors[inputRootName]
        val = data.getResult(inputRootName, node)
      }

      if (!err && typeof val === 'undefined' && !data.hasResult(inputRootName)) {
        err = new Error("Unable to find node '" + inputRootName + "'")
      }

      if (!err && inputName != inputRootName) {
        try {
          val = getChildGetter(inputName)(val)
        } catch (e) {
          err = e
        }
      }

      if (node.hasGettersEnabled) {
        var wrapper = new NodeResponseGetter()
        if (data._errors[inputRootName]) wrapper.setError(data._errors[inputName])
        else wrapper.setValue(val)
        args.push(wrapper)
        err = undefined

      } else if (!err) {
        args.push(val)
      }
    }

    return err
  }
}

/**
 * Get the error handler for a graph node
 *
 * @param {string} nodeName
 * @return {function(Error, Object)} takes error as the first param and
 *     the context as the second
 */
Builder.prototype._getErrorHandler = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  return function onError(e, data) {
    if (!e.graphInfo) {
      e.graphInfo = data.getDebugContext(node)
    }
    data.setNodeError(node, e)
  }
}

/**
 * Generate the resolver for a node given a method to extract the value
 *
 * @param {string} nodeName
 * @param {function(CompiledNode, Array.<NodeResponseGetter|Object>) : Promise} resolveNodeFn
 *     The function used to determine how to extract the node value.
 * @return {function(GraphResults)} A function that resolves the node given
 *     the GraphResults so far.
 */
Builder.prototype._genResolver = function (nodeName, resolveNodeFn) {
  var node = this._compiled.nodes[nodeName]

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateQuietInputs = this._getQuietInputValidator(nodeName)
  var validateArgumentInputs = this._getArgumentInputValidator(nodeName)

  return function resolve(data) {
    var err
    var args = []

    if (validateQuietInputs) err = validateQuietInputs(data)
    if (validateArgumentInputs && !err) err = validateArgumentInputs(data, args)

    if (!err && data._shouldProfile) data._startTimes[nodeName] = Date.now()

    var result
    if (!err) {
      try {
        result = data.getHashedResult(node) || resolveNodeFn(node, args)
      } catch (e) {
        err = e
      }
    }

    // TODO(kyle): Change this once kew has been updated
    // if (Q.isPromise(result)) {
    if (result && result._isPromise) {
      Q.resolve(result)
        .setContext(data)
        .then(onSuccess)
        .fail(onError)
        .then(onComplete)
        .clearContext()
      return
    }

    // onSuccess throws if there's a Shepherd type error
    try {
      if (!err) onSuccess(result, data)
    } catch (e) {
      err = e
    }

    if (err) onError(err, data)
    onComplete(result, data)
  }
}

/**
 * Resolve a literal
 *
 * @param {CompiledNode} node The node to resolve
 * @param {Array.<NodeResponseGetter|Object>} args The argument inputs
 * @return {Promise.<Object>} The result of the resolved node
 */
Builder.prototype._resolveLiteral = function (node, args) {
  return node.literalPromise
}

/**
 * Resolve a subgraph
 *
 * @param {CompiledNode} node The node to resolve
 * @param {Array.<NodeResponseGetter|Object>} args The argument inputs
 * @return {Object} The result of the resolved node
 */
Builder.prototype._resolveSubgraph = function (node, args) {
  return args[args.length - 1]
}

/**
 * Resolve an array wrapper
 *
 * @param {CompiledNode} node The node to resolve
 * @param {Array.<NodeResponseGetter|Object>} args The argument inputs
 * @return {Object} The result of the resolved node
 */
Builder.prototype._resolveArray = function (node, args) {
  return args
}

/**
 * Resolve a node without callbacks
 *
 * @param {CompiledNode} node The node to resolve
 * @param {Array.<NodeResponseGetter|Object>} args The argument inputs
 * @return {Object} The result of the resolved node
 */
Builder.prototype._resolveNonCallback = function (node, args) {
  return node.fn.apply(null, args)
}

/**
 * Resolve a node with callbacks
 *
 * @param {CompiledNode} node The node to resolve
 * @param {Array.<NodeResponseGetter|Object>} args The argument inputs
 * @return {Promise.<Object>|Object} The result of the resolved node
 */
Builder.prototype._resolveCallback = function (node, args) {
  var defer = Q.defer()
  args.push(defer.makeNodeResolver())
  var response = node.fn.apply(null, args)
  return typeof response == 'undefined' ? defer.promise : response
}

/**
 * Creates a resolver for a node which will return the value of a node
 * given a particular context
 *
 * @param {string} nodeName
 * @return {function({context: Object})}
 */
Builder.prototype._getResolver = function (nodeName) {
  nodeName = utils.getNodeRealName(nodeName)

  // return the resolver if it already exists
  var resolver = this._resolvers[nodeName]
  if (resolver) return resolver

  var node = this._compiled.nodes[nodeName]
  var config = this._config

  var nodeResolverFn
  if (node.literalPromise) {
    nodeResolverFn = this._resolveLiteral
  } else if (node.isSubgraph()) {
    nodeResolverFn = this._resolveSubgraph
  } else if (node.isArrayWrapper()) {
    nodeResolverFn = this._resolveArray
  } else if (!config.useCallbacks) {
    nodeResolverFn = this._resolveNonCallback
  } else {
    nodeResolverFn = this._resolveCallback
  }

  return this._resolvers[nodeName] = this._genResolver(nodeName, nodeResolverFn)
}

module.exports = Builder

/**
 * Read in a type error message and either throw an error or warn
 * @param  {string} enforceTypes the level at which to enforce typing
 * @param  {string} err the error message
 */
function handleTypeError(enforceTypes, err) {
  if (enforceTypes == utils.ErrorMode.ERROR) {
    throw new Error(err)
  } else if (enforceTypes == utils.ErrorMode.WARN) {
    console.warn(err)
    console.trace()
  }
}

/**
 * Run a callback function in a provided scope on success of a builder .run()
 *
 * @param  {Object} data the response data
 * @param  {{scope: Object, callback: function(Error, Object)}} context the callback context
 */
function onRunSuccess(data, context) {
  context.callback.call(context.scope, undefined, data)
}

/**
 * Run a callback function in a provided scope on failure of a builder .run()
 *
 * @param  {Object} data the response data
 * @param  {{scope: Object, callback: function(Error, Object)}} context the callback context
 */
function onRunFailure(e, context) {
  context.callback.call(context.scope, e)
}

/**
 * Round a number to a single significant figure
 *
 * @param {Number} num the number to round
 * @return {number} the number rounded to a single sig fig
 */
function roundToOneSigFig(num) {
  if (num === 0) return num
  var mult = Math.pow(10,
        1 - Math.floor(Math.log(num) / Math.LN10) - 1);
  return Math.floor(num * mult) / mult;
}

/**
 * Create and cache a function to create a function as the getter part
 * of a member getter
 *
 * @param {Array.<string>} fullName parts the name of the child split by '.'
 * @return {function(Object)}
 */
function getChildGetter(fullName) {
  if (childGetters[fullName]) {
    return childGetters[fullName]
  }
  var parts = fullName.split('.')
  parts.shift()

  return childGetters[fullName] = function childGetter(result) {
    for (var i = 0; i < parts.length; i += 1) {
      if (!result) return result
      result = result[parts[i]]
    }
    return result
  }
}

/**
 * Creates a function which takes in a list of arguments
 * and returns an object using the provided arg names
 *
 * @param {Array.<string>} argNames
 * @return {function()}
 */
function createOutputMapper(argNames) {
  return function outputMapper() {
    var outputObj = {}
    for (var i = 0; i < argNames.length; i++) {
      var name = argNames[i]
      outputObj[name] = arguments[i]
    }
    return outputObj
  }
}

/**
 * Deep freeze an object
 *
 * @param {Object} data
 * @return {Object}
 */
function deepFreeze(data) {
  if (typeof data == 'object') utils.deepFreeze(data)
  return data
}

/**
 * Utility function to generate a hash for an input string
 *
 * @param  {string} str the input string
 * @return {string} the generated hash
 */
function createHash(str) {
  return xxhash.hash(new Buffer(str), 0xCAFEBABE)
}
