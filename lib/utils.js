// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Provides a variety of utility functions, generally used for node
 *    name manipulation, parsing of strings vs objects for node inputs, and various
 *    generic Javascript utilities
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var OUTPUT_PREFIX_SILENT = '!'
var OUTPUT_PREFIX_OPTIONAL = '?'
var OUTPUT_SUFFIX_PRIVATE = '_'
var DYNAMIC_NODE_REF = '_dynamic'

// objects that return the early exit value will skip until an early exit
// processor is found
var EARLY_EXIT_VALUE = {exited: true}

/**
 * Deep clone an object
 *
 * @param {Object} the object to clone
 * @return {Object} a clone of the object
 */
function clone(obj) {
  if (obj == null || typeof(obj) != 'object') return obj
  var temp = obj.constructor()
  for (var key in obj) temp[key] = clone(obj[key])
  return temp
}

/**
 * Detect whether the specified node name is private
 *
 * @param {string} nodeName
 * @return {boolean} whether the node should be private
 */
function isPrivateNode(nodeName) {
  return typeof nodeName == 'string' && nodeName.charAt(nodeName.length - 1) == OUTPUT_SUFFIX_PRIVATE
}

/**
 * Detect whether the specified node name should be a silent input
 *
 * @param {string} nodeName
 * @return {boolean} whether the node should be a silent input
 */
function isSilentNode(nodeName) {
  return nodeName.charAt(0) == OUTPUT_PREFIX_SILENT
}

/**
 * Detect whether the specified node name should be an optional input
 *
 * @param {string} nodeName the name of the node
 * @return {boolean} whether the node should be an optional input
 */
function isOptionalNode(nodeName) {
  return nodeName.charAt(0) == OUTPUT_PREFIX_OPTIONAL
}

/**
 * Detect whether a node should be silent or optional and trim off any
 * "magical" prefixes if so
 *
 * @param {string} nodeName the name of the node
 * @return {string} the name of the node without "magical" prefixes
 */
function getNodeRealName(nodeName) {
  if (isSilentNode(nodeName) || isOptionalNode(nodeName)) return nodeName.substr(1)
  return nodeName
}

/**
 * Detect the root node of a given node
 *
 * @param {string} nodeName the name of the node
 * @return {string} the root node of the node provided
 */
function getNodeRootName(nodeName) {
  return getNodeRealName(nodeName).split('.')[0]
}

/**
 * Parse the node name and determine a "short" name for the node. Follows
 * these rules, returning immediately if any match:
 *    1) if the node has a '.', take anything right of the '.'
 *       e.g.: 'user.username' becomes 'username'
 *    2) if the node has a '-', take anything left of the '-'
 *       e.g.: 'user-byId' becomes 'user'
 *
 * @param {string} nodeName the name of the node
 * @return {string} the short name for the node
 */
function getNodeShortName(nodeName) {
  var newNodeName = getNodeRealName(nodeName)

  if (newNodeName.indexOf('.') !== -1) {
    var parts = newNodeName.split('.')
    return parts[parts.length - 1]
  } else {
    return newNodeName.split('-')[0]
  }
}

/**
 * Take an existing node and replace its root node with another node
 *
 * @param {string} nodeName the node to modify
 * @param {string} newRoot the new root node
 * @return {string} the original node with the new root
 */
function swapNodeRoot(nodeName, newRoot) {
  var realName = getNodeRealName(nodeName)
  var nodeRoot = getNodeRootName(realName)
  return (realName !== nodeName ? nodeName.substr(0, 1) : '') + newRoot + realName.substr(nodeRoot.length)
}

/**
 * Take in a modifier node and produce an object which specifies the arg name
 * that the input should be provided as as well as the name of the modifier node
 *
 * @param {Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} modifier the node name of the modifier or a mapping of
 *     modifier node name to the arg name that the modifi-ee should be passed to
 * @param {string} the name of the node that is being passed into the modifier
 * @return {{arg:string, nodeName:string}} the arg name to be used for input into
 *     the modifier as well as the node name for the modifier
 */
function getNodeInfoFromModifier(graph, modifier, modifiedNode) {
  if (typeof modifier === 'string') {
    // input is just a node name, deduce the field name from the modified node
    return {
      arg: getNodeShortName(modifiedNode),
      nodeName: modifier
    }
  } else if (typeof modifier === 'function') {
    // modifier is an anonymous function that takes one arg
    return {
      arg: 'val',
      nodeName: graph.addAnonymous(modifiedNode, modifier, ['val'])
    }

  } else {
    // modifier is an object of modifier name to
    for (var key in modifier) {
      return {
        arg: modifier[key],
        nodeName: key
      }
    }
  }
}

