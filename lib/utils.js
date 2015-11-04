// Copyright 2012 The Obvious Corporation.
/**
 * @fileoverview Provides a variety of utility functions, generally used for node
 *    name manipulation, parsing of strings vs objects for node inputs, and various
 *    generic Javascript utilities
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var OUTPUT_PREFIX_IMPORTANT = '!'
var OUTPUT_PREFIX_PARTIAL = '%'
var OUTPUT_PREFIX_VOID = '?'
var OUTPUT_SUFFIX_PRIVATE = '_'

var NODE_NAME_RE = /^[!?+%]?[a-zA-Z_*][-a-zA-Z0-9_]*(?:[.][a-zA-Z_][a-zA-Z0-9_]*)*(?:[._](?:[0-9]+|[*]))?$/

var DYNAMIC_NODE_REF = '_dynamic'
var INPUT_ARG_PREFIX = 'args.'
var LAZY_ARG_PREFIX = 'lazyargs.'
var WILDCARD_PATTERN = '*'
var NODE_PREFIX_BUILDER_OUTPUT = 'builderOutput'
var NODE_PREFIX_AGGREGATOR_RETURN_VAL = 'returnVal'

var ErrorMode = {
  WARN: 1,
  ERROR: 2
}

function assertValidNodeName(name) {
  if (!NODE_NAME_RE.test(name)) {
    throw new Error('invalid node name: ' + name)
  }
}

/**
 * @param {string} sourceName The name of the node that we're building.
 * @param {string=} targetName The name of the node that we're mapping to.
 * @constructor
 */
// TODO(nick): Come up with better names for these properties.
function NodeInfo(sourceName, targetName) {
  assertValidNodeName(sourceName)
  if (targetName) assertValidNodeName(targetName)

  /** @type {string} */
  this.fullName = getNodeRealName(sourceName)

  /** @type {string} */
  this.rootName = getNodeRootName(this.fullName)

  /** @private {string} */
  this._alias = targetName ? targetName : sourceName.replace(/\./g, '_')

  /** @type {string} */
  this.aliasRealName = getNodeRealName(this._alias)

  /**
   * Whether this represents one node mapped to another.
   * @type {boolean}
   */
  this._isMapped = !!targetName
}

/** @return {string} */
NodeInfo.prototype.getRootName = function () {
  return this.rootName
}

/** @return {NodeInfo} */
NodeInfo.prototype.clone = function () {
  var result = new NodeInfo(this.fullName, this._alias)
  result._isMapped = this._isMapped
  return result
}

/**
 * @param {./Graph} graph
 * @return {NodeInfo}
 */
NodeInfo.prototype.getOutputNodeInfo = function (graph) {
  var outputName = this._isMapped ? this._alias : this.fullName
  return getNodeInfoFromBuild(graph, outputName)
}

/**
 * @param {NodeInfo} other
 * @return {boolean}
 */
NodeInfo.prototype.isSameAlias = function (other) {
  return this._alias === other._alias
}

/**
 * @return {string}
 */
NodeInfo.prototype.getAlias = function () {
  return this._alias
}

/** @return {string} */
NodeInfo.prototype.getAliasRootName = function () {
  return getNodeRootName(this.aliasRealName)
}


/** @return {boolean} */
NodeInfo.prototype.isImportant = function () {
  return isImportantNode(this._alias)
}


/** @return {boolean} */
NodeInfo.prototype.isVoid = function () {
  return isVoidNode(this._alias)
}


/** @return {boolean} */
NodeInfo.prototype.isPartial = function () {
  return isPartialNode(this._alias)
}


/**
 * @param {string} arg The arg name for the input node.
 * @param {string|Object} nodeName The node to provide to the arg.
 * @constructor
 */
function NodeArgInfo(arg, nodeName) {
  assertValidNodeName(arg)
  if (typeof nodeName == 'string') assertValidNodeName(nodeName)

  /** @type {string} */
  this.arg = arg

  /**
   * Sometimes, the NodeDefinition builder temporarily stores literals
   * on nodeName and resolves them later. By the time this gets to Builder,
   * nodeName should always be a string.
   * @type {string|Object}
   */
  this.nodeName = nodeName
}

