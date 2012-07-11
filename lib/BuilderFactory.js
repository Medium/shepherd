var q = require('q')
var clone = require('./clone')
var BuilderInstance = require('./BuilderInstance')

/**
 * Create a new instance of BuilderFactory
 *
 * @constructor {BuilderFactory}
 * @param {Object} handlers optional handlers when cloning a factory instance
 */
function BuilderFactory(handlers) {
  this.wrapsInputs = false
  this.usesPromises = false
  this.hasStrictAdds = false
  this.cloneOnly = false
  this._inputs = []
  this._outputs = []
  this.handlers = typeof handlers !== 'undefined' ? clone(handlers) : {}
}

BuilderFactory.prototype.newGraph = function () {
  var factory = this.clone()
  factory._inputs = Array.prototype.slice.call(arguments, 0)
  return factory
}

BuilderFactory.prototype.given = function () {
  this._outputs = Array.prototype.slice.call(arguments, 0)
  return this
}

BuilderFactory.prototype.then = function (fn) {
  var inputs = this._inputs
  var outputs = this._outputs
  var builder = this.newBuilder(this._outputs)
  var wrapsInputs = this.wrapsInputs
  var usesPromises = this.usesPromises

  return function () {
    var builderData = {}

    // build the map of inputs to this builder
    for (var i in inputs) {
      builderData[inputs[i]] = wrapsInputs ? arguments[i].get() : arguments[i]
    }

    if (usesPromises) {
      var d = q.defer()
      builder.build(builderData, function (err, data) {
        if (err) return d.reject(err)
        var args = []
        for (var key in outputs) {
          args.push(data[outputs[key]])
        }
        d.resolve(fn.apply(null, args))
      })
      return d.promise
    } else {
      var callback = arguments[arguments.length - 1]
      builder.build(builderData, function (err, data) {
        if (err) return callback(err)
        var args = []
        for (var key in outputs) {
          args.push(data[outputs[key]])
        }
        return callback(err, fn.apply(null, args))
      })
    }
  }
  return this
}

/**
 * Toggle flag for this builder factory which will wrap inputs into each function
 * for error propogation and the like instead of calling out to global error handler
 */
BuilderFactory.prototype.wrapInputs = function () {
  this.wrapsInputs = true
  return this
}

/**
 * Toggle flag for this builder factory which will require that builder functions 
 * return promises instead of calling a callback
 */
BuilderFactory.prototype.usePromises = function () {
  this.usesPromises = true
  return this
}

/**
 * Toggle flag for this builder factory which will guarantee function argument counts
 * match up with dependencies where possible (doesn't work with wrapped functions)
 */
BuilderFactory.prototype.strictAdds = function () {
  this.hasStrictAdds = true
  return this
}

/**
 * Toggle flag for this builder factory which will guarantee function arguments exist
 * as a dependency or explicitly provided by builder
 */
BuilderFactory.prototype.strictBuilds = function (fields) {
  this.strictBuildFields = fields
  return this
}

/**
 * Whenever performing a change operation on this factory, create a new one and
 * use it instead
 */
BuilderFactory.prototype.forceClone = function () {
  this.cloneOnly = true
  return this
}

/**
 * Clone an existing instance of BuilderFactory
 *
 * @return {BuilderFactory}
 */
BuilderFactory.prototype.clone = function () {
  var cloned = new BuilderFactory(this.handlers)
  if (this.hasStrictAdds) cloned.strictAdds()
  if (this.strictBuildFields) cloned.strictBuilds(this.strictBuildFields)
  if (this.usesPromises) cloned.usePromises()
  if (this.wrapsInputs) cloned.wrapInputs()
  return cloned
}

/**
 * Provide a set of dependencies via remapping for a given handler
 *
 * @this {BuilderFactory}
 * @params {string} name the name of the field to remap dependencies for
 * @param {Object|Array.<string>} deps a string to value map of remapped dependencies
 *     or a whole new list of dependencies for this handler
 */