/**
 * Reads in an input object provided by .using() and creates a consistently
 * styled object which specifies the arg name for the input as well as the
 * node name being provided to the arg
 *
 * @param {Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} a node name to provide as input or an arg to node name
 *     mapping
 * @return {{arg:string, nodeName:string}} the arg name for the input and the node
 *     name to provide to that arg
 */
function getNodeInfoFromInput(graph, input) {
  if (typeof input === 'string') {
    // input is just a node name, deduce the field name and return a map of field to node
    return {
      arg: getNodeShortName(input),
      nodeName: input
    }

  } else if (typeof input === 'object') {
    if (Object.keys(input).length != 1) {
      throw new Error("Inputs must only have 1 key-value pair")
    }

    for (var key in input) {
      var nodeName = input[key]

      if (typeof nodeName === 'function') {
        // node is a function, add anonymously and use the new node name
        nodeName = graph.addAnonymous(key, nodeName)
      } else if (typeof nodeName !== 'string' && !Array.isArray(nodeName) && (typeof nodeName !== 'object' || nodeName == null)) {
        var fn = graph.literal(nodeName && nodeName.hasOwnProperty('_literal') ? nodeName._literal : nodeName)
        nodeName = graph.addAnonymous(key, fn)
      }

      return {
        arg: key,
        nodeName: nodeName
      }
    }
  } else {
    throw new Error('Invalid input type ' + JSON.stringify(input))
  }
}

/**
 * Reads in an object provided to .builds() and creates a consistently
 * styled object which specifies the name of the field to alias the original
 * node to as well as the root of the original node and the full name requested
 *
 * @param {Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} a node name to build or an alias to node name mapping
 * @return {{alias:string, rootName:string, fullName:string}} the aliased name of
 *     the new node as well as the root of the node it was aliased from and the full
 *     node that was requested by .builds()
 */
function getNodeInfoFromBuild(graph, input) {
  if (typeof input === 'string') {
    // input is just a node name, deduce the field name and return a map of field to node
    return {
      alias: input.replace(/\./g, '_'),
      aliasRealName: getNodeRealName(input.replace(/\./g, '_')),
      rootName: getNodeRootName(getNodeRealName(input)),
      fullName: getNodeRealName(input),
      rawName: input
    }

  } else if (typeof input === 'object') {
    for (var key in input) {
      var nodeName = input[key]
      if (typeof nodeName === 'function') {
        nodeName = graph.addAnonymous(key, nodeName)
      } else if (typeof nodeName !== 'string') {
        nodeName = graph.addAnonymous(key, graph.literal(nodeName))
      }

      if (isSilentNode(nodeName)) throw new Error('! and ? operators must be on the key of the .builds() object and not the value')

      return {
        alias: key,
        aliasRealName: getNodeRealName(key),
        rootName: getNodeRootName(nodeName),
        fullName: nodeName,
        rawName: nodeName
      }
    }
  } else {
    throw new Error('Invalid input type ' + JSON.stringify(input))
  }
}

/**
 * Deep freeze an object. Copied from Mozilla's Object.freeze page:
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/freeze
 *
 * @param {Object}
 */
function deepFreeze(o) {
  var prop, propKey
  Object.freeze(o) // First freeze the object.
  for (propKey in o) {
    prop = o[propKey]
    if (!(o.hasOwnProperty(propKey)) || typeof prop !== "object" || Object.isFrozen(prop)) {
      // If the object is on the prototype, not an object, or is already frozen,
      // skip it. Note that this might leave an unfrozen reference somewhere in the
      // object if there is an already frozen object containing an unfrozen object.
      continue
    }

    deepFreeze(prop) // Recursively call deepFreeze.
  }
}

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

module.exports = {
  clone: clone,
  deepFreeze: deepFreeze,

  isSilentNode: isSilentNode,
  isOptionalNode: isOptionalNode,
  isPrivateNode: isPrivateNode,

  getNodeRealName: getNodeRealName,
  getNodeShortName: getNodeShortName,
  getNodeRootName: getNodeRootName,
  swapNodeRoot: swapNodeRoot,

  getNodeInfoFromBuild: getNodeInfoFromBuild,
  getNodeInfoFromInput: getNodeInfoFromInput,
  getNodeInfoFromModifier: getNodeInfoFromModifier,

  generateModifierNodeName: generateModifierNodeName,

  EARLY_EXIT_VALUE: EARLY_EXIT_VALUE,
  DYNAMIC_NODE_REF: DYNAMIC_NODE_REF
}
