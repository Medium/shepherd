// Copyright 2012 The Obvious Corporation.
var crypto = require('crypto')
var DependencyManager = require('./DependencyManager')
var NodeInstance = require('./NodeInstance')
var oid = require('oid')
var Q = require('kew')
var utils = require('./utils')

/**
 * Create a builder which takes in user inputs in order to perform the work
 * of traversing a Graph instance optimally
 *
 * @param {Graph} graph an instance of Graph which contains the NodeDefinition
 *     instances to use
 * @constructor
 */
function Builder(graph) {
  this._graph = graph
  this._nodes = {}
  this._builds = {}
  this._silentBuilds = {}
}

/**
 * Specify that this Builder should build a specific node name
 *
 * @param {string|Object} field a field name to build or an alias to field name mapping
 * @return {NodeInstance} a NodeInstance for the specified field
 */
Builder.prototype.builds = function (field) {
  if (typeof field === 'string') {
    var fieldObj = {}
    fieldObj[field] = field
    return this.builds(fieldObj)
  }

  for (var alias in field) {
    var fieldName = field[alias]
    var aliasRealName = utils.getNodeRealName(alias)
    var aliasRootName = utils.getNodeRootName(alias)
    var fieldRootName = utils.getNodeRootName(fieldName)

    if (utils.isSilentNode(alias)) this._silentBuilds[aliasRealName] = 1
    else if (!utils.isOptionalNode(alias)) this._builds[aliasRealName] = 1

    var node = this._nodes[aliasRootName] = new NodeInstance(this, aliasRealName, fieldRootName, this._graph._nodeDefinitions[fieldRootName])
    return node
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
 */
Builder.prototype.compile = function () {
  var key, subkey, i, j, node

  this._compiled = {
    nodes: {},
    nodePrefixIdx: 0
  }

  // create a list of all nodes at the root of the builder
  var depManager = new DependencyManager(this._graph)
  var modifiers = {}
  var inputs = {}
  for (key in this._nodes) {
    node = this._nodes[key]
    var nodeRoot = utils.getNodeRootName(key)
    inputs[nodeRoot] = {}
    modifiers[nodeRoot] = []
    depManager.addNode(nodeRoot)

    // extract peers from the list of modifiers
    for (i = 0; i < node._modifiers.length; i += 1) {
      var modifier = utils.getNodeInfoFromModifier(this._graph, node._modifiers[i], nodeRoot)
      modifiers[nodeRoot].push(modifier)
      var modifierNodeRoot = utils.getNodeRootName(modifier.nodeName)
      depManager.addDependency(nodeRoot, modifierNodeRoot)
    }

    // extract peers from the list of inputs
    for (i = 0; i < node._inputs.length; i += 1) {
      var input = utils.getNodeInfoFromInput(this._graph, node._inputs[i])
      inputs[nodeRoot][input.arg] = input.nodeName
      var inputNodeRoot = utils.getNodeRootName(input.nodeName)
      depManager.addDependency(nodeRoot, inputNodeRoot)
    }
  }

  // compile all needed nodes
  this._compilePeers(depManager, inputs, modifiers, true)

  // remove duplicate nodes
  var hashesToNodes = {}
  var nodesToHashes = {}
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    nodesToHashes[key] = node.hash
    if (!hashesToNodes[node.hash]) {
      hashesToNodes[node.hash] = key
    } else {
      this._compiled.nodes[key] = {
        copyOf: hashesToNodes[node.hash],
        hash: node.hash
      }
    }
  }

  var requiredFields = {}

  // remap deleted nodes to deduplicated nodes
  for (key in this._compiled.nodes) {
    node = this._compiled.nodes[key]
    for (subkey in node.inputs) {
      var rootNode = utils.getNodeRootName(node.inputs[subkey])
      if (this._compiled.nodes[rootNode] && this._compiled.nodes[rootNode].copyOf) rootNode = this._compiled.nodes[rootNode].copyOf
      if (nodesToHashes[rootNode]) node.inputs[subkey] = utils.swapNodeRoot(node.inputs[subkey], hashesToNodes[nodesToHashes[rootNode]])

      // retrieve a list of required fields for each input
      var nodeParts = subkey.split('.')
      if (this._compiled.nodes[rootNode] && this._compiled.nodes[rootNode].copyOf) rootNode = this._compiled.nodes[rootNode].copyOf
      if (nodeParts.length < 2 || typeof requiredFields[rootNode] === 'string') requiredFields[rootNode] = '*'
      else {
        if (typeof requiredFields[rootNode] === 'undefined') requiredFields[rootNode] = {}
        requiredFields[rootNode][nodeParts[1]] = 1
      }
    }
  }

  // check any nodes that need to be built at the top of this builder for required fields
  for (key in this._builds) {
    var buildNodeParts = key.split('.')
    var buildNodeRoot = buildNodeParts.shift()
    if (this._compiled.nodes[buildNodeRoot] && this._compiled.nodes[buildNodeRoot].copyOf) buildNodeRoot = this._compiled.nodes[buildNodeRoot].copyOf
    if (!buildNodeParts.length || typeof requiredFields[buildNodeRoot] === 'string') requiredFields[buildNodeRoot] = '*'
    else {
      if (typeof requiredFields[buildNodeRoot] === 'undefined') requiredFields[buildNodeRoot] = {}
      requiredFields[buildNodeRoot][buildNodeParts.shift()] = 1
    }
  }

  // check any silent nodes that need to be built at the top of this builder for required fields
  for (key in this._silentBuilds) {
    var silentNodeParts = key.split('.')
    var silentNodeRoot = silentNodeParts.shift()
    if (this._compiled.nodes[silentNodeRoot] && this._compiled.nodes[silentNodeRoot].copyOf) silentNodeRoot = this._compiled.nodes[silentNodeRoot].copyOf
    if (!silentNodeParts.length || typeof requiredFields[silentNodeRoot] === 'string') requiredFields[silentNodeRoot] = '*'
    else {
      if (typeof requiredFields[silentNodeRoot] === 'undefined') requiredFields[silentNodeRoot] = {}
      requiredFields[silentNodeRoot][silentNodeParts.shift()] = 1
    }
  }

  // update the dependencies for each required field
  for (key in requiredFields) {
    if (this._compiled.nodes[key]) {
      this._compiled.nodes[key].requiredFields = typeof requiredFields[key] === 'string' ? requiredFields[key] : Object.keys(requiredFields[key])
    }
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
  if (!this._compiled) this.compile()
  var builds = this._builds
  var i, key

  // create a clean object for running this build
  for (key in data) data[key] = Q.resolve(data[key])
  data._hashedResponses = {}
  data._resolve = this._resolve.bind(this, data)

  // set up promises to retrieve all of the nodes
  var promises = []
  for (key in builds) promises.push(data._resolve(key))
  for (key in this._silentBuilds) promises.push(data._resolve(key))

  // start resolving all of the top level nodes
  var promise = Q.all(promises)
    .then(function (results) {
      var outputMap = {}
      i = 0
      for (var key in builds) {
        outputMap[key] = results[i++]
      }
      return outputMap
    })

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
 * Produce a hash for a specified node by gathering hashes of its own handler
 * function as well as the hashes of dependency nodes and hashes of any node
 * names which aren't nodes in the graph (may be provided as run time inputs)
 *
 * @param {string} nodeName the name of the node
 * @return {string} a hash which represents the handler of this node and all
 *     inputs. may be identical to another node's hash if it takes in the
 *     same inputs and uses the same handler (used for de-duplication of nodes)
 */
Builder.prototype._generateHashForNode = function (nodeName) {
  var node = this._compiled.nodes[nodeName]
  var hasher = crypto.createHash('md5')

  // if the node doesn't exist, just hash the name
  if (!node) {
    hasher.update(nodeName)
    return hasher.digest('hex')
  }

  // update with whether the cache was disabled or not
  hasher.update(node.cacheDisabled ? '1|' : '0|')

  // loop through all inputs and use their hashes if they exist, otherwise hash their names
  for (var key in node.inputs) {
    var depNodeName = utils.getNodeRootName(node.inputs[key])
    var depFullName = utils.getNodeRealName(node.inputs[key])
    if (!this._compiled.nodes[depNodeName]) {
      hasher.update(depFullName + '|')
    } else {
      hasher.update(this._compiled.nodes[depNodeName].hash + depFullName.substr(depNodeName.length) + '|')
    }
  }

  return oid.hash(node.fn) + '-' + hasher.digest('hex')
}

/**
 * Copy a node to a node of a new name
 *
 * @param {string} nodeName the node to copy
 * @param {string} newNodeName the name of the new node
 * @return {Object} the compiled node data
 */
Builder.prototype._copyNode = function (nodeName, newNodeName) {
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
  for (var i = 0; i < def._args.length; i += 1) {
    var argNode = utils.getNodeInfoFromBuild(this._graph, def._args[i])
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
 * Iterate over all modifiers defined by the node itself and add them as dependencies to
 * be built
 *
 * @param {DependencyManager} depManager the dependency manager to use for setting up dependencies
 * @param {NodeDefinition} def the definition of the node to setup modifier nodes for
 * @param {string} nodeName the name of the node being processed (used for determining arg names)
 * @return {Array.<Object>} an array of details about modifiers to be created (as defined by
 *     utils.getNodeInfoFromModifier)
 */
Builder.prototype._setupModifiersForNode = function (depManager, def, nodeName) {
  var modifierInfo = []

  for (var i = 0; i < def._modifiers.length; i += 1) {
    var modifier = utils.getNodeInfoFromModifier(this._graph, def._modifiers[i], nodeName)
    modifierInfo.push(modifier)
    depManager.addNode(modifier.nodeName)
  }

  return modifierInfo
}

/**
 * Iterate over modifiers that have been created for a node and create a modifier chain which
 * will transform the output of the node by running through the modifiers at runtime
 *
 * @param {string} nodeName the name of the current node
 * @param {NodeDefinition} def the definition of the node to setup arg nodes for
 * @param {Array.<Object>} nodeModifiers a list of modifiers that this node should be ran through
 *     as specified by a parent node or a NodeInstance
 * @param {Object} peers a mapping of peer names to their compiled (data) representations
 * @param {Object} modifierInfo an array of details about modifiers to be created (as defined by
 *     utils.getNodeInfoFromModifier)
 * @param {Object} children a list of "compiled" node data for any children created by this node
 */
Builder.prototype._applyModifiersToNode = function (nodeName, def, nodeModifiers, peers, modifierInfo, children) {
  var i, modifier, modifierNode, currentNodeName, nextNodeName
  var modifierIdx = 0

  // relocate the root node if there are any modifiers
  if (def._modifiers.length || nodeModifiers.length) {
    this._copyNode(nodeName, generateModifierNodeName(nodeName, ++modifierIdx))
  }

  // apply any modifiers from the node itself
  for (i = 0; i < def._modifiers.length; i += 1) {
    // retrieve the info for this modifier and generate new names for the modifier nodes
    modifier = modifierInfo[i]
    currentNodeName = generateModifierNodeName(nodeName, modifierIdx)
    nextNodeName = generateModifierNodeName(nodeName, ++modifierIdx)

    // copy the modifier into the node chain as -modifier-SOME_IDX
    modifierNode = this._copyNode(children[modifier.nodeName].newName, nextNodeName)

    // set the arg for input into the modifier to the previous node in the chain
    modifierNode.inputs[modifier.arg] = currentNodeName

    // update the hash for the modifier
    modifierNode.hash = this._generateHashForNode(nextNodeName)

    // copy the modifier into the final node in the chain (without a -modifier_SOME_IDX suffix)
    this._copyNode(nextNodeName, nodeName)
  }

  // apply any modifiers from the node's parent
  for (i = 0; i < nodeModifiers.length; i += 1) {
    // retrieve the info for this modifier and generate new names for the modifier nodes
    modifier = nodeModifiers[i]
    currentNodeName = generateModifierNodeName(nodeName, modifierIdx)
    nextNodeName = generateModifierNodeName(nodeName, ++modifierIdx)

    // copy the modifier into the node chain as -modifier-SOME_IDX
    modifierNode = this._copyNode(peers[modifier.nodeName].newName, nextNodeName)

    // set the arg for input into the modifier to the previous node in the chain
    modifierNode.inputs[modifier.arg] = currentNodeName

    // update the hash for the modifier
    modifierNode.hash = this._generateHashForNode(nextNodeName)

    // copy the modifier into the final node in the chain (without a -modifier_SOME_IDX suffix)
    this._copyNode(nextNodeName, nodeName)
  }
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
  var i, j
  var provideMap = {}
  var modifierMap = {}

  // set up nodes for any fields that need to be built
  for (i = 0; i < def._builds.length; i += 1) {
    var toBuild = def._builds[i]
    var toBuildNode = utils.getNodeInfoFromBuild(this._graph, toBuild.field)
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

      if (provided.nodeName.length >= 5 && provided.nodeName.substr(0, 5) == 'args.') {
        // node takes an argument that was passed into this node
        var nodeName = provided.nodeName.substr(5)
        var nodeRoot = utils.getNodeRootName(nodeName)
        var newRootNode = args[nodeRoot]
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
  if (!def) return {originalName: originalNodeName, newName: originalNodeName, hash: this._generateHashForNode(originalNodeName)}

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
    inputs[key] = peers[nodeRealName] ? peers[nodeRealName].newName : nodeRealName
    silentInputs.push(key)
  }

  // mark any modifiers that should be created as dependencies
  var modifierInfo = this._setupModifiersForNode(depManager, def, originalNodeName)

  // read through any nodes that need to be built by this node and set up their inter-dependencies
  var childData = this._setupChildNodes(def, depManager, args, peers)

  // compile the child nodes
  var children = this._compilePeers(depManager, childData.provideMap, childData.modifierMap, false)
  for (key in args) {
    var rootNode = utils.getNodeRootName(args[key])
    if (children[rootNode]) inputs[key] = utils.swapNodeRoot(args[key], children[rootNode].newName)
    else inputs[key] = args[key]
  }

  // create the node
  var node = this._compiled.nodes[newNodeName] = {
    originalName: originalNodeName,
    newName: newNodeName,
    inputs: inputs,
    argInputs: argInputs,
    silentInputs: silentInputs,
    fn: def._fn,
    requiredFields: '*',
    modifiers: modifiers,
    cacheDisabled: !!def._cacheDisabled
  }
  node.hash = this._generateHashForNode(newNodeName)

  // post-process the node compilation by setting up a modifier chain (if needed) which will change
  // the ultimate output of the node
  this._applyModifiersToNode(newNodeName, def, nodeModifiers, peers, modifierInfo, children)

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

        var node = isBuilder && this._nodes[utils.getNodeRootName(nodeName)] ? this._nodes[utils.getNodeRootName(nodeName)] : undefined
        peers[key] = this._compileNode(node ? node._nodeName : nodeName, key + nodeSuffix, peers, utils.clone(nodeInputs[key] || {}), utils.clone(nodeModifiers[key] || {}), node && node._def)
      }
    }

  } while (compiledAnyNode)

  // TODO: check if any nodes are still unprocessed

  return peers
}

/**
 * Retrieve the value of a given node in this Builder run-through
 *
 * @param {Object} data any data created by this run-through so far
 * @param {string} nodeName the name of the node to retrieve
 * @return {Promise.<Object>} a promise which will return the value
 *     of the node once it has been resolved
 */
Builder.prototype._resolve = function (data, nodeName) {
  var originalNodeName = nodeName
  var i
  nodeName = utils.getNodeRealName(nodeName)
  var node = this._compiled.nodes[nodeName]
  var hashKey = node ? node.hash : '_input_' + nodeName

  // dot notation
  if (nodeName.indexOf('.') !== -1) {
    var parts = nodeName.split('.')
    return data._resolve(parts[0])
      .then(function (result) {
        for (var i = 1; i < parts.length; i += 1) {
          if (!result) return result
          result = result[parts[i]]
        }
        return result
      })
  }

  // check if there's a result *only* if there isn't a node or caching on the
  // node hasn't been disabled
  if (!node || !node.cacheDisabled) {
    if (data.hasOwnProperty(nodeName)) {
      return data[nodeName]
    }
  }

  // node already exists in data
  if (node && node.copyOf) return data._resolve(node.copyOf)

  // find all dependencies
  if (typeof node === 'undefined') return data[nodeName] = data._hashedResponses[hashKey] = Q.reject(new Error("Unable to find node '" + nodeName + "'"))
  var promises = []
  var ordering = {}
  var depNodes = []
  if (node.inputs) {
    var inputs = node.inputs
    var key
    for (i = 0; i < node.argInputs.length; i += 1) {
      key = node.argInputs[i]
      if (inputs[key] === '_requiredFields') {
        promises.push(Q.resolve(node.requiredFields)) //node.requiredFields))
      } else {
        promises.push(data._resolve(inputs[key]))
      }
      depNodes.push(inputs[key])
    }
    for (i = 0; i < node.silentInputs.length; i += 1) {
      key = node.silentInputs[i]
      promises.push(data._resolve(inputs[key]))
      depNodes.push(inputs[key])
    }
  }

  var interval

  // wait for dependencies to resolve
  return data[nodeName] = data._hashedResponses[hashKey] = Q.all(promises)
    .then(function (results) {
      // compose the args for the function to call
      var args = node.argInputs.length ? results.slice(0, node.argInputs.length) : []

      // add a deferred callback
      var deferred = Q.defer()
      args.push(deferred.makeNodeResolver())

      // call the function
      var result = node.fn.apply(null, args)
      return typeof result === 'undefined' ? deferred.promise : result
    })
}

module.exports = Builder

/**
 * Generate a modifier node name for a given node and modifier chain index
 *
 * @param {string} nodeName
 * @param {number} modifierIdx
 * @return {string} the name of the modifier node
 */
function generateModifierNodeName(nodeName, modifierIdx) {
  return nodeName + '-modifier' + modifierIdx
}