/** @return {?string} */
NodeArgInfo.prototype.getRootName = function () {
  if (typeof this.nodeName === 'string') {
    return getNodeRootName(this.nodeName)
  }
  return null
}


/** @return {boolean} */
NodeArgInfo.prototype.isImportant = function () {
  if (typeof this.nodeName === 'string') {
    return isImportantNode(this.nodeName)
  }
  return false
}


/**
 * Deep clone an object
 *
 * @param {T} obj
 * @return {T} a clone of the object
 * @template T
 */
function clone(obj) {
  if (obj == null || typeof(obj) != 'object') return obj

  if ((typeof obj.clone == 'function') && obj.clone.length === 0) {
    return obj.clone()
  }

  var ctor = obj.constructor
  if (ctor.length !== 0 && ctor !== Object && ctor !== Array) {
    throw new Error('Object is uncloneable: ' + obj)
  }

  var temp = ctor()
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
 * Detect whether the specified node name should be a important input
 *
 * @param {string} nodeName
 * @return {boolean} whether the node should be a important input
 */
function isImportantNode(nodeName) {
  return nodeName.charAt(0) == OUTPUT_PREFIX_IMPORTANT
}

/**
 * Detect whether the specified node name should be a void input, whose
 * value is not passed to the graph.
 *
 * @param {string} nodeName the name of the node
 * @return {boolean} whether the node should be a void input.
 */
function isVoidNode(nodeName) {
  return nodeName.charAt(0) == OUTPUT_PREFIX_VOID
}

/**
 * Detect whether the specified node name should be a partial void input.
 * A partial input is usually not built; it's just used to configure
 * nodes for somebody else's using clause.
 *
 * @param {string} nodeName the name of the node
 * @return {boolean} whether the node should be a void input.
 */
function isPartialNode(nodeName) {
  return nodeName.charAt(0) == OUTPUT_PREFIX_PARTIAL
}

/**
 * Detect whether a node should be important or optional and trim off any
 * "magical" prefixes if so
 *
 * @param {string} nodeName the name of the node
 * @return {string} the name of the node without "magical" prefixes
 */
function getNodeRealName(nodeName) {
  if (isImportantNode(nodeName) || isVoidNode(nodeName) || isPartialNode(nodeName)) return nodeName.substr(1)
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
 * @private
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
 * Parse the node name and determine a the name used for injector functions.
 *    1) Argument references like "a.b" are stored as-is, so lop off anything
 *       to the right of the "."
 *    2) if the node has a '-', take anything left of the '-'
 *       e.g.: 'user-byId' becomes 'user'
 *    3) Property references like "a.b" are stored internally as "a_b", so lop
 *       off anything to the right of the "_".
 *
 * @param {string} nodeName the name of the node
 * @return {string} the short name for the node
 */