BuilderFactory.prototype.provideTo = function (name, deps) {
  if (!this.handlers[name]) throw new Error("handler '" + name + "' has not been defined")

  // if the deps are just an array, map over the existing function
  if (Array.isArray(deps)) {
    return this.add(name, this.handlers[name].fn, deps)

  // not just an array, loop through the existing dep list and remap based on the
  // key-value pairs provided
  } else {
    for (var i = 0; i < this.handlers[name].deps.length; i += 1) {
      if (deps[this.handlers[name].deps[i]]) {
        this.handlers[name].deps[i] = deps[this.handlers[name].deps[i]]
      }
    }
  }

  return this
}

/**
 * Add a handler
 *
 * @this {BuilderFactory}
 * @param {String} name name of the field to handle
 * @param {Function} fn the function to call for this field
 * @param {Array.<String>} deps fields this field is dependent on
 * @return {BuilderFactory}
 */
BuilderFactory.prototype.add = function (name, fn, deps) {
  if (this.cloneOnly) return this.clone().add(name, fn, deps)

  deps = deps || []

  // alias one method to another method
  if(typeof fn === 'string') {
    if (fn.indexOf('.') !== -1) {
      var wrapsInputs = this.wrapsInputs
      var usesPromises = this.usesPromises
      if (usesPromises) {
        return this.add(name, function (input) {
          return wrapsInputs ? input.get() : input
        }, [fn])
      } else {
        return this.add(name, function (input, next) {
          return next(null, wrapsInputs ? input.get() : input)
        }, [fn])
      }
    } else {
      this.handlers[name] = clone(this.handlers[fn])
    }

  // add a new method to the builder
  } else if(typeof fn === 'function'){
    if (this.hasStrictAdds) {
      var args = fn.toString().match(/^function [^\(]*\(([^\)]*)\)/)[1].split(', ')
      if (args.length !== 0 && args[0] !== '' && (args.length - 1) !== deps.length) {
        throw new Error(name + " has " + (args.length - 1) + " args and received " + deps.length)
      }
    }
    this.handlers[name] = {fn:fn, deps:deps}

  // not a function
  } else {
    throw new Error("Invalid function for handler '" + name + "'")
  }

  return this
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
 * Create a new builder with an optimized execution path based on a
 * set of required output fields
 *
 * @this {BuilderFactory}
 * @param {Array.<String>} requiredFields
 * @return {BuilderInstance}
 */
BuilderFactory.prototype.newBuilder = function (requiredFields) {
  if (!Array.isArray(requiredFields)) requiredFields = Array.prototype.slice.call(arguments, 0)
  var paths = {}
    , fields = [].concat(requiredFields)
    , field
    , baseField
    , input
    , deps
    , i
    , iEnd
    , depField
    , noDeps = []
  while (fields.length) {
    field = fields.shift()
    input = this.handlers[field] || {deps:[]}

    if(input.deps.length === 0) noDeps.push(field)
    for(i=0,iEnd=input.deps.length; i<iEnd; i+=1) {
      depField = input.deps[i].indexOf('.') !== -1 ? input.deps[i].substr(0,input.deps[i].indexOf('.')) : input.deps[i]
      if(!paths[depField]) {
        paths[depField] = {}
        fields.push(depField)
      }
      paths[depField][field] = input
    }
  }

  if (this.strictBuildFields) {
    for(var i in noDeps) {
      var found = this.handlers[noDeps[i]]
      for(var j=0; j<this.strictBuildFields.length && !found; j+=1) {
        if (noDeps[i] === this.strictBuildFields[j]) found = true
      }
      if (!found) throw new Error(noDeps[i] + " was not found in builder and was not provided in .strictBuilds()")
    }
  }

  return new BuilderInstance({wrapInputs: this.wrapsInputs, usePromises: this.usesPromises}, this.handlers, paths, noDeps, requiredFields)
}

module.exports = BuilderFactory
