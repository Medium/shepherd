var clone = require('./clone')

var BuilderInstance = require('./BuilderInstance')

/**
 * Create a new instance of BuilderFactory
 *
 * @constructor {BuilderFactory}
 * @param {Object} nodes optional nodes when cloning a factory instance
 * @param {Number} literalCounter optional counter to start literals at to provide
 *     name collisions when creating literals
 */
function BuilderFactory(nodes, literalCount) {
  this._nodes = nodes || {}
  this._literalCount = literalCount || 0
  this._config = {
    forceClone: false,
    inputs: null
  }
}

/**
 * Configuration function which takes in a map of configuration options to set.
 * Currently supports:
 *   forceClone: boolean for whether to clone this factory on next change operation
 *   inputs: an optional array of explicit inputs which can be used to perform builder
 *       creation time analysis of dependencies
 *
 * @param {Object} opts options to set
 * @return {BuilderFactory} the current factory
 */
BuilderFactory.prototype.configure = function (opts) {
  for (var key in opts) {
    this._config[key] = opts[key]
  }
  return this
}

/**
 * Clone an existing instance of BuilderFactory
 *
 * @return {BuilderFactory}
 */
BuilderFactory.prototype.clone = function () {
  return new BuilderFactory(clone(this._nodes), this._literalCount)
    .configure(this._config)
    .configure({forceClone: false})
}

/**
 * Wrap a literal for use as a dependency
 *
 * @param {Object} val the literal to wrap
 * @return {Function} the literal wrapped in a function
 */
BuilderFactory.prototype.literal = function (val) {
  return function () {
    return val
  }
}

/**
 * Provide a set of dependencies via remapping for a given handler
 *
 * @this {BuilderFactory}
 * @params {string} name the name of the field to remap dependencies for
 * @param {Object|Array.<string>} deps a string to value map of remapped dependencies
 *     or a whole new list of dependencies for this handler
 */
BuilderFactory.prototype.provideTo = function (node, deps) {
  if (this._config.forceClone) return this.clone().provideTo(node, deps)

  if (!this._nodes[node]) throw new Error('node \'' + node + '\' not found')
  
  // if provided with an array of deps, just override the existing deps
  if (Array.isArray(deps)) this._nodes[node].deps = deps
  else if (typeof deps === 'object') {
    // if provided with an object, remap
    for (var i = 0; i < this._nodes[node].deps.length; i += 1) {
      var field = this._nodes[node].deps[i]
      var newDep = deps[field]
      if (newDep) {
        // if the new dependency is a function, map it as a literal
        if (Array.isArray(newDep) || typeof newDep === 'function') {
          var newName = '_autoAdd_literal_' + (++this._literalCount)
          this.add(newName, newDep)
          newDep = newName
        }

        // remap the dependency
        if (typeof newDep === 'string') {
          this._nodes[node].deps[i] = newDep
        } else {
          throw new Error("Unknown dependency provided in provideTo for \'' + node + '\' field \'' + field + '\'")
        }
      }
    }
  } else {
    // invalid dependencies for provideTo
    throw new Error('Invalid deps provided in provideTo for \'' + node + '\'')
  }

  return this
}

/**
 * Add a handler
 *
 * @this {BuilderFactory}
 * @param {String} nodeName name of the field to handle
 * @param {Function} handler the function to call for this field
 * @param {Array.<String>} deps fields this field is dependent on
 * @return {BuilderFactory}
 */
BuilderFactory.prototype.add = function (nodeName, handler, deps) {
  if (this._config.forceClone) return this.clone().add(nodeName, handler, deps)

  // node object for referencing this handler
  var node = {}

  // handler may be an array of function and bind arguments
  if (Array.isArray(handler)) {
    if (handler.length === 1) handler = handler[0]
    else handler = handler[0].bind.apply(handler[0], handler.slice(1)) 
  }

  // handler is a string, alias instead
  if (typeof handler === 'string') {
    return this.add(nodeName, alias, [handler])
  }

  // check the handler
  if (typeof handler !== 'function') throw new Error('handler for \'' + nodeName + '\' is not a function: ' + JSON.stringify(handler))
  
  // if no dependencies, set as empty array
  if (!deps) deps = []
  // if dependencies aren't an array, coerce all args after handler into an array
  else if (!Array.isArray(deps)) deps = Array.prototype.slice.call(arguments, 2)

  // set up the node
  this._nodes[nodeName] = {handler: handler, deps: deps}

  return this
}

/**
 * Create a new builder with an optimized execution path based on a
 * set of required output fields
 *
 * @this {BuilderFactory}
 * @param {Array.<String>} requiredFields
 * @return {BuilderInstance}
 */
BuilderFactory.prototype.newBuilder = function (outputs) {
  if (!Array.isArray(outputs)) outputs = Array.prototype.slice.call(arguments, 0)
  var builder =  new BuilderInstance(clone(this._nodes), outputs)

  if (this._config.inputs) builder.validateDependencies(this._config.inputs)

  return builder
}

/**
 * Create a set of builders with optimized execution paths
 *
 * @this {BuilderFactory}
 * @param {Array.<Object>} requiredFieldsMap map of builder names to required fields
 * @return {Object} an object with a set of builders in it
 */
BuilderFactory.prototype.newBuilders = function (requiredFieldsMap) {
  var response = null
    , key
    , builder

  for (key in requiredFieldsMap) {
    builder = this.newBuilder(requiredFieldsMap[key])
    if (response === null) response = builder
    response[key] = builder
  }

  return response
}

/**
 * Alias an existing node
 */
function alias(node) {
  return node
}

module.exports = BuilderFactory
