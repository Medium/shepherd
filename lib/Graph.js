// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for Graph which maintains a
 *     registry of all nodes that Builders are able to build. Nodes represent
 *     units of work and may have dependencies of other nodes.
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

var Builder = require('./Builder')
var NodeDefinition = require('./NodeDefinition')
var NodeInstance = require('./NodeInstance')
var Q = require('kew')
var utils = require('./utils')

/**
 * Create a graph of NodeDefinitions which can be pieced together to
 * perform complicated operations optimally
 *
 * @constructor
 */
function Graph() {
  this._config = {
    enforceTwoPartNames: false,
    forceClone: false,
    readyHandlers: [],
    profilingEnabled: false,
    useCallbacks: true
  }

  this._state = {
    isReady: false,
    anonymousBuilderCounter: 0,
    anonymousFnCounter: 0,
    scope: 'default'
  }

  this._builders = {}
  this._clones = []
  this._nodeDefinitions = {}
}

/**
 * Set the scope for nodes added to the graph. This
 * is primarily used for "private" nodes to ensure that
 * they're only accessed from within the proper scope
 *
 * @param {string} scope
 */
Graph.prototype.setScope = function (scope) {
  this._state.scope = scope
}

/**
 * Get the scope for a specific node
 *
 * @param {string} nodeName
 * @return {string} the scope
 */
Graph.prototype.getNodeScope = function (nodeName) {
  return this._nodeDefinitions[nodeName]
}

/**
 * Get a map of all builders attached to this graph
 *
 * @return {Object} map of builder names to builders
 */
Graph.prototype.getBuilders = function () {
  return this._builders
}

/**
 * Get a list of all clones of this graph
 *
 * @return {Array.<Graph>} clones of this graph
 */
Graph.prototype.getClones = function () {
  return this._clones
}

/**
 * Add a function to run when the Graph is ready
 * to be used and fully loaded
 *
 * @param {function()} fn function to run when the graph
 *     is loaded
 */
Graph.prototype.onReady = function (fn) {
  if (this._state.isReady) fn()
  else this._config.readyHandlers.push(fn)
}

/**
 * Mark the Graph as being ready to use and run
 * any ready handlers
 */
Graph.prototype.ready = function () {
  this._state.isReady = true
  while (this._config.readyHandlers.length) {
    var fn = this._config.readyHandlers.shift()
    fn()
  }
}

/**
 * Find nodes which match a set of search words. This may be
 * called with an array of words to search for *or* with each
 * word as a separate parameter to the function.
 *
 * @param {Array.<string>} searchWords
 * @return {Object} map of nodes to their descriptions
 */
Graph.prototype.findNodes = function (searchWords) {
  if (searchWords && !Array.isArray(searchWords)) searchWords = Array.prototype.slice.call(arguments, 0)
  searchWords = searchWords || []
  var descriptions = {}

  for (var key in this._nodeDefinitions) {
    var description = this._nodeDefinitions[key].getDescription()
    var searchTerms = (key + ' ' + (description || '')).toLowerCase()
    var found = true

    // match the node name against all search words
    for (var i = 0; i < searchWords.length && found; i++) {
      if (searchTerms.indexOf(searchWords[i].toLowerCase()) === -1) found = false
    }

    if (found) descriptions[key] = description
  }

  return descriptions
}

/**
 * Find builders which match a set of search words. This may be
 * called with an array of words to search for *or* with each
 * word as a separate parameter to the function.
 *
 * @param {Array.<string>} searchWords
 * @return {Object} map of builders to their descriptions
 */
Graph.prototype.findBuilders = function (searchWords) {
  if (searchWords && !Array.isArray(searchWords)) searchWords = Array.prototype.slice.call(arguments, 0)
  searchWords = searchWords || []
  var descriptions = {}

  for (var key in this._builders) {
    var description = this._builders[key].getDescription()
    var searchTerms = (key + ' ' + (description || '')).toLowerCase()
    var found = true

    // match the node name against all search words
    for (var i = 0; i < searchWords.length && found; i++) {
      if (searchTerms.indexOf(searchWords[i].toLowerCase()) === -1) found = false
    }

    if (found) descriptions[key] = description
  }

  return descriptions
}

/**
 * Create a function to wrap a value which can be used as a node within the graph
 *
 * @param {Object} val
 * @return {function(Object)} a function which returns val or a promise that
 *     returns val
 */
Graph.prototype.literal = function (val) {
  val = val && val._literal ? val._literal : val
  var fn = literal.bind(null, val)
  fn._literal = val
  return fn
}

/**
 * Create a function which takes in a val and matches it against a regular expression.
 * If the regular expression doesn't match, throw an Error with the corresponding
 * msg field
 *
 * @param {RegExp} regex a regular expression to match values against
 * @param {string} msg the error message to return if the value doesn't match the regex
 * @return {function(string)} function which validates an input string against the regex
 */
