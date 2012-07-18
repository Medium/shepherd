var clone = require('./clone')
var microtime = require('microtime')
var Q = require('q')

/**
 * Create a new instance of BuilderInstance
 *
 * @constructor {BuilderInstance}
 * @param {Object} nodes a map of node names to handlers and dependencies
 * @param {Array.<String>} outputs a list of fields that are required to return
 */
function BuilderInstance(nodes, outputs) {
  this._nodes = nodes
  this._outputs = outputs
  this._config = {
    validateDependencies: true,
    trace: false
  }
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
  return this
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
      if (!this._nodes[depRoot] && inputs.indexOf(depRoot) === -1) {
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

/**
 * Trace out a debug msg to the logs
 */
BuilderInstance.prototype._trace = function (data, msg) {
  if (!data.traceId) {
    data.startTime = microtime.now()
    data.traceId = Date.now() + '.' + Math.floor(Math.random() * 10000)
  }
  msg.traceId = data.traceId
  msg.timestamp = microtime.now() - data.startTime
  process.nextTick(function () {
    console.log(JSON.stringify(msg))
  })
}

/**
 * Resolve a specific dependency for the current builder instance
 */
BuilderInstance.prototype._resolve = function (data, nodeName) {
  if (nodeName.indexOf('.') !== -1) {
    // using dot notation, set up a promise chain which will resolve the
    // root dependency through _resolve and then pull off any child fields
    // needed
    var parts = nodeName.split('.')
    var promise = null
    parts.forEach(function (part) {
      if (!promise) promise = this._resolve(data, part)
      else {
        promise = promise.then(function (data) {
          if (!data || !data[part]) return undefined
          return data[part]
        })
      }
    }.bind(this))
    return promise
  }

  // the field already exists in data, return it
  if (data[nodeName]) {
    if (this._config.trace) {
      this._trace(data, {node: nodeName, action: 'loadedFromCache'})
    }
    return Q.resolve(data[nodeName])
  }

  // check if there's a handler for the node and throw an error if not
  var node = this._nodes[nodeName]
  if (!node) return Q.reject(new Error('No node found for \'' + nodeName + '\''))

  // start tracing
  var traceInterval
  var traceIterations = 0
  if (this._config.trace && node.deps.length) {
    this._trace(data, {node: nodeName, action: 'waitingForDeps', deps: node.deps})
  }

  // guarantee that all dependencies are resolved for this node
  var promise = Q.allResolved(node.deps.map(function (dep) {
    return this._resolve(data, dep)
  }.bind(this)))
  .then(function (deps) {
    if (this._config.trace && node.deps.length) {
      this._trace(data, {node: nodeName, action: 'depsLoaded'})
    }

    // all dependencies have been resolved, retrieve their values
    for (var i = 0; i < deps.length; i += 1) {
      deps[i] = deps[i].valueOf()
      if (deps[i] && deps[i].exception) {
        this._trace(data, {node: nodeName, action: "failedDueToDependency", dependency: node.deps[i]})
        throw deps[i].exception
      }
    }

    // add a node-style callback to a new promise as the last argument to the handler
    var deferred = Q.defer()
    var deferredPromise = deferred.promise
    deps.push(deferred.makeNodeResolver())

    // call the handler
    if (this._config.trace) {
      traceInterval = setInterval(function () {
        traceIterations++
        if (traceInterval) clearInterval(traceInterval)
        this._trace(data, {node: nodeName, action: "waitingToResolve"})
      }.bind(this), 1000)
      this._trace(data, {node: nodeName, action: 'resolving'})
    }
    var fnResult = node.handler.apply(null, deps)

    // if the handler returned an undefined, expect that the node-style callback will
    // be called, otherwise use the returned value (which may be a promise or synchronous
    // response value)
    return typeof fnResult !== 'undefined' ? fnResult : deferredPromise
  }.bind(this))

  if (this._config.trace) {
    promise.then(function (result) {
      if (traceInterval) clearInterval(traceInterval)
      this._trace(data, {node: nodeName, action: 'resolved'})
    }.bind(this))
    promise.fail(function (err) {
      if (traceIterations++ >= 30 && traceInterval) clearInterval(traceInterval)
      this._trace(data, {node: nodeName, action: 'failed'})
    }.bind(this))
  }

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
BuilderInstance.prototype.build = function (inputData, callback) {
  if (this._config.validateDependencies) this.validateDependencies(Object.keys(inputData))

  // clone the input data to keep it pristine
  var data = {}
  for (var key in inputData) {
    data[key] = inputData[key]
  }
  var startTime

  // resolve all needed outputs
  if (this._config.trace) {
    startTime = microtime.now()
    this._trace(data, {action: 'starting build()', outputs: this._outputs})
  }
  var promise = Q.allResolved(this._outputs.map(function (output) {
    return this._resolve(data, output)
  }.bind(this)))
  .then(function (promises) {
    if (this._config.trace) {
      this._trace(data, {action: 'finished build()', outputs: this._outputs})
    }

    // convert our promises to a map *or* throw an error if we have one
    var response = {}
    for (var i = 0; i < promises.length; i += 1) {
      if (!promises[i].isFulfilled()) throw promises[i].valueOf().exception
      response[this._outputs[i]] = promises[i].valueOf()
    }
    return response
  }.bind(this))

  // if a callback was provided, call it through the promise
  if (callback) {
    promise.then(function (data) {
      callback(null, data)
    })
    .fail(function (err) {
      callback(err, null)
    })
  }

  return promise
}

module.exports = BuilderInstance
