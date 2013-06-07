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
var ConditionalError = require('./ConditionalError')
var DependencyManager = require('./DependencyManager')
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

// bits for the different hash types
var HASH_TYPE_COMPLETE = 1
var HASH_TYPE_NON_SILENT = 2
var HASH_TYPE_ALL = HASH_TYPE_COMPLETE | HASH_TYPE_NON_SILENT

// hash of magic strings that never name real nodes.
var MAGIC_NODE_NAMES = {
  _requiredFields: true
}

// list of fields to ignore from the hasher
var IGNORED_HASH_NODES = {
  originalName: HASH_TYPE_ALL,
  newName: HASH_TYPE_ALL,
  inputs: HASH_TYPE_ALL,
  fn: HASH_TYPE_ALL,
  requiredFields: HASH_TYPE_ALL,
  outputNodes: HASH_TYPE_ALL,
  literalValue: HASH_TYPE_ALL,
  numUniqueInputs: HASH_TYPE_ALL,
  isArrayWrapper: HASH_TYPE_ALL,
  isSubgraph: HASH_TYPE_ALL,
  cacheDisabled: HASH_TYPE_ALL,
  isConditional: HASH_TYPE_ALL,
  isSilent: HASH_TYPE_ALL,
  isPrivate: HASH_TYPE_ALL,
  silentOutputs: HASH_TYPE_ALL,
  silentInputs: HASH_TYPE_ALL,
  argInputs: HASH_TYPE_ALL,
  completeHash: HASH_TYPE_ALL,
  nonSilentHash: HASH_TYPE_ALL,
  implicitInputs: HASH_TYPE_ALL,

  silentHashes: HASH_TYPE_NON_SILENT
}

