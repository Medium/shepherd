var clone = require('./clone')
var Q = require('q')
var microtime = require('microtime')

var NODE_NAME_REQUIRED_FIELDS = '_requiredFields'

/**
 * Create a new instance of BuilderInstance
 *
 * @constructor {BuilderInstance}
 * @param {Object} nodes a map of node names to handlers and dependencies
 * @param {Array.<String>} outputs a list of fields that are required to return
 */
function BuilderInstance(nodes, outputs, eventHandlers) {
  this._nodes = nodes
  this._outputs = outputs
  this._config = {}
  this.configure({
      validateDependencies: true
    , handlers: eventHandlers
  })
  this._depMap = this.getRequiredFields()
}

/**
 * Configuration function which takes in a map of configuration options to set.
 * Currently supports:
 *   validateDependencies: whether to validate every build() call for missed dependencies
 *   trace: enable to trace the flow of a request through the graph
 *
 * @param {Object} opts options to set
 * @return {BuilderFactory} the current factory
 */
BuilderInstance.prototype.configure = function (opts) {
  for (var key in opts) {
    this._config[key] = opts[key]
  }

  if (!this._config.handlers.warn) this._config.handlers.warn = this._config.handlers.debug
  if (!this._config.handlers.error) this._config.handlers.error = this._config.handlers.warn

  return this
}

/**
 * Create a map of what child fields are required for resolving each graph node
 *
 * @return {Object} map of field names to an array of member variables that are required. If
 *     all members are required the value will be '*' instead of an array
 */
BuilderInstance.prototype.getRequiredFields = function () {
  var fields = [].concat(this._outputs)
  var requiredFields = {}
  var processed = {}

  while(fields.length) {
    var field = fields.shift()
    var fieldParts = field.split('.')

    if (!requiredFields[fieldParts[0]]) requiredFields[fieldParts[0]] = []
    if (fieldParts.length === 1) {
      requiredFields[fieldParts[0]] = '*'
    } else if (fieldParts.length > 1 && Array.isArray(requiredFields[fieldParts[0]])) {
      requiredFields[fieldParts[0]].push(fieldParts[1])
    }

    if (!processed[fieldParts[0]]) {
      processed[fieldParts[0]] = true
      var node = this._nodes[fieldParts[0]]
      if (node) {
        var deps = node.deps
        for (var i = 0; i < deps.length; i += 1) {
          fields.push(deps[i])
        }
      }
    }
  }

  return requiredFields
}

/**
 * Get a list of all dependencies for this builder instance
 *
 * @return {Object} a map of node names to an array of their dependencies
 */
BuilderInstance.prototype.getDependencies = function () {
  var fields = [].concat(this._outputs)
  var deps = {}

  while(fields.length) {
    var field = fields.shift()
    var node = this._nodes[field]
    if (!deps[field] && node) {
      deps[field] = [].concat(node.deps)
      deps[field].forEach(function (field) {
        fields.push(field.split('.')[0])
      })
    }
  }

  return deps
}

/**
 * Validate that all dependencies exist for this builder's output given
 * a specified set of explicit inputs
 */
BuilderInstance.prototype.validateDependencies = function (inputs) {
  var deps = this.getDependencies()
  var missingFields

  for(var key in deps) {
    var innerDeps = deps[key]
    innerDeps.forEach(function (dep) {
      var depRoot = dep.split('.')[0]
      if (!this._nodes[depRoot] && inputs.indexOf(depRoot) === -1 && depRoot !== NODE_NAME_REQUIRED_FIELDS) {
        if (!missingFields) missingFields = {}
        if (!missingFields[key]) missingFields[key] = []
        missingFields[key].push(depRoot)
      }
    }.bind(this))
  }

  if (missingFields) {
   var msgs = []
    for (var key in missingFields) {
      msgs.push(key + " requires [" + missingFields[key].join(', ') + "]")
    }
    throw new Error(msgs.join("; "))
  }
}

BuilderInstance.prototype._trace = function (handlerType, msg) {
  var handler = this._config.handlers[handlerType]
  if (handler) process.nextTick(handler.bind(null, msg))
}

/**
 * Resolve a specific dependency for the current builder instance
 */
