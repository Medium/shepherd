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
var NodeInstance = require('./NodeInstance')
var NodeResponseGetter = require('./NodeResponseGetter')
var oid = require('oid')
var Q = require('kew')
var utils = require('./utils')

// a map of nodes with '.' delimiters to their resolver functions
var childResolverMap = {}

// a map of '.' delimited node names to functions which retrieve their value
var memberGetters = {}

// a map of the child part of '.' delimited node names to functions which parse the child 
// data from a parent node
var childGetters = {}

// a map of literal oid hashes to retrieval functions
var literalMap = {}

// a map of node names to functions which retrieve the node from the input data
var inputResolverMap = {}

// utility promise for dependency resolution
var EMPTY_ARRAY_PROMISE = Q.resolve([])

// keep profile data in 1 minute buckets
var PROFILE_BUCKET_SIZE = 60 * 1000

// store the last 30 minutes of profile buckets
var MAX_PROFILE_BUCKETS = 30

// default handler function to allow the compile step to finish without yelling,
// will be overridden by the compiler itself
var DEFAULT_HANDLER_FUNCTION = function () {
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
  this._freezeOutputs = false

  this._handlers = {
    'pre': [],
    'post': []
  }

  this.setProfiling(this._config.enableProfiling)
}

Builder.prototype.freezeOutputs = function () {
  this._freezeOutputs = true
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
 * @param {boolean} profilingEnabled whether profiling should be enabled
 */
 Builder.prototype.setProfiling = function (profilingEnabled) {
  this._config.enableProfiling = profilingEnabled
  if (this._profilingInterval) clearInterval(this._profilingInterval)

  if (this._config.enableProfiling) {
    this._profilingInterval = setInterval(this._shiftProfilers.bind(this), PROFILE_BUCKET_SIZE)
    this._shiftProfilers()
  } else {
    this._profileData = []
  }
 }

/**
 * Set the description for this builder
 *
 * @param {string} description
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
  if (!this._compiled) this.compile()

  // load the node requested and find the actual source node in the case of clones
  var node = this._compiled.nodes[nodeName]
  while (node && node.copyOf) node = this._compiled.nodes[node.copyOf]

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
  if (!this._compiled) this.compile(inputNodes)
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
  return this.builds('?' + field)
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

Builder.prototype._initCompiler = function () {
  this._compiled = {
    nodes: {},
    nodePrefixIdx: 0
  }
}

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

    for (inputKey in node.inputs) {
      inputName = node.inputs[inputKey]
      var remappedNode = remappedNodes[utils.getNodeRootName(inputName)]
      if (remappedNode) {
        node.inputs[inputKey] = utils.swapNodeRoot(inputName, remappedNode.newName)
      }
    }
  }

  // delete nodes which shouldn't stick around
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    if (hashNodes[node.completeHash] !== node) {
      delete this._compiled.nodes[key]
    }
  }
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
 * @param {Array.<string>} runInputs a list of nodes that will be provided
 *     to run() for this method, causes the compile phase to throw an
 *     error if any nodes are missing
 */
Builder.prototype.compile = function (runInputs) {
  var key, subkey, i, j, node
  var strictInputs = !!runInputs
  runInputs = runInputs || []

  // reset the compilation data
  this._initCompiler()

  // recurse through the graph and create an unoptimized map of all nodes and their deps
  this._compileOutputs()

  // deduplicate all nodes with the exact same hash
  this._deduplicateNodes()

  var requiredFields = {}

  // remap deleted nodes to deduplicated nodes
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    for (subkey in node.inputs) {
      var inputNode = node.inputs[subkey]
      var rootNode = utils.getNodeRootName(inputNode)
      if (this._compiled.nodes[rootNode] && this._compiled.nodes[rootNode].copyOf) rootNode = this._compiled.nodes[rootNode].copyOf

      // retrieve a list of required fields for each input
      var nodeParts = inputNode.split('.')
      if (this._compiled.nodes[rootNode] && this._compiled.nodes[rootNode].copyOf) rootNode = this._compiled.nodes[rootNode].copyOf
      if (nodeParts.length < 2 || typeof requiredFields[rootNode] === 'string') requiredFields[rootNode] = '*'
      else {
        if (typeof requiredFields[rootNode] === 'undefined') requiredFields[rootNode] = {}
        requiredFields[rootNode][nodeParts[1]] = 1
      }
    }
  }

  // create a list of keys to build
  var keys = Object.keys(this._builds)
  keys.concat(Object.keys(this._silentBuilds))

  // check any nodes that need to be built at the top of this builder for required fields
  for (i = 0; i < keys.length; i += 1) {
    key = keys[i]

    var buildNodeParts = key.split('.')
    var buildNodeRoot = buildNodeParts.shift()
    if (this._compiled.nodes[buildNodeRoot] && this._compiled.nodes[buildNodeRoot].copyOf) buildNodeRoot = this._compiled.nodes[buildNodeRoot].copyOf
    if (!buildNodeParts.length || typeof requiredFields[buildNodeRoot] === 'string') requiredFields[buildNodeRoot] = '*'
    else {
      if (typeof requiredFields[buildNodeRoot] === 'undefined') requiredFields[buildNodeRoot] = {}
      requiredFields[buildNodeRoot][buildNodeParts.shift()] = 1
    }
  }

  // update the dependencies for each required field
  for (key in requiredFields) {
    if (this._compiled.nodes[key]) {
      // set the required fields for this node
      this._compiled.nodes[key].requiredFields = requiredFields[key] === '*' ? '*' : Object.keys(requiredFields[key])
    }
  }

  // if an array of runtime inputs was passed in, recurse through the nodes looking for any nodes
  // that are missing and check if they are in the list of inputs
  if (runInputs) {
    var foundNodes = {}
    var missingCallbacks = {}
    var missingNodes = {}
    var nodesRequestedBy = {}
    var nodesToCheck = []

    // inline function for convenience as this is mostly for debugging purposes. Adds a node to a
    // list of nodes that need to be checked for existence and adds the requester of the node
    // for later retrieval
    var addNodeFromSource = function (nodeName, source) {
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
      node = nodesToCheck.shift()
      var nodeName = node.name
      var namePrefix = node.prefix + '->'
      var compiledNode = this._compiled.nodes[nodeName]
      while (compiledNode && compiledNode.copyOf) compiledNode = this._compiled.nodes[compiledNode.copyOf]

      if (compiledNode && compiledNode.fn) {
        for (i = 0; i < compiledNode.argInputs.length; i += 1) {
          addNodeFromSource(compiledNode.inputs[compiledNode.argInputs[i]], namePrefix + compiledNode.originalName)
        }
        for (i = 0; i < compiledNode.silentInputs.length; i += 1) {
          addNodeFromSource(compiledNode.inputs[compiledNode.silentInputs[i]], namePrefix + compiledNode.originalName)
        }
      } else {
        if (compiledNode && !compiledNode.fn) missingCallbacks[nodeName] = true
        if (runInputs.indexOf(nodeName) === -1) missingNodes[nodeName] = true
      }
    }

    // show any missing nodes
    var missingNodeKeys = Object.keys(missingNodes)
    if (strictInputs && missingNodeKeys.length) {
      throw new Error(missingNodeKeys.map(function (nodeName) {
        return 'Node \'' + nodeName + '\' was not found and is required by [' + Object.keys(nodesRequestedBy[nodeName]).join(', ') + ']'
      }).join('. '))
    }

    // show any missing callbacks
    var missingCallbackKeys = Object.keys(missingCallbacks)
    if (missingCallbackKeys.length) {
      throw new Error(missingCallbackKeys.map(function (nodeName) {
        return 'Node \'' + nodeName + '\' requires a callback'
      }).join('. '))
    }
  }

  var compiledOutputNode = this._compiled.nodes[this._outputNodeName]
  compiledOutputNode.fn = createOutputMapper(this._outputNode.getOutputNodeNames())

  // compile all of the resolvers
  for (var key in this._compiled.nodes) {
    if (!this._compiled.nodes[key].copyOf) this._getResolver(key)
  }

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
  promise = promise.then(this._run.bind(this))

  // add post-handlers
  for (var i = 0; i < this._handlers.post.length; i++) {
    promise = promise.then(this._handlers.post[i])
  }

  // handle callbacks
  if (callback) {
    promise
    .then(function (data) {
      callback.call(callbackScope, undefined, data)
    })
    .fail(function (e) {
      callback.call(callbackScope, e)
    })
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
  var profileDate = Math.floor( Date.now() / PROFILE_BUCKET_SIZE ) * PROFILE_BUCKET_SIZE
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
 * Run this builder with a given set of input and optional callback
 *
 * @param {Object} data any input to be fed into this Builder
 * @return {Promise.<Object>} promise which returns a key to value
 *     mapping of the result if successful
 */
Builder.prototype._run = function (data) {
  if (!this._compiled) this.compile()
  var builds = this._builds
  var i, key, outputNodeName = this._outputNodeName

  // create a clean object for running this build
  for (key in data) data[key] = Q.resolve(data[key])
  data._hashedResponses = {}
  data._resolve = this._resolve.bind(this, data)
  data._builderName = this._name

  return data._resolve(outputNodeName)
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
      if (compiledNode.copyOf) return nodes[nodeName] = this._getNodeFromDotGraph(g, nodes, inputNodes, compiledNode.copyOf, isBuild)
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
 * Produce a hash for a specified node by gathering hashes of its own handler
 * function as well as the hashes of dependency nodes and hashes of any node
 * names which aren't nodes in the graph (may be provided as run time inputs)
 *
 * @param {string} nodeName the name of the node
 * @return {string} a hash which represents the handler of this node and all
 *     inputs. may be identical to another node's hash if it takes in the
 *     same inputs and uses the same handler (used for de-duplication of nodes)
 */
Builder.prototype._generateHashForNode = function (nodeName, ignoreSilent, isSelf) {
  var node = this._compiled.nodes[nodeName]
  var hasher = crypto.createHash('md5')

  // if the node doesn't exist, just hash the name
  if (!node) {
    hasher.update(nodeName)
    return hasher.digest('hex')
  }

  // loop through all inputs and use their hashes if they exist, otherwise hash their names
  for (var key in node.inputs) {
    var depNodeName = utils.getNodeRootName(node.inputs[key])
    var depFullName = utils.getNodeRealName(node.inputs[key])
    var dep = this._compiled.nodes[depNodeName]
    if (dep && dep.cacheDisabled) {
      // recursively disable the cache if the cache of a dependency has been disabled
      node.cacheDisabled = true
      hasher.update(dep.completeHash + depFullName.substr(depNodeName.length) + '|')
    } else if (!ignoreSilent || node.silentInputs.indexOf(key) === -1) {
      if (!dep) {
        hasher.update(depFullName + '|')
      } else {
        hasher.update(dep.completeHash + depFullName.substr(depNodeName.length) + '|')
      }
    }
  }

  // update with whether the cache was disabled or not
  if (!node._hashIdx) node._hashIdx = this._uniqueHashIdx++
  hasher.update(node.cacheDisabled ? node._hashIdx + '|' : '0|')

  var hex = hasher.digest('hex')
  return oid.hash(node.fn) + '-' + hex
}

/**
 * Copy a node to a node of a new name
 *
 * @param {string} nodeName the node to copy
 * @param {string} newNodeName the name of the new node
 * @return {Object} the compiled node data
 */
Builder.prototype._copyNode = function (nodeName, newNodeName) {
  if (!this._compiled.nodes[nodeName]) throw new Error("Node '" + nodeName + "' doesn't exist")
  this._compiled.nodes[newNodeName] = utils.clone(this._compiled.nodes[nodeName])
  this._compiled.nodes[newNodeName].newName = newNodeName
  return this._compiled.nodes[newNodeName]
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
    var argAlias = argNode.alias
    var argAliasRealName = utils.getNodeRealName(argAlias)

    // add to the appropriate lists for visible vs silent inputs
    if (utils.isSilentNode(argAlias)) silentInputs.push(argAliasRealName)
    else if (!utils.isOptionalNode(argAlias)) argInputs.push(argAliasRealName)

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

    var field = utils.getNodeRootName(toBuildNode.alias)

    depManager.addNode(field)
    if (!provideMap[field]) provideMap[field] = {}
    if (!modifierMap[field]) modifierMap[field] = []

    for (j = 0; j < toBuild.modifiers.length; j += 1) {
      var modifier = utils.getNodeInfoFromModifier(this._graph, toBuild.modifiers[j], field)

      // build a new node (as a peer)
      var modifierRootNode = utils.getNodeRootName(modifier.nodeName)
      modifierMap[field].push(modifier)
      depManager.addDependency(field, modifierRootNode)
    }

    for (j = 0; j < toBuild.provides.length; j += 1) {
      var provided = utils.getNodeInfoFromInput(this._graph, toBuild.provides[j])

      if (provided.nodeName === 'args.*') {
        var buildInfo = utils.getNodeInfoFromBuild(this._graph, toBuild.field)
        var nodeToBuildInputs = this._graph._nodeDefinitions[buildInfo.rootName]._inputArgs
        var currentInputs = this._graph._nodeDefinitions[def.getName()]._inputArgs

        for (k = 0; k < currentInputs.length; k++) {
          var inputName = currentInputs[k]
          if (nodeToBuildInputs.indexOf(inputName) !== -1) {
            // node takes an argument that was passed into this node
            var nodeName = inputName
            var nodeRoot = utils.getNodeRootName(nodeName)
            var newRootNode = args[nodeRoot]
            if (peers[newRootNode]) newRootNode = peers[newRootNode].newName
            provideMap[field][inputName] = utils.swapNodeRoot(inputName, newRootNode)
          }
        }

      } else if (provided.nodeName.indexOf('args.') === 0) {
        // node takes an argument that was passed into this node
        var nodeName = provided.nodeName.substr(5)
        var nodeRoot = utils.getNodeRootName(nodeName)

        var newRootNode = args[nodeRoot]
        if (!newRootNode) throw new Error("Unable to find node '" + provided.nodeName + "' (passed from '" + def.getName() + "' to '" + toBuild.field + "')")
        if (peers[newRootNode]) newRootNode = peers[newRootNode].newName
        provideMap[field][provided.arg] = utils.swapNodeRoot(provided.nodeName.substr(5), newRootNode)

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
 * @param {Array.<string|Object>} nodeModifiers a list of modifiers that this node should be ran through
 *     as specified by a parent node or a NodeInstance
 * @param {NodeInstance} instance a NodeInstance instance if this node is at the top-most
 *     level of a Builder
 * @return {Object} a compiled (data) representation of the node
 */
Builder.prototype._compileNode = function (originalNodeName, newNodeName, peers, nodeInputs, nodeModifiers, instance) {
  var def = this._graph._nodeDefinitions[originalNodeName]
  var key, subkey, i, j

  // if no definition exists, expect that this is an input into the builder at run time
  if (!def) {
    return {
        originalName: originalNodeName
      , newName: originalNodeName
      , completeHash: this._generateHashForNode(originalNodeName)
      , nonSilentHash: this._generateHashForNode(originalNodeName, true)
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
    var inputNodeName = inputs[ignoredNodeName]
    if (argInputs.indexOf(ignoredNodeName) !== -1) throw new Error("Only silent nodes may have their errors ignored")
    ignoredErrorMap[inputNodeName] = true
  }

  // create the node
  var node = this._compiled.nodes[newNodeName] = {
    originalName: originalNodeName,
    newName: newNodeName,
    inputs: inputs,
    argInputs: argInputs,
    silentInputs: silentInputs,
    ignoredErrors: ignoredErrorMap,
    fn: def.getFunction(),
    requiredFields: '*',
    modifiers: modifiers,
    cacheDisabled: !!def.isCacheDisabled(),
    isSubgraph: def.getFunction() === this._graph.subgraph,
    isArrayWrapper: def.getFunction() === this._graph.argsToArray,
    hasGettersEnabled: def.hasGettersEnabled()
  }

  node.completeHash = this._generateHashForNode(newNodeName)
  node.nonSilentHash = this._generateHashForNode(newNodeName, true)

  if (node.fn && node.fn._literal) {
    node.isLiteral = true
    node.literalValue = node.fn._literal
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
        compiledAnyNode = true
        delete depsToBuild[key]
        peers[key] = this._compileNode(nodeName, key + nodeSuffix, peers, utils.clone(nodeInputs[key] || {}), utils.clone(nodeModifiers[key] || {}))
      }
    }

  } while (compiledAnyNode)

  // TODO: check if any nodes are still unprocessed

  return peers
}

/**
 * Mutates an error returned from a specified node by building a more
 * useful chain of failure nodes and the initial inputs
 *
 * @param {Object} node the node from this._compiled.nodes
 * @param {Error} e the error
 * @throws {Error}
 */
Builder.prototype._handleError = function (node, e) {
  var nodeName = node.newName
  var inputs = node.inputs || {}
  var depNodes = []
  for (var key in node.inputs) {
    depNodes.push(node.inputs[key])
  }

  if (!e.graphInfo) {
    var callerNodes = []

    for (var key in this._compiled.nodes) {
      var i
      var found = false
      var compiledNode = this._compiled.nodes[key]

      if (compiledNode.inputs) {
        for (var argKey in compiledNode.inputs) {
          if (compiledNode.inputs[argKey] == nodeName || compiledNode.inputs[argKey].indexOf(nodeName + '.') === 0) {
            found = true
            callerNodes.push(key)
          }
        }
      }
    }

    e.graphInfo = {
      builderName: this._name,
      callers: callerNodes,
      failureNodeChain: [{
        nodeName: nodeName,
        originalNodeName: node.originalName
      }],
      failureInputs: depNodes
    }
  } else {
    var lastFailureNode = e.graphInfo.failureNodeChain[e.graphInfo.failureNodeChain.length - 1]
    var found = false
    for (var i = 0; !found && i < depNodes.length; i++) {
      var depNode = depNodes[i].split('.')[0]
      if (depNode == lastFailureNode.nodeName) found = true
    }
    if (found) {
      e.graphInfo.failureNodeChain.push({
        nodeName: nodeName,
        originalNodeName: node.originalName
      })
    }
  }

  throw e
}

/**
 * Creates a resolver which will retrieve another node and request
 * a member variable (or nested member variables)
 *
 * @param {Object} getter a getter helper as defined by getTokenizedMemberGetter
 * @return {function}
 */
function createChildResolver(getter) {
  var getterHash = oid.hash(getter)
  if (childResolverMap[getterHash]) return childResolverMap[getterHash]

  return childResolverMap[getterHash] = function (context) {
    return context._resolve(getter.rootNode)
      .then(getter.childGetter)
  }
}

/**
 * Creates a resolver which will return a node passed into the graph
 * as an input or throw an error if the node doesn't exist
 *
 * @param {Error} error the error to throw if the input doesn't exist
 * @param {string} nodeName the node name
 * @Object {context} the current context of the builder request
 * @return {Object}
 * @throws {Error}
 */
Builder.prototype._createInputResolver = function (nodeName) {
  if (inputResolverMap[nodeName]) return inputResolverMap[nodeName]

  var err = new Error("Unable to find node '" + nodeName + "'")
  return inputResolverMap[nodeName] = function (context) {
    if (context[nodeName]) return context[nodeName]
    return context[nodeName] = Q.reject(err)
  }
}

/**
 * Creates a promise which will resolve all silent inputs to a node
 * before returning
 *
 * @param {Object} node the node from this._compiled.nodes
 * @param {Object} data the input data from the previous steps of the chain
 * @return {{context: Object}}
 */
Builder.prototype._getSilentDependencies = function (node, data) {
  var context = data.context
  var promises = []
  for (var i = 0; i < node.silentInputs.length; i += 1) {
    var key = node.silentInputs[i]
    var silentNodeName = node.inputs[key]
    var promise = context._resolve(silentNodeName)
    if (!node.ignoredErrors[silentNodeName]) {
      promises.push(promise)
    }
  }
  return Q.all(promises)
    .then(function () {
      return {context: context}
    })
}

/**
 * Creates a promise which will resolve all visible inputs to a node
 * before returning
 *
 * @param {Object} node the node from this._compiled.nodes
 * @param {Object} data the input data from the previous steps of the chain
 * @return {{context: Object, args: Array.<Object>}}
 */
Builder.prototype._getVisibleDependencies = function (node, data) {
  var context = data.context
  var promises = []
  for (var i = 0; i < node.argInputs.length; i += 1) {
    key = node.argInputs[i]
    if (node.inputs[key] === '_requiredFields') {
      promises.push(Q.resolve(node.requiredFields)) //node.requiredFields))
    } else {
      promises.push(context._resolve(node.inputs[key]))
    }
  }

  if (node.hasGettersEnabled) {
    promises = createGetterPromises(promises)
  }

  return Q.all(promises)
    .then(function (responses) {
      return {context: context, args: responses}
    })
}

/**
 * Creates a promise which will return the value of a node as generated
 * by the graph
 *
 * @param {Object} context the current calling context
 * @param {string} nodeName
 * @return {Object} val
 */
Builder.prototype._resolve = function (context, nodeName) {
  if (context.hasOwnProperty(nodeName)) return Q.resolve(context[nodeName])

  return this._getResolver(nodeName)(context)
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
  var resolver = this._resolvers[nodeName]
  if (resolver) return resolver
  var node = this._compiled.nodes[nodeName]

  if (nodeName.indexOf('.') !== -1) {
    // dot notation
    var getter = getTokenizedMemberGetter(nodeName)
    return this._resolvers[nodeName] = createChildResolver(getter)
  }

  if (typeof node === 'undefined') {
    // exit early if the node isn't found (it might be in the inputs)
    // TODO: memoize
    return this._resolvers[nodeName] = this._createInputResolver(nodeName)
  }

  if (node && node.copyOf) {
    // copy of another node
    return this._getResolver(node.copyOf)
  }

  var handlerChain = []

  if (node.inputs && node.silentInputs.length) {
    // build silent dependencies
    handlerChain.push({handler: this._getSilentDependencies.bind(this, node), isError: false})
  }

  if (node.inputs && node.argInputs.length) {
    // build normal dependencies
    handlerChain.push({handler: this._getVisibleDependencies.bind(this, node), isError: false})
  }

  if (node.isLiteral) {
    // literal
    handlerChain.push({handler: getLiteralFromNode(node), isError: false})

  } else if (node.isSubgraph) {
    // subgraph
    handlerChain.push({handler: getValueFromSubgraph, isError: false})

  } else if (node.isArrayWrapper) {
    // array wrapper
    handlerChain.push({handler: getArrayFromArguments, isError: false})

  } else {
    var self = this

    if (this._config.useCallbacks) {
      // resolver with callback support
      handlerChain.push({handler: resolveWithCallback.bind(null, nodeName, node, this._config, this._profile.bind(this)), isError: false})

    } else {
      // resolver without callback support
      handlerChain.push({handler: resolveWithoutCallback.bind(null, nodeName, node, this._config, this._profile.bind(this)), isError: false})
    }
  }

  if (this._freezeOutputs && !utils.isPrivateNode(node.originalName)) {
    // freeze outputs if needed
    handlerChain.push({handler: deepFreeze, isError: false})
  }

  // handle errors
  handlerChain.push({handler: this._handleError.bind(this, node), isError: true})

  return resolver = this._resolvers[nodeName] = getResolverFromHandlerChain(handlerChain)
}

module.exports = Builder

/**
 * Resolve a node with a callback. Resolving with a callback and without a callback
 * are separate functions for minor optimization reasons
 *
 * @param {string} nodeName
 * @param {Object} node
 * @param {Object} config builder config
 * @param {Object} profiler
 * @param {{context: Object, args: Array}} data
 * @return {Promise.<Object>|Object}
 */
function resolveWithCallback(nodeName, node, config, profiler, data) {
  var context = data.context
  if (context.hasOwnProperty(nodeName)) return context[nodeName]
  if (context._hashedResponses.hasOwnProperty(node.nonSilentHash)) return context[nodeName] = context._hashedResponses[node.nonSilentHash]
  var args = data.args || []

  // start profiling
  var startTime
  if (config.enableProfiling) startTime = Date.now()

  // attach the callback
  var deferred = Q.defer()
  args.push(deferred.makeNodeResolver())

  // evaluate
  var result = node.fn.apply(null, args)
  result = (typeof result === 'undefined' ? deferred.promise : result)
  context[nodeName] = context._hashedResponses[node.nonSilentHash] = result

  // write out profiling data
  if (startTime) {
    Q.resolve(result).fin(function () {
      profiler(node.originalName, startTime)
    })
  }

  return result
}

/**
 * Resolve a node without a callback. Resolving with a callback and without a callback
 * are separate functions for minor optimization reasons
 *
 * @param {string} nodeName
 * @param {Object} node
 * @param {Object} config builder config
 * @param {Object} profiler
 * @param {{context: Object, args: Array}} data
 * @return {Promise.<Object>|Object}
 */
function resolveWithoutCallback(nodeName, node, config, profiler, data) {
  var context = data.context
  if (context.hasOwnProperty(nodeName)) return context[nodeName]
  if (context._hashedResponses.hasOwnProperty(node.nonSilentHash)) return context[nodeName] = context._hashedResponses[node.nonSilentHash]
  var args = data.args || []

  // start profiling
  var startTime
  if (config.enableProfiling) startTime = Date.now()

  // evaluate
  var result = node.fn.apply(null, args)

  // write out profiling data
  if (startTime) {
    Q.resolve(result).fin(function () {
      profiler(node.originalName, startTime)
    })
  }

  // cache the response if allowed
  context[nodeName] = context._hashedResponses[node.nonSilentHash] = result

  return result
}

/**
 * Round a number to a single significant figure
 *
 * @param {Number} the number to round
 * @return {number} the number rounded to a single sig fig
 */
function roundToOneSigFig(num) {
  if (num === 0) return num
  var mult = Math.pow(10,
        1 - Math.floor(Math.log(num) / Math.LN10) - 1);
  return Math.floor(num * mult) / mult;
}

/**
 * Creates a reusable member getter to prevent over-zealous anonymous function creation
 *
 * @param {string} nodeName
 * @return {{rootNode: string, childGetter: function(Object)}}
 */
function getTokenizedMemberGetter(nodeName) {
  if (memberGetters[nodeName]) return memberGetters[nodeName]

  var parts = nodeName.split('.')
  var rootNode = parts.shift()
  return memberGetters[nodeName] = {
    rootNode: rootNode,
    childGetter: getChildGetter(parts)
  }
}

/**
 * Create and cache a function to create a function as the getter part
 * of a member getter
 *
 * @param {Array.<string>} parts the name of the child split by '.'
 * @return {function(Object)}
 */
function getChildGetter(parts) {
  var childName = parts.join('.')
  if (childGetters[childName]) {
    return childGetters[childName]
  }

  return childGetters[childName] = function (result) {
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
  return function () {
    var outputObj = {}
    for (var i = 0; i < argNames.length; i++) {
      var name = argNames[i]
      outputObj[name] = arguments[i]
    }
    return outputObj
  }
}

/**
 * Converts an array of promises to an array of promises
 * which return NodeResponseGetter instances
 *
 * @param {Array.<Promise>} promises
 * @return {Array.<Promise.<NodeResponseGetter>>}
 */
function createGetterPromises(promises) {
  var newPromises = []
  for (var i = 0; i < promises.length; i++) {
    var getter = new NodeResponseGetter()

    newPromises.push(promises[i]
      .then(getter.setValue.bind(getter))
      .fail(getter.setError.bind(getter)))
  }
  return newPromises
}

/**
 * Retrieve the literal value for a node
 *
 * @param {Object} node
 * @return {Object}
 */
function getLiteralFromNode(node) {
  var literalHash = oid.hash(node.literalValue)
  if (literalMap[literalHash]) return literalMap[literalHash]
  return literalMap[literalHash] = function () {

    return node.literalValue
  }
}

/**
 * Retrieve the last value from an array of inputs
 *
 * @param {{args: Array}} response
 * @return {Object}
 */
function getValueFromSubgraph(response) {
  if (!response.args) return undefined
  return response.args[response.args.length - 1]
}

/**
 * Returns an array from all visible inputs
 *
 * @param {{args: Array}} response
 * @return {Array}
 */
function getArrayFromArguments(response) {
  return response.args || []
}

/**
 * Converts an array of promise handlers to a function
 * which will feed in an inbound object and return the
 * output promise
 *
 * @param {Array.<function>} handlerChain
 * @return {Promise.<Object>}
 */
function getResolverFromHandlerChain(handlerChain) {
  return function (context) {
    var promise = Q.resolve({context: context})
    for (var i = 0; i < handlerChain.length; i++) {
      if (handlerChain[i].isError) {
        promise = promise.fail(handlerChain[i].handler)
      } else {
        promise = promise.then(handlerChain[i].handler)
      }
    }
    return promise
  }
}

/**
 * Deep freeze an object
 *
 * @param {Object} data
 * @return {Object}
 */
function deepFreeze(data) {
  utils.deepFreeze(data)
  return data
}