function getNodeInjectorName(nodeName) {
  var lastDot = nodeName.lastIndexOf('.', nodeName.length - 2)
  if (lastDot !== -1) {
    nodeName = nodeName.substring(lastDot + 1)
  }

  var firstDash = nodeName.indexOf('-')
  if (firstDash !== -1) {
    nodeName = nodeName.substring(0, firstDash)
  }

  var lastUnderscore = nodeName.lastIndexOf('_', nodeName.length - 2)
  if (lastUnderscore !== -1) {
    nodeName = nodeName.substring(lastUnderscore + 1)
  }

  return nodeName
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
 * @param {./Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} modifier the node name of the modifier or a mapping of
 *     modifier node name to the arg name that the modifi-ee should be passed to
 * @param {string} modifiedNode the name of the node that is being passed into the modifier
 * @return {NodeArgInfo} the arg name to be used for input into
 *     the modifier as well as the node name for the modifier
 */
function getNodeInfoFromModifier(graph, modifier, modifiedNode) {
  if (typeof modifier === 'function') {
    // modifier is an anonymous function that takes one arg
    return new NodeArgInfo('val', graph.addAnonymous(modifiedNode, modifier, ['val']))
  }

  var inputPair = getInputPair(modifier)
  if (inputPair.length == 1) {
    // input is just a node name, deduce the field name from the modified node
    return new NodeArgInfo(getNodeShortName(modifiedNode), inputPair[0])
  } else {
    // modifier is an object of modifier name to value.
    return new NodeArgInfo(inputPair[1], inputPair[0])
  }
}


/**
 * @param {string|Object} input A graph node spec.
 * @return {Array} A one or two element array for [target, sourceSpec].
 *     The target must be a string, but the sourceSpec types depend on context.
 */
function getInputPair(input) {
  if (typeof input === 'string') {
    return [input]
  } else if (input && (typeof input === 'object')) {
    var keys = Object.keys(input)
    if (keys.length != 1) {
      throw new Error('Inputs must only have 1 key-value pair')
    }
    var key = keys[0]
    var val = input[key]
    return [key, val]
  } else {
    throw new Error('Invalid input type ' + JSON.stringify(input))
  }
}


/**
 * Reads in an input object provided by .using() and creates a consistently
 * styled object which specifies the arg name for the input as well as the
 * node name being provided to the arg
 *
 * @param {./Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} input a node name to provide as input or an arg to node name
 *     mapping
 * @return {NodeArgInfo} the arg name for the input and the node
 *     name to provide to that arg
 */
function getNodeInfoFromInput(graph, input) {
  var inputPair = getInputPair(input)
  if (inputPair.length == 1) {
    // input is just a node name, deduce the field name and return a map of field to node
    return new NodeArgInfo(getNodeShortName(inputPair[0]), inputPair[0])

  } else {
    var key = inputPair[0]
    var nodeName = inputPair[1]

    if (typeof nodeName === 'function') {
      // node is a function, add anonymously and use the new node name
      nodeName = graph.addAnonymous(key, nodeName)
    } else if (typeof nodeName !== 'string' && !Array.isArray(nodeName) && (typeof nodeName !== 'object' || nodeName == null)) {
      var fn = graph.literal(nodeName && nodeName.hasOwnProperty('_literal') ? nodeName._literal : nodeName)
      nodeName = graph.addAnonymous(key, fn)
    }

    return new NodeArgInfo(key, nodeName)
  }
}

/**
 * Reads in an object provided to .builds() and creates a consistently
 * styled object which specifies the name of the field to alias the original
 * node to as well as the root of the original node and the full name requested
 *
 * @param {./Graph} graph the Graph instance that should be used if anonymous functions
 *     should be added
 * @param {string|Object} input a node name to build or an alias to node name mapping
 * @return {NodeInfo} the aliased name of
 *     the new node as well as the root of the node it was aliased from and the full
 *     node that was requested by .builds()
 */
function getNodeInfoFromBuild(graph, input) {
  var inputPair = getInputPair(input)
  if (inputPair.length == 1) {
    // input is just a node name, deduce the field name and return a map of field to node
    return new NodeInfo(inputPair[0])
  } else {
    var key = inputPair[0]
    var nodeName = inputPair[1]
    if (typeof nodeName === 'function') {
      nodeName = graph.addAnonymous(key, nodeName)
    } else if (typeof nodeName !== 'string') {
      nodeName = graph.addAnonymous(key, graph.literal(nodeName))
    }

    if (isImportantNode(nodeName)) throw new Error('! and ? operators must be on the key of the .builds() object and not the value')
    return new NodeInfo(nodeName, key)
  }
}

/**
 * Deep freeze an object. Copied from Mozilla's Object.freeze page:
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/freeze
 *
 * @param {Object} o
 */
function deepFreeze(o) {
  var prop, propKey
  Object.freeze(o) // First freeze the object.
  for (propKey in o) {
    prop = o[propKey]
    if (!(o.hasOwnProperty(propKey)) || typeof prop !== 'object' || Object.isFrozen(prop)) {
      // If the object is on the prototype, not an object, or is already frozen,
      // skip it. Note that this might leave an unfrozen reference somewhere in the
      // object if there is an already frozen object containing an unfrozen object.
      continue
    }

    deepFreeze(prop) // Recursively call deepFreeze.
  }
}

/**
 * @param {string} name
 * @return {boolean}
 */
function isArgRef(name) {
  return name.lastIndexOf(INPUT_ARG_PREFIX, 0) === 0
}

/**
 * @param {string} name
 * @return {?string}
 */
function getArgRef(name) {
  return isArgRef(name) ? name.substr(INPUT_ARG_PREFIX.length) : null
}

/**
 * @param {string} name
 * @return {boolean}
 */
function isWildcardArgRef(name) {
  return getArgRef(name) === WILDCARD_PATTERN
}

/**
 * @param {string} name
 * @return {boolean}
 */
function isLazyArgRef(name) {
  return name.lastIndexOf(LAZY_ARG_PREFIX, 0) === 0
}

/**
 * @param {string} name
 * @return {?string}
 */
function getLazyArgRef(name) {
  return isLazyArgRef(name) ? name.substr(LAZY_ARG_PREFIX.length) : null
}

/**
 * Parse out the parameter names from a function
 *
 * @param {Function} fn The function to parse
 * @return {Array.<string>} The parameters
 */
function parseFnParams(fn) {
  var fnStr = fn.toString()
    , lParenIdx = fnStr.indexOf('(')
    , rParenIdx = fnStr.indexOf(')')
    , paramsStr
    , params
    , i

  // Check for existence of parentheses
  if (lParenIdx === -1 || rParenIdx === -1) {
    throw new Error('Invalid function')
  }

  // Isolate parameters
  paramsStr = fnStr.substring(lParenIdx + 1, rParenIdx)
  if (paramsStr === '') {
    return []
  }
  params = paramsStr.split(',')

  // Remove whitespace
  for (i = 0; i < params.length; i++) {
    params[i] = params[i].trim()
  }

  return params
}


module.exports = {
  ErrorMode: ErrorMode,

  // exposed for testing
  assertValidNodeName: assertValidNodeName,

  clone: clone,
  deepFreeze: deepFreeze,
  parseFnParams: parseFnParams,

  isPrivateNode: isPrivateNode,

  isArgRef: isArgRef,
  isWildcardArgRef: isWildcardArgRef,
  getArgRef: getArgRef,
  isLazyArgRef: isLazyArgRef,
  getLazyArgRef: getLazyArgRef,

  getNodeRealName: getNodeRealName,
  getNodeInjectorName: getNodeInjectorName,
  getNodeRootName: getNodeRootName,
  swapNodeRoot: swapNodeRoot,

  NodeInfo: NodeInfo,
  NodeArgInfo: NodeArgInfo,
  getNodeInfoFromBuild: getNodeInfoFromBuild,
  getNodeInfoFromInput: getNodeInfoFromInput,
  getNodeInfoFromModifier: getNodeInfoFromModifier,
  isImportantNode: isImportantNode,

  nullFunction: function() {},

  OUTPUT_PREFIX_IMPORTANT: OUTPUT_PREFIX_IMPORTANT,
  OUTPUT_PREFIX_PARTIAL: OUTPUT_PREFIX_PARTIAL,
  OUTPUT_PREFIX_VOID: OUTPUT_PREFIX_VOID,
  OUTPUT_SUFFIX_PRIVATE: OUTPUT_SUFFIX_PRIVATE,
  DYNAMIC_NODE_REF: DYNAMIC_NODE_REF,
  NODE_PREFIX_BUILDER_OUTPUT: NODE_PREFIX_BUILDER_OUTPUT,
  NODE_PREFIX_AGGREGATOR_RETURN_VAL: NODE_PREFIX_AGGREGATOR_RETURN_VAL
}