Graph.prototype.validator = function (regex, msg) {
  return function (val) {
    if (typeof val !== 'string' || !val.match(regex)) throw new Error(msg)
    return val
  }
}

/**
 * Creates a function which returns its last non-callback input argument
 *
 * @param {Object} takes a variable number of arguments
 * @return {Object} returns data
 */
Graph.prototype.subgraph = function (var_args) {
  var data = typeof arguments[arguments.length - 1] == 'function' ? arguments[arguments.length - 2] : arguments[arguments.length - 1]
  return typeof data !== 'undefined' ? data : Q.resolve(undefined)
}

/**
 * Return an array of the input arguments to a node
 *
 * @param {Object} var_args
 * @return {Array.<Object>} the input args
 */
Graph.prototype.argsToArray = function (var_args) {
  var numToIgnore = typeof arguments[arguments.length - 1] == 'function' ? 1 : 0
  return Array.prototype.slice.call(arguments, 0, arguments.length - numToIgnore)
}

/**
 * Creates a function which deletes a specific member of an object
 *
 * @param {string} field the name of the field to delete
 * @return {function(obj)} returns a function which will delete the corresponding
 *     field from the object and return the object afterwards
 */
Graph.prototype.deleter = function (field) {
  return function (obj) {
    if (obj[field]) delete obj[field]
    return obj
  }
}

/**
 * Creates a function which will set a specific field of an object
 *
 * @param {string} field the name of the field to set
 * @return {function(obj, obj)} returns a function which will set the corresponding
 *     field on the object and return the object afterwards
 */
Graph.prototype.setter = function (field) {
  return function (obj, val) {
    if (typeof val !== 'undefined') obj[field] = val
    return obj
  }
}

/**
 * Disable node-style callbacks for this graph
 *
 * @return {Graph} the current graph instance
 */
Graph.prototype.disableCallbacks = function () {
  return this.setConfig('useCallbacks', false)
}

/**
 * Require all names to have two parts delimited by a hyphen
 *
 * @param {string} level 'warn' or 'throw'
 * @return {Graph} the current graph instance
 */
Graph.prototype.enforceTwoPartNames = function (level) {
  return this.setConfig('enforceTwoPartNames', level || 'throw')
}

/**
 * Specify that this graph should be automatically cloned before any
 * mutating changes take place
 *
 * @return {Graph} this
 */
Graph.prototype.forceClone = function () {
 return this.setConfig('forceClone', true)
}

/**
 * Enable profiling for this graph
 *
 * @return {Graph} this
 */
Graph.prototype.enableProfiling = function () {
  return this.setConfig('enableProfiling', true)
}

/**
 * Set the value for a specific config key
 *
 * @param {string} key
 * @param {Object} val
 * @return {Graph} the current graph instance
 */
Graph.prototype.setConfig = function (key, val) {
  if (this._config.forceClone) return this.clone().setConfig(key, val)
  this._config[key] = val
  return this
}

/**
 * Set the value for a specific state key
 *
 * @param {string} key
 * @param {Object} val
 * @return {Graph} the current graph instance
 */
Graph.prototype._setState = function (key, val) {
  if (this._config.forceClone) return this.clone()._setState(key, val)
  this._state[key] = val
  return this
}

Graph.prototype.addBuilderHandler = function (builder, fn) {
  var name = 'builderOutput-' + builder.getName().replace(/[^\w\d\-]+/g, '') + '-' + (++this._state.anonymousFnCounter)
  var node = this.add(name, fn, [], builder)
  node.setScope("BUILDER_OUTPUT")
  return name
}

/**
 * Adds an anonymous node to the graph and uses a name hint to create an identifiable name
 *
 * @param {string} nameHint a hint as to the purpose of this node (used internally)
 * @param {function} fn handler function to be added to the graph which processes nodes
 *     corresponding to args
 * @param {Array.<string>} optional array of node names which should be passed as arguments
 *     to the handler function
 * @return {string} the name of the node that was added
 */
Graph.prototype.addAnonymous = function (nameHint, fn, args) {
  if (this._config.forceClone) return this.clone().addAnonymous(nameHint, fn, args)

  var name = nameHint.replace(/[^\w\d\-]+/g, '') + '-anonFn' + (++this._state.anonymousFnCounter)
  this.add(name, fn, args)
  return name
}

/**
 * Warn, throw, or no-op when a new node is added if it doesn't
 * adhere to the naming scheme
 *
 * @param {string} msg error/warning message
 */
Graph.prototype._notifyInvalidName = function (msg) {
  if (this._config.enforceTwoPartNames == 'warn') {
    console.warn(msg)
  } else if (this._config.enforceTwoPartNames == 'throw') {
    throw new Error(msg)
  }
}