// default handler function to allow the compile step to finish without yelling,
// will be overridden by the compiler itself
var DEFAULT_HANDLER_FUNCTION = function defaultHandler() {
  throw new Error("Builder handler function should be overridden at compile time")
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
  this._name = name
  this._description = null

  this._profileData = []
  this._currentProfileData = null
  this._profilingInterval = null

  this._outputNodeName = graph.addBuilderHandler(this, DEFAULT_HANDLER_FUNCTION)
  this._outputNode = graph.getNode(this._outputNodeName)

  this._graph = graph
  this._builds = {}
  this._silentBuilds = {}
  this._resolvers = {}
  this._uniqueHashIdx = 1

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
 * Retrieve a list of all node names to be built silently for this builder
 *
 * @return {Array.<string>} list of silent output node names
 */
Builder.prototype.getSilentOutputs = function () {
  return Object.keys(this._silentBuilds)
}

/**
 * Retrieve a list of all node names to be built and returned for this builder
 *
 * @return {Array.<string>} list of returned output node names
 */
Builder.prototype.getOutputs = function () {
  return Object.keys(this._builds)
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
  return this.builds(utils.OUTPUT_PREFIX_OPTIONAL + field)
}

/**
 * Proxy function to handle conditional logic for the builder's
 * NodeDefinition instance
 *
 * @return {NodeDefinition} the output node for this builder
 */
Builder.prototype.define = function (field) {
  return this._outputNode.define(field)
}

/**
 * Proxy function to handle conditional logic for the builder's
 * NodeDefinition instance
 *
 * @return {NodeDefinition} the output node for this builder
 */
Builder.prototype.when = function (field) {
  return this._outputNode.when(field)
}

/**
 * Proxy function to handle conditional logic for the builder's
 * NodeDefinition instance
 *
 * @return {NodeDefinition} the output node for this builder
 */
Builder.prototype.end = function () {
  return this._outputNode.end()
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
  this._compilePeers(depManager, inputs, modifiers, true)
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

  // remap any ignored error references
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]

    // node might be ignoring errors from deduplicated nodes
    for (var nodeName in node.ignoredErrors) {
      var nodeRoot = utils.getNodeRootName(nodeName)
      var inputNode = this._compiled.nodes[nodeRoot]
      if (inputNode && hashNodes[inputNode.completeHash] !== inputNode) {
        delete node.ignoredErrors[nodeName]
        node.ignoredErrors[utils.swapNodeRoot(nodeName, hashNodes[inputNode.completeHash].newName)] = true
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
      for (i = 0; i < compiledNode.argInputs.length; i += 1) {
        addNodeFromSource(compiledNode.inputs[compiledNode.argInputs[i]], namePrefix + compiledNode.originalName)
      }
      for (i = 0; i < compiledNode.silentInputs.length; i += 1) {
        addNodeFromSource(compiledNode.inputs[compiledNode.silentInputs[i]], namePrefix + compiledNode.originalName)
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
      var input = node.inputs[inputKey]
      var inputRoot = utils.getNodeRootName(input)

      // already mapped a dependency from this node
      if (foundInputs[key][inputRoot]) continue

      // make sure the node exists
      var inputNode = this._compiled.nodes[inputRoot]
      if (!inputNode) continue

      if (node.argInputs.indexOf(inputKey) !== -1 || node.silentInputs.indexOf(inputKey) !== -1) {
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
      if (node.silentInputs.indexOf(inputKey) === -1 && node.argInputs.indexOf(inputKey) === -1) {
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
          var inputRoot = utils.getNodeRootName(node.inputs[inputKey])
          var inputNode = this._compiled.nodes[inputRoot]
          if (inputNode) {
            inputNode.numUniqueOutputs--
            for (var i = 0; i < inputNode.outputNodes.length; i++) {
              if (inputNode.outputNodes[i] === key) {
                inputNode.outputNodes.splice(i, 1)
                i--
              }
            }
            if (inputNode.silentOutputs[key]) delete inputNode.silentOutputs[key]
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
 * Get the original graph node name for a node handler function
 *
 * @param  {function} fn the function
 * @param  {string} nodeName the name of the node
 * @return {string} the original graph node for the function (likely another node name in this case)
 */
Builder.prototype._getOriginNode = function (fn, nodeName) {
  var hash = oid.hash(fn)
  if (!this._functionHashOriginalNodes[hash]) {
    this._functionHashOriginalNodes[hash] = nodeName
  }
  return this._functionHashOriginalNodes[hash]
}

/**
 * Produce hashes for a specified node by gathering hashes of its own handler
 * function as well as the hashes of dependency nodes and hashes of any node
 * names which aren't nodes in the graph (may be provided as run time inputs)
 *
 * @param {string} nodeName the name of the node
 */
Builder.prototype._generateHashesForNode = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  if (!node) return {completeHash: nodeName, nonSilentHash: nodeName}
  if (node.completeHash) return node

  // recursively set this node to cacheDisabled if needed
  node.argHashes = {}
  node.silentHashes = {}
  var keys = Object.keys(node.inputs).sort()
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var nodeRoot = utils.getNodeRootName(node.inputs[key])
    var nodeSuffix = node.inputs[key].substr(nodeRoot.length)
    var nodeHashes = this._generateHashesForNode(nodeRoot)
    if (node.silentInputs.indexOf(key) !== -1){
      node.silentHashes[key] = nodeHashes.completeHash + nodeSuffix
    }
    var argIndex = node.argInputs.indexOf(key)
    if (argIndex !== -1) {
      node.argHashes[key] = {idx: argIndex, hash: nodeHashes.nonSilentHash + nodeSuffix}
    }
  }

  // compute the function hash and a unique index for this node if caching is disabled
  node.fnOriginNode = this._getOriginNode(node.fn, node.originalName)
  if (node.cacheDisabled) {
    node._hashIdx = this._uniqueHashIdx++
  }

  // build the hashes
  var completeHashVals = [], nonSilentHashVals = []

  for (var key in node) {
    var keyHashVisibility = IGNORED_HASH_NODES[key]

    // if the key is marked as being invisible to both hashes, ignore it
    if (keyHashVisibility & HASH_TYPE_ALL == HASH_TYPE_ALL) continue
    var val = node[key]

    if (key == 'literalPromise') {
      // literal promises are a special case, we only care about their reference
      val = oid.hash(val)

    } else if (typeof val == 'object' && val != null) {
      // if the val is an object, stringify it instead
      val = createHash(JSON.stringify(val))
    }

    // add to the applicable hash inputs
    if (!(keyHashVisibility & HASH_TYPE_COMPLETE)) completeHashVals.push(val)
    if (!(keyHashVisibility & HASH_TYPE_NON_SILENT)) nonSilentHashVals.push(val)
  }

  // using a | delimiter for now for simplicity (it works well for all inputs to the hashing currently)
  node.completeHash = createHash(completeHashVals.join('|'))
  node.nonSilentHash = createHash(nonSilentHashVals.join('|'))

  return node
}

/**
 * Generate hashes for every node in the graph
 */
Builder.prototype._generateHashesForNodes = function () {
  for (var key in this._compiled.nodes) {
    this._generateHashesForNode(key)
  }
}

/**
 * Iterate over all nodes and set nodes as silent if they're an
 * input to a silent node
 */
Builder.prototype._setSilentRecursively = function () {
  var found
  do {
    found = false

    var key, node
    var toSetSilent = {}

    // iterate over all nodes and look for nodes that know they're silent
    // or nodes that mark other nodes as silent
    for (key in this._compiled.nodes) {
      node = this._compiled.nodes[key]
      // only add silent inputs
      for (var inputKey in node.inputs) {
        if (node.isSilent || node.silentInputs.indexOf(inputKey) !== -1) {
          var inputName = node.inputs[inputKey]
          var inputRootName = utils.getNodeRootName(inputName)
          toSetSilent[inputRootName] = true
        }
      }
    }

    // iterate over all nodes to be marked silent
    for (key in toSetSilent) {
      node = this._compiled.nodes[key]
      if (node && !node.isSilent) {
        node.isSilent = true
        found = true
      }
    }

  } while (found)
}

/**
 * Recursively add silent dependencies to nodes to preserve
 * ordering of silent vs non-silent dependencies
 *
 * @param {string} nodeName the name of the node to add dependencies to
 * @param {Array.<string>} deps the silent dependencies to add
 */
Builder.prototype._addSilentDependenciesForNode = function (nodeName, deps) {
  var node = this._compiled.nodes[nodeName]
  var i, inputName, inputRootName
  var childDeps = []

  for (i = 0; i < deps.length; i++) {
    var dep = deps[i]
    var found = false
    for (inputName in node.inputs) {
      inputRootName = utils.getNodeRootName(node.inputs[inputName])
      if (inputRootName == dep) {
        found = true
      }
    }
    if (!found) {
      node.inputs[dep] = dep
      node.silentInputs.push(dep)
      node.implicitInputs.push(dep)
      if (node.ignoredErrors[utils.DYNAMIC_NODE_REF]) {
        node.ignoredErrors[dep] = true
      }
    }
  }

  for (i = 0; i < node.silentInputs.length; i++) {
    inputName = node.inputs[node.silentInputs[i]]
    inputRootName = utils.getNodeRootName(inputName)
    childDeps.push(inputRootName)
  }

  for (i = 0; i < node.argInputs.length; i++) {
    inputName = node.inputs[node.argInputs[i]]
    inputRootName = utils.getNodeRootName(inputName)
    var inputNode = this._compiled.nodes[inputRootName]
    if (inputNode && !inputNode.isSilent) {
      this._addSilentDependenciesForNode(inputRootName, childDeps)
    }
  }
}

/**
 * Start recursing through all nodes adding silent dependencies
 * for ordering of silent and non-silent dependencies
 */
Builder.prototype._addSilentDependencies = function () {
  this._addSilentDependenciesForNode(this._outputNodeName, [])
}

/**
 * Retrieve a node and generate a list of recursive inputs for it.
 * If the node is conditional, don't return inputs because it may never
 * be called by the parent and the parent shouldn't dedupe. If a non-
 * conditional child has an identical silent dependency, remove the same
 * dep from this node
 *
 * @param {string} nodeName
 * @return {Object} a map of node names to the original calling nodes
 */
Builder.prototype._generateRecursiveInputsForNode = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  if (!node) return {}

  // if the node is conditional it may never be called and if it has
  // getters enabled it may surpress the errors, so we still need
  // to depend on any deps
  var shouldSendInputs = !node.isConditional && !node.hasGettersEnabled

  // return early if the inputs are already built
  if (node.allInputs) return shouldSendInputs ? node.allInputs : {}

  // start building inputs
  node.allInputs = {}
  var childNodeName, i

  // loop through all input nodes and retrieve their silent inputs
  for (var inputName in node.inputs) {
    var childInputs = this._generateRecursiveInputsForNode(utils.getNodeRootName(node.inputs[inputName]))
    for (childNodeName in childInputs) {
      node.allInputs[childNodeName] = childInputs[childNodeName]
    }
  }

  // loop through all silent inputs for this node and add to the list for
  // deduping of parents
  for (i = 0; i < node.silentInputs.length; i++) {
    childNodeName = node.silentInputs[i]
    if (node.allInputs[childNodeName]) {
      node.silentInputs.splice(i, 1)
      i--
    } else {
      node.allInputs[childNodeName] = nodeName
    }
  }

  return shouldSendInputs ? node.allInputs : {}
}

/**
 * Remove silent dependencies for node which their silent dependencies already depend on
 */
Builder.prototype._removeDuplicateDependencies = function () {
  this._generateRecursiveInputsForNode(this._outputNodeName)
}

/**
 * Remove fields from the compiled nodes which are only needed for the compilation steps
 */
Builder.prototype._reduceNodeOverhead = function () {
  for (var key in this._compiled.nodes) {
    var node = this._compiled.nodes[key]

    delete node.isConditional
    delete node.allInputs
    delete node.isSilent
    delete node.isPrivate
    delete node.isSubgraph
    delete node.isArrayWrapper
    delete node.completeHash
    delete node._hashIdx
    delete node.silentOutputs
    delete node.fnOriginNode
    delete node.silentHashes
    delete node.argHashes
  }
}

/**
 * Generate the failure chain for a node and all of its dependencies
 *
 * @param {string} nodeName
 * @param {Array.<Object>} failureChain an array of originalName to newName for every node
 *     between this node and the output node
 * @param {Object} callerNode the compiled caller node
 */
Builder.prototype._generateRecursiveFailureChainForNode = function (nodeName, failureChain, callerNode) {
  var node = this._compiled.nodes[nodeName]
  if (!node) return

  var callerObj = {}
  if (callerNode) {
    callerObj[callerNode.originalName] = callerNode.newName
  }

  if (node.failureChain) {
   if (callerNode) node.callers.push(callerObj)
   return
  }

  var nodeObj = {}
  nodeObj[node.originalName] = node.newName
  failureChain = [nodeObj].concat(failureChain)
  node.failureChain = failureChain.concat()
  node.callers = callerNode ? [callerObj] : []

  for (var key in node.inputs) {
    if (node.implicitInputs.indexOf(key) === -1) {
      this._generateRecursiveFailureChainForNode(utils.getNodeRootName(node.inputs[key]), failureChain, node)
    }
  }
}

/**
 * Build lists of failure chains and callers for every node
 */
Builder.prototype._buildFailureChains = function () {
  this._generateRecursiveFailureChainForNode(this._outputNodeName, [], null)
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

  // recurse the tree and set all nodes as silent which have a silent parent
  this._setSilentRecursively()

  // add silent inputs to all non-silent inputs for each input node
  this._addSilentDependencies()

  // hash
  this._generateHashesForNodes()

  // deduplicate all nodes with the exact same hash
  this._deduplicateNodes()

  // set up required fields for all nodes
  this._calculateRequiredMembers()

  // validate the builder has all needed inputs and looks kosher
  this._validateBuilder(runInputs)

  // remove any dependencies which are already a dependency of a non-conditional child
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
 * Run this builder with a given set of input and optional callback
 *
 * @param {Object} data any input to be fed into this Builder
 * @param {function(Error, Object)} callback a node-style callback which
 *     takes an error parameter as the first argument and the output of
 *     the build process as a key to value mapping as the second
 * @param {Object} callbackScope an optional scope provided for the
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

  // create a defer to be ran when the builder is done
  var defer = Q.defer()

  // create a clean object for running this build
  var data = {
    _numResolvedInputs: {},
    _values: inputData || {},
    _hashedValues: {},
    _errors: {},
    _hashedErrors: {},
    _builderName: this._name,
    _outputDefer: defer,
    _startTimes: {},
    _toRun: [],
    _shouldProfile: this._config.enableProfiling && (Math.random() < this._config.profilingFrequency)
  }

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

  return defer.promise
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

/**
 * Iterate over all args passed in to this node and rename them if they were passed in as
 * peers and set up dependencies for later compilation.
 *
 * @param {DependencyManager} depManager the dependency manager to use for setting up dependencies
 * @param {NodeDefinition} def the definition of the node to setup arg nodes for
 * @param {Object} nodeInputs a mapping of node names to maps of arguments to
 *     their input node names
 * @param {Object} peers a mapping of peer names to their compiled (data) representations
 * @param {Array.<string>} silentInputs a list of inputs that should be loaded for the current
 *     node being processed (but not to be passed in as args)
 * @param {Array.<string>} argInputs a list of inputs that should be loaded for the current node
 *     and passed in as args
 * @return {Object} a map of aliased node names to the Graph nodes that they actually represent
 */
Builder.prototype._setupArgumentsForNode = function (depManager, def, nodeInputs, peers, silentInputs, argInputs) {
  // create a map of the default arguments to this node
  var args = {}
  for (var i = 0; i < def.getArgs().length; i += 1) {
    var argNode = utils.getNodeInfoFromBuild(this._graph, def.getArgs()[i])
    var argAliasRealName = argNode.aliasRealName

    // add to the appropriate lists for visible vs silent inputs
    if (argNode.isSilent()) silentInputs.push(argAliasRealName)
    else if (!argNode.isOptional()) argInputs.push(argAliasRealName)

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
    var toBuildNode = utils.getNodeInfoFromBuild(this._graph, toBuild.field)

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

    depManager.addNode(field, toBuild.isConditional)
    if (!provideMap[field]) provideMap[field] = {}
    if (!modifierMap[field]) modifierMap[field] = []

    for (j = 0; j < toBuild.provides.length; j += 1) {
      var provided = utils.getNodeInfoFromInput(this._graph, toBuild.provides[j])
      var nodeName, nodeRoot, newRootNode

      if (utils.isWildcardArgRef(provided.nodeName)) {
        var buildInfo = utils.getNodeInfoFromBuild(this._graph, toBuild.field)
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
        if (!newRootNode) throw new Error("Unable to find node '" + provided.nodeName + "' (passed from '" + def.getName() + "' to '" + toBuild.field + "')")
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
 * @param {boolean} isConditional whether this is a conditional node
 * @return {Object} a compiled (data) representation of the node
 */
Builder.prototype._compileNode = function (originalNodeName, newNodeName, peers, nodeInputs, isConditional) {
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
  var silentInputs = []
  var argInputs = []

  // determine where the input args from this node are actually coming from (peers, other nodes, etc)
  var args = this._setupArgumentsForNode(depManager, def, nodeInputs, peers, silentInputs, argInputs)

  // add any remaining nodes as silent inputs
  for (key in nodeInputs) {
    var nodeRealName = utils.getNodeRealName(nodeInputs[key])
    var nodeRealRootName = utils.getNodeRootName(nodeRealName)
    if (peers[nodeRealRootName]) {
      nodeRealName = utils.swapNodeRoot(nodeRealName, peers[nodeRealRootName].newName)
    }
    inputs[key] = peers[nodeRealName] ? peers[nodeRealName].newName : nodeRealName
    silentInputs.push(key)
  }

  // read through any nodes that need to be built by this node and set up their inter-dependencies
  var childData = this._setupChildNodes(def, depManager, args, peers)

  // compile the child nodes
  var children = this._compilePeers(depManager, childData.provideMap, childData.modifierMap, false)
  for (key in args) {
    var rootNode = utils.getNodeRootName(args[key])
    if (children[rootNode]) inputs[key] = utils.swapNodeRoot(args[key], children[rootNode].newName)
    else inputs[key] = args[key]
  }

  // keep track of any nodes that are allowed to fail
  var ignoredErrors = def.getIgnoredErrors()
  var ignoredErrorMap = {}
  for (i = 0; i < ignoredErrors.length; i++) {
    var ignoredNodeName = ignoredErrors[i]
    if (ignoredNodeName == '_dynamic') {
      ignoredErrorMap[ignoredNodeName] = true
    } else {
      var inputNodeName = inputs[ignoredNodeName]
      if (argInputs.indexOf(ignoredNodeName) !== -1) throw new Error("Only silent nodes may have their errors ignored")
      ignoredErrorMap[inputNodeName] = true
    }
  }

  // create the node
  var node = this._compiled.nodes[newNodeName] = {
    originalName: originalNodeName,
    newName: newNodeName,
    inputs: inputs,
    argInputs: argInputs,
    silentInputs: silentInputs,
    implicitInputs: [],
    ignoredErrors: ignoredErrorMap,
    fn: def.getFunction(),
    cacheDisabled: !!def.isCacheDisabled(),
    isPrivate: utils.isPrivateNode(originalNodeName),
    isSilent: false,
    silentOutputs: {},
    isSubgraph: def.getFunction() === this._graph.subgraph,
    isArrayWrapper: def.getFunction() === this._graph.argsToArray,
    hasGettersEnabled: def.hasGettersEnabled(),
    requiredFields: [],
    numUniqueInputs: 0,
    outputNodes: [],
    isConditional: isConditional
  }

  if (this._config.enforceTypes) node.type = originalNodeName.split('-')[0]

  if (node.fn && node.fn._literal) {
    var literalHash = oid.hash(node.fn._literal)
    if (!literalPromises[literalHash]) {
      literalPromises[literalHash] = Q.resolve(node.fn._literal)
      literalValues[literalHash] = node.fn._literal
    }
    node.literalPromise = literalPromises[literalHash]
    node.literalValue = literalValues[literalHash]
  }

  return node
}

/**
 * Takes a given set of nodes that all exist within the same context and builds
 * them all as a single group of "peers". Any nodes provided to .builds() within
 * a single Builder or a NodeDefinition are considered peers. This function
 * optimizes ordering of the peers such that each peer is built based on the
 * ordering of dependencies
 *
 * @param {DependencyManager} depManager a map of the dependencies that should
 *     be compiled as peers
 * @param {Object} nodeInputs a mapping of node names to maps of arguments to
 *     their input node names
 * @param {Object} nodeModifiers a mapping of node names to arrays of modifiers
 * @param {boolean} isBuilder whether this compile is at the topmost level of a
 *     Builder
 * @return {Object} a mapping of all nodes that were built to their compiled data
 */
Builder.prototype._compilePeers = function (depManager, nodeInputs, nodeModifiers, isBuilder) {
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
        peers[key] = this._compileNode(nodeName, key + nodeSuffix, peers, utils.clone(nodeInputs[key] || {}), depManager.isConditional(nodeName))
      }
    }

  } while (compiledAnyNode)

  return peers
}

/**
 * Creates a promise which will return the value of a node as generated
 * by the graph
 *
 * @param {Object} data the current calling context
 * @param {string} nodeName
 * @return {Object} val
 */
Builder.prototype._resolve = function (data, nodeName) {
  return this._getResolver(nodeName)(data)
}

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
    if (config.freezeOutputs && !node.isPrivate) {
      deepFreeze(response)
    }

    data._values[nodeName] = response
    data._hashedValues[node.nonSilentHash] = response
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
      if (data._errors[nodeName]) data._outputDefer.reject(data._errors[nodeName])
      else data._outputDefer.resolve(data._values[nodeName])
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
 * Create a silent input validator for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object)} the silent input validator which will return an error
 *     if a silent input has failed that shouldn't be ignored
 */
Builder.prototype._getSilentInputValidator = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  if (!node.silentInputs.length) return undefined

  return function silentInputValidator(data) {
    var err

    // make sure all silent inputs worked
    for (var i = 0; i < node.silentInputs.length && !err; i++) {
      var inputName = node.inputs[node.silentInputs[i]]
      var inputRootName = utils.getNodeRootName(inputName)
      if (!node.ignoredErrors[inputRootName] && data._errors[inputRootName]) {
        err = data._errors[inputRootName]
      } else if (!node.ignoredErrors[inputRootName] && inputName != inputRootName) {
        try {
          var val = getChildGetter(inputName)(data._values[inputRootName])
        } catch (e) {
          err = e
        }
      }
    }

    if (err instanceof ConditionalError && node.implicitInputs.indexOf(inputRootName) !== -1) err = undefined
    return err
  }
}

/**
 * Create a non-silent input validator for a graph node
 *
 * @param {string} nodeName
 * @return {function(Object, Array)} the non-silent input validator which will return an error
 *     if a silent input has failed that shouldn't be ignored. Modifies the array of arguments
 *     in place for consumption by the resolvers
 */
Builder.prototype._getNonSilentInputValidator = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  if (!node.argInputs.length) return undefined

  return function nonSilentInputValidator(data, args) {
    var err, val

    // grab all arg inputs
    for (var i = 0; i < node.argInputs.length && !err; i++) {
      var inputName = node.inputs[node.argInputs[i]]
      var inputRootName = utils.getNodeRootName(inputName)

      if (inputName == '_requiredFields') {
        err = undefined
        val = node.requiredFields
      } else {
        err = data._errors[inputRootName]
        val = data._values[inputRootName]
      }

      if (!err && typeof val === 'undefined' && !data._values.hasOwnProperty(inputRootName)) {
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

    if (err instanceof ConditionalError && node.implicitInputs.indexOf(inputRootName) !== -1) err = undefined
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
  var builderName = this._name

  return function onError(e, data) {
    if (!e.graphInfo) {
      var depNodes = []
      for (key in node.inputs) {
        depNodes.push(node.inputs[key])
      }

      e.graphInfo = {
        builderName: builderName,
        callers: node.callers,
        failureNodeChain: node.failureChain,
        failureInputs: depNodes
      }
    }
    data._errors[nodeName] = e
  }
}

/**
 * Get the resolver for a literal
 *
 * @param {string} nodeName
 * @return {function(Object)} returns a promise which will resolve
 *     when this node has completed resolving
 */
Builder.prototype._getLiteralResolver = function (nodeName) {
  var node = this._compiled.nodes[nodeName]

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateSilentInputs = this._getSilentInputValidator(nodeName)
  var validateNonSilentInputs = this._getNonSilentInputValidator(nodeName)

  return function literalResolver(data) {
    var err
    var args = []

    if (validateSilentInputs) err = validateSilentInputs(data)
    if (validateNonSilentInputs && !err) err = validateNonSilentInputs(data, args)

    return (err ? Q.reject(err) : node.literalPromise)
      .setContext(data)
      .then(onSuccess)
      .fail(onError)
      .then(onComplete)
      .clearContext()
  }
}

/**
 * Get the resolver for a subgraph
 *
 * @param {string} nodeName
 * @return {function(Object)} returns a promise which will resolve
 *     when this node has completed resolving
 */
Builder.prototype._getSubgraphResolver = function (nodeName) {
  var node = this._compiled.nodes[nodeName]

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateSilentInputs = this._getSilentInputValidator(nodeName)
  var validateNonSilentInputs = this._getNonSilentInputValidator(nodeName)

  return function subgraphResolver(data) {
    var err
    var args = []

    if (validateSilentInputs) err = validateSilentInputs(data)
    if (validateNonSilentInputs && !err) err = validateNonSilentInputs(data, args)

    return (err ? Q.reject(err) : Q.resolve(args[args.length - 1]))
      .setContext(data)
      .then(onSuccess)
      .fail(onError)
      .then(onComplete)
      .clearContext()
  }
}

/**
 * Get the resolver for an array wrapper
 *
 * @param {string} nodeName
 * @return {function(Object)} returns a promise which will resolve
 *     when this node has completed resolving
 */
Builder.prototype._getArrayResolver = function (nodeName) {
  var node = this._compiled.nodes[nodeName]

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateSilentInputs = this._getSilentInputValidator(nodeName)
  var validateNonSilentInputs = this._getNonSilentInputValidator(nodeName)

  return function arrayResolver(data) {
    var err
    var args = []

    if (validateSilentInputs) err = validateSilentInputs(data)
    if (validateNonSilentInputs && !err) err = validateNonSilentInputs(data, args)

    return (err ? Q.reject(err) : Q.resolve(args))
      .setContext(data)
      .then(onSuccess)
      .fail(onError)
      .then(onComplete)
      .clearContext()
  }
}

/**
 * Get the resolver for a node without callbacks
 *
 * @param {string} nodeName
 * @return {function(Object)} returns a promise which will resolve
 *     when this node has completed resolving
 */
Builder.prototype._getNonCallbackResolver = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var config = this._config
  var profiler = this._boundProfiler

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateSilentInputs = this._getSilentInputValidator(nodeName)
  var validateNonSilentInputs = this._getNonSilentInputValidator(nodeName)

  return function nonCallbackResolver(data) {
    var err, promise
    var args = []

    if (validateSilentInputs) err = validateSilentInputs(data)
    if (validateNonSilentInputs && !err) err = validateNonSilentInputs(data, args)

    if (!err && data._shouldProfile) data._startTimes[nodeName] = Date.now()

    if (data._hashedValues[node.nonSilentHash]) promise = Q.resolve(data._hashedValues[node.nonSilentHash])
    else if (data._hashedErrors[node.nonSilentHash]) promise = Q.reject(data._hashedErrors[node.nonSilentHash])

    if (!err && !promise) {
      try {
        promise = Q.resolve(node.fn.apply(null, args))
      } catch (e) {
        err = e
      }
    }

    return (err ? Q.reject(err) : promise)
      .setContext(data)
      .then(onSuccess)
      .fail(onError)
      .then(onComplete)
      .clearContext()
  }
}

/**
 * Get the resolver for a node with callbacks
 *
 * @param {string} nodeName
 * @return {function(Object)} returns a promise which will resolve
 *     when this node has completed resolving
 */
Builder.prototype._getCallbackResolver = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var config = this._config
  var profiler = this._boundProfiler

  var onSuccess = this._getSuccessHandler(nodeName)
  var onError = this._getErrorHandler(nodeName)
  var onComplete = this._getCompleteHandler(nodeName)
  var validateSilentInputs = this._getSilentInputValidator(nodeName)
  var validateNonSilentInputs = this._getNonSilentInputValidator(nodeName)

  return function callbackResolver(data) {
    var err, promise
    var args = []

    if (validateSilentInputs) err = validateSilentInputs(data)
    if (validateNonSilentInputs && !err) err = validateNonSilentInputs(data, args)

    if (!err && data._shouldProfile) data._startTimes[nodeName] = Date.now()

    if (data._hashedValues[node.nonSilentHash]) promise = Q.resolve(data._hashedValues[node.nonSilentHash])
    else if (data._hashedErrors[node.nonSilentHash]) promise = Q.reject(data._hashedErrors[node.nonSilentHash])

    // node with callbacks
    if (!err && !promise) {
      try {
        var defer = Q.defer()
        args.push(defer.makeNodeResolver())
        var response = node.fn.apply(null, args)
        promise = typeof response == 'undefined' ? defer.promise : Q.resolve(response)
      } catch (e) {
        promise = Q.reject(e)
      }
    }

    return (err ? Q.reject(err) : promise)
      .setContext(data)
      .then(onSuccess)
      .fail(onError)
      .then(onComplete)
      .clearContext()
  }
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

  if (node.literalPromise) {
    return this._resolvers[nodeName] = this._getLiteralResolver(nodeName)

  } else if (node.isSubgraph) {
    return this._resolvers[nodeName] = this._getSubgraphResolver(nodeName)

  } else if (node.isArrayWrapper) {
    return this._resolvers[nodeName] = this._getArrayResolver(nodeName)

  } else if (!config.useCallbacks) {
    return this._resolvers[nodeName] = this._getNonCallbackResolver(nodeName)

  } else {
    return this._resolvers[nodeName] = this._getCallbackResolver(nodeName)
  }
}

module.exports = Builder

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
