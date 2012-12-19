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
var Q = require('kew')

/**
 * Create a graph of NodeDefinitions which can be pieced together to
 * perform complicated operations optimally
 *
 * @constructor
 */
function Graph() {
  this._readyHandlers = []
  this._isReady = false
  this._builders = {}
  this._nodeDefinitions = {}
  this._anonymousBuilderCounter = 0
  this._anonymousFnCounter = 0
  this._forceClone = false
}

/**
 * Add a function to run when the Graph is ready
 * to be used and fully loaded
 *
 * @param {function()} fn function to run when the graph
 *     is loaded
 */
Graph.prototype.onReady = function (fn) {
  if (this._isReady) fn()
  else this._readyHandlers.push(fn)
}

/**
 * Mark the Graph as being ready to use and run
 * any ready handlers
 */
Graph.prototype.ready = function () {
  this._isReady = true
  while (this._readyHandlers.length) {
    var fn = this._readyHandlers.shift()
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
 * Specify that this graph should be automatically cloned before any
 * mutating changes take place
 *
 * @return {Graph} this
 */
Graph.prototype.forceClone = function () {
  this._forceClone = true
  return this
}

/**
 * Create a function to wrap a value which can be used as a node within the graph
 *
 * @param {Object} val
 * @return {function(Object)} a function which returns val or a promise that
 *     returns val
 */
Graph.prototype.literal = function (val) {
  return literal.bind(null, val && val._literal ? val._literal : val)
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
  var data = arguments[arguments.length - 2]
  return typeof data !== 'undefined' ? data : Q.resolve(undefined)
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
  if (this._forceClone) return this.clone().addAnonymous(nameHint, fn, args)

  var name = nameHint.replace(/[^\w\d\-]+/g, '') + '-anonFn' + (++this._anonymousFnCounter)
  this.add(name, fn, args)
  return name
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
Graph.prototype.add = function (name, fn, deps) {
  if (this._forceClone) return this.clone().add(name, fn, deps)

  // any field prefixed with '+' can bypass the unique name requirement
  var isOverride = name.indexOf('+') === 0
  if (isOverride) name = name.substr(1)

  var node
  if (typeof fn === 'string') {
    node = this._nodeDefinitions[name] = this._nodeDefinitions[fn].clone(this)
  } else {
    if (this._nodeDefinitions[name] && !isOverride) throw new Error('This node already exists')
    node = this._nodeDefinitions[name] = new NodeDefinition(this, name)
    if (fn) node.fn(typeof fn !== 'function' ? this.literal(fn) : fn)
  }

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
  var node = this._nodeDefinitions[name]
  if (!node) throw new Error("The requested node (" + name + ") does not exist")
  return node.getFunction()
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
 * Override multiple arguments to a node by calling _provide for each input
 *
 * @param {string} node Name the node to provide the new args to
 * @param {Object} provides a map of current arg names to new nodes to be provided
 */
Graph.prototype.provideTo = function (nodeName, provides) {
  if (this._forceClone) return this.clone().provideTo(nodeName, provides)

  for (var key in provides) {
    this._provide(nodeName, key, provides[key])
  }

  return this
}

/**
 * Create a copy of this graph
 *
 * @return {Graph} a copy of this graph
 */
Graph.prototype.clone = function () {
  var graph = new Graph()
  for (var key in this._nodeDefinitions) {
    graph._nodeDefinitions[key] = this._nodeDefinitions[key].clone(graph)
  }
  graph._readyHandlers = this._readyHandlers
  graph._anonymousFnCounter = this._anonymousFnCounter
  graph._anonymousBuilderCounter = this._anonymousBuilderCounter
  return graph
}

/**
 * Create a new Builder with a variable number of nodes to build. Each node
 * is passed 0 arguments and this method is meant to replicate existing
 * asyncBuilder functionality
 *
 * @param {string} var_args a variable number of node names to build
 * @return {Builder} a new builder
 */
Graph.prototype.newBuilder = function (var_args) {
  if (this._forceClone) {
    var cloned = this.clone()
    return cloned.newBuilder.apply(cloned, arguments)
  }

  var args = arguments.length && Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments, 0)
  var builder = this.newAsyncBuilder()
  for (var i = 0; i < args.length; i += 1) {
    builder.builds(args[i])
  }
  return builder
}

/**
 * Return a new Builder which uses this graph
 *
 * @param {string} name optional name for the Builder
 * @return {Builder} a new builder
 */
Graph.prototype.newAsyncBuilder = function (name) {
  if (this._forceClone) return this.clone().newAsyncBuilder(name)
  name = name || 'anonymousBuilder.' + (++this._anonymousBuilderCounter)
  if (this._builders[name]) throw new Error('A graph with this name already exists')
  return this._builders[name] = new Builder(this, name)
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