BuilderInstance.prototype._resolve = function (data, nodeName) {
  var isInternalNode = nodeName.substr(0, 1) !== -1

  if (nodeName.indexOf('.') !== -1) {
    // using dot notation, set up a promise chain which will resolve the
    // root dependency through _resolve and then pull off any child fields
    // needed
    var parts = nodeName.split('.')
    return data._resolve(data, parts[0])
      .then(function (result) {
        for (var i = 1; i < parts.length; i += 1) {
          if (!result) return result
          result = result[parts[i]]
        }
        return result
      })
  }

  // the field already exists in data, return it
  if (data[nodeName]) {
    data._trace('debug', {traceId: data._traceId, node: nodeName, action: 'loadedFromCache'})
    return Q.resolve(data[nodeName])
  }

  // check if there's a handler for the node and throw an error if not
  var node = this._nodes[nodeName]
  if (!node) return Q.reject(new Error('No node found for \'' + nodeName + '\''))

  // start tracing
  var traceInterval
  var traceIterations = 0
  var startTime

  // guarantee that all dependencies are resolved for this node
  var promise
  if (node.deps.length) {
    data._trace('debug', {traceId: data._traceId, node: nodeName, action: 'waitingForDeps', deps: node.deps})
    var resolvers = []
    for (var i = 0; i < node.deps.length; i += 1) {
      if (node.deps[i] === NODE_NAME_REQUIRED_FIELDS) {
        // return a list of required fields for this node
        resolvers.push(Q.resolve(this._depMap[nodeName]))
      } else {
        // resolve a node
        resolvers.push(data._resolve(data, node.deps[i]))
      }
    }
    promise = Q.all(resolvers)
  } else {
    promise = Q.resolve([])
  }
  promise = promise
  .then(function (deps) {
    if (node.deps.length) data._trace('debug', {traceId: data._traceId, node: nodeName, action: 'depsLoaded'})

    // add a node-style callback to a new promise as the last argument to the handler
    var deferred = Q.defer()
    var deferredPromise = deferred.promise
    deps.push(deferred.makeNodeResolver())

    // only set up the timer to watch for slow requests if we have a warn handler
    if (data._config.handlers.warn) {
      traceInterval = setInterval(function () {
        if (++traceIterations >= 30 && traceInterval) clearInterval(traceInterval)
        data._trace('warn', {traceId: data._traceId, node: nodeName, action: "waitingToResolve"})
      }, 1000)
      data._trace('debug', {traceId: data._traceId, node: nodeName, action: 'resolving'})
    }
    if (data._config.handlers.timing && !isInternalNode) startTime = microtime.now()
    var fnResult = node.handler.apply(null, deps)

    // if the handler returned an undefined, expect that the node-style callback will
    // be called, otherwise use the returned value (which may be a promise or synchronous
    // response value)
    return typeof fnResult !== 'undefined' ? fnResult : deferredPromise
  })

  // shut off the warn interval if there is one
  if (data._config.handlers.warn) {
    promise
      .then(function () {
        if (traceInterval) process.nextTick(clearInterval.bind(null, traceInterval))
      })
  }

  // handle logging of timings and increments
  promise
    .then(nodeCallbackSuccess)
    .fail(nodeCallbackError)
    .then(isInternalNode ? undefined : onNodeComplete.bind(data, nodeName, startTime, traceInterval))

  return data[nodeName] = promise
}

/**
 * Build a response object for this Builder instance
 *
 * @this {BuilderInstance}
 * @param {Object} data input data
 * @param {Function} callback optional callback
 * @return {Promise} returns a promise if no callback provided
 */
BuilderInstance.prototype.build = function (inputData, callback, callbackScope) {
  if (this._config.validateDependencies) this.validateDependencies(Object.keys(inputData))

  // clone the input data to keep it pristine
  var data = {
    _config: this._config,
    _trace: this._trace.bind(this),
    _resolve: this._resolve.bind(this),
    _traceId: inputData._traceId || Date.now() + '.' + Math.floor(Math.random() * 10000)
  }
  for (var key in inputData) data[key] = inputData[key]
  var startTime
  var outputs = this._outputs

  // resolve all needed outputs
  if (data._config.handlers.timing && outputs.length) startTime = microtime.now()
  data._trace('debug', {traceId: data._traceId, action: 'starting build()', outputs: outputs})

  var promise
  if (outputs.length) {
    var resolvers = []
    for (var i = 0; i < outputs.length; i += 1) {
      resolvers.push(data._resolve(data, outputs[i]))
    }
    promise = Q.all(resolvers)
  } else {
    promise = Q.resolve([])
  }

  var promise = promise
  .then(function (results) {
    data._trace('debug', {traceId: data._traceId, action: 'finished build()', outputs: outputs})
    if (data._config.handlers.timing && outputs.length) data._config.handlers.timing('build.' + outputs ? outputs.join(',') : 'EMPTY', microtime.now() - startTime)

    // convert our promises to a map *or* throw an error if we have one
    var response = {}
    for (var i = 0; i < results.length; i += 1) {
      response[outputs[i]] = results[i]
    }
    return response
  })

  // if a callback was provided, call it through the promise
  if (callback) {
    promise
      .then(nodeCallbackSuccess)
      .fail(nodeCallbackError)
      .then(callback.apply.bind(callback, callbackScope))
  }

  return promise
}

module.exports = BuilderInstance


/**
 * Handle completion of a node by calling the timing and increment functions if the handlers are set
 *
 * @param {Object} data
 * @param {string} nodeName
 * @param {Number} startTime
 * @param {Array.<Error, Object>} node callback style results
 */
function onNodeComplete(data, nodeName, startTime, results) {
  var failed = !!results[0]

  if (data._config.handlers.increment) data._config.handlers.increment('node.' + nodeName + '.' + (failed ? 'failed' : 'success'))
  if (data._config.handlers.timing) data._config.handlers.timing('node.' + nodeName, microtime.now() - startTime)
}

/**
 * Pass along a promise result object as the first arg in a node callback-style array
 *
 * @param {Object} data
 * @return {Array.<Error, Object>}
 */
function nodeCallbackSuccess(data) {
  return [undefined, data]
}

/**
 * Pass along a promise failure object as the first arg in a node callback-style array
 *
 * @param {Object} result
 * @return {Array.<Error, Object>}
 */
function nodeCallbackError(err) {
  return [err]
}