/**
 * Adds a node to the graph with a given name
 *
 * @param {string} the name of the node to add
 * @param {function} fn handler function to be added to the graph which processes nodes
 *     corresponding to args
 * @param {Array.<string>} optional array of node names which should be passed as arguments
 *     to the handler function
 * @return {NodeDefinition} the node that was added
 */
Graph.prototype.add = function (name, fn, deps, builder) {
  if (this._config.forceClone) return this.clone().add(name, fn, deps)

  // any field prefixed with '+' can bypass the unique name requirement
  var isOverride = name.indexOf('+') === 0
  if (isOverride) name = name.substr(1)

  // validate the name
  if (this._config.enforceTwoPartNames) {
    var idx = name.indexOf('-')
    var idx2 = name.indexOf('-', idx + 1)

    if (idx === -1) {
      this._notifyInvalidName("Node '" + name + "' must be hyphen-delimited")
    } else if (idx === 0) {
      this._notifyInvalidName("Node '" + name + "' must not start with -")
    } else if (idx === name.length - 1) {
      this._notifyInvalidName("Node '" + name + "' must not end with -")
    } else if (idx2 !== -1) {
      this._notifyInvalidName("Node '" + name + "' may only have a single -")
    }
  }

  var node
  if (typeof fn === 'string') {
    node = this._nodeDefinitions[name] = this._nodeDefinitions[fn].clone(this)
  } else {
    if (this._nodeDefinitions[name] && !isOverride) throw new Error('This node already exists')
    if (builder) {
      node = this._nodeDefinitions[name] = new NodeInstance(builder, this, name)
    } else {
      node = this._nodeDefinitions[name] = new NodeDefinition(this, name)
    }
    if (fn) node.fn(typeof fn !== 'function' ? this.literal(fn) : fn)
  }
  node.setScope(this._state.scope)

  if (deps) node.args.apply(node, deps)
  return node
}

/**
 * Retrieve the handler function for a node
 *
 * @param {string} name
 * @return {function}
 */
Graph.prototype.getFunction = function (name) {
  return this.getNode(name).getFunction()
}

/**
 * Retrieve the definition for a graph node
 *
 * @param {string} name
 * @return {function}
 */
Graph.prototype.getNode = function (name) {
  var node = this._nodeDefinitions[name]
  if (!node) throw new Error("The requested node (" + name + ") does not exist")
  return node
}

/**
 * Specify that a node in the graph should have a new node provided to it in place of an
 * existing arg
 *
 * @param {string} nodeName the node to provide the new arg to
 * @param {string} key the existing arg to override
 * @param {string} val the new arg to add
 */
Graph.prototype._provide = function (nodeName, key, val) {
  if (key === '!') {
    val = Array.isArray(val) ? val : [val]
    for (var i = 0; i < val.length; i += 1) {
      val[i] = '!' + val[i]
      this._provide(nodeName, val[i], val[i])
    }
    return
  }

  if (typeof val === 'function') {
    val = this.addAnonymous(key + '-providedFn', val)
  } else if (typeof val !== 'string') {
    val = this.addAnonymous(key + '-providedLiteral', this.literal(val))
  }
  this._nodeDefinitions[nodeName].overwriteArg(key, val)
}

/**
 * Create a copy of this graph
 *
 * @return {Graph} a copy of this graph
 */
Graph.prototype.clone = function () {
  var graph = new Graph()
  var key

  for (key in this._nodeDefinitions) {
    graph._nodeDefinitions[key] = this._nodeDefinitions[key].clone(graph)
  }

  for (key in this._config) {
    if (['readyHandlers', 'forceClone'].indexOf(key) === -1) {
      graph.setConfig(key, this._config[key])
    }
  }

  for (key in this._state) {
    if (['isReady'].indexOf(key) === -1) {
      graph._setState(key, this._state[key])
    }
  }

  graph._config.readyHandlers = []
  graph._state.isReady = false
  this._clones.push(graph)

  return graph
}

/**
 * Return a new Builder which uses this graph
 *
 * @param {string} name optional name for the Builder
 * @return {Builder} a new builder
 */
Graph.prototype.newBuilder = function (name) {
  if (this._config.forceClone) return this.clone().newBuilder(name)

  name = name || 'anonymousBuilder.' + (++this._state.anonymousBuilderCounter)

  if (this._builders[name]) throw new Error('A graph with this name already exists')

  return this._builders[name] = new Builder(this, name, {
    useCallbacks: this._config.useCallbacks,
    enableProfiling: this._config.enableProfiling
  })
}

module.exports = Graph

/**
 * Function which returns the value provided to it *or* a promise
 * resolving to undefined if no value was provided
 *
 * @param {Object} data
 * @return {Object|Promise.<undefined>}
 */
function literal(data) {
  return typeof data !== 'undefined' ? data : Q.resolve(undefined)
}