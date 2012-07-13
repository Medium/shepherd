var BuilderResponse = require("./BuilderResponse")
var q = require("q")

var STARTED_HANDLING = 1
  , FINISHED_HANDLING = 2

/**
 * Create a new instance of BuilderInstance
 *
 * @constructor {BuilderInstance}
 * @param {Object} handlers a map of handler names to functions and dependencies
 * @param {Object} paths a map of handler names to their dependents
 * @param {Array.<String>} noDeps a list of fields in the exec path without dependencies
 * @param {Array.<String>} fields a list of fields that are required to return
 */
function BuilderInstance(options, handlers, paths, noDeps, requiredFields) {
  this.options = options
  this.handlers = handlers
  this.paths = paths
  this.noDeps = noDeps
  this.numRequiredFields = requiredFields.length
  this.requiredFields = {}
  for(var i=0, iEnd=requiredFields.length; i<iEnd; i+=1) {
    this.requiredFields[requiredFields[i]] = true
  }
  this.traceNext = false
}

/**
 * Get a list of all dependencies for this builder instance
 */
BuilderInstance.prototype.getDependencies = function () {
  var deps = {}

  for (var i in this.handlers) {
    if (this.handlers[i].deps) {
      for (var j = 0; j < this.handlers[i].deps.length; j += 1) {
        deps[this.handlers[i].deps[j]] = 1
      }
    }
  }

  return Object.keys(deps)
}

/**
 * While tracing, write a msg out giving information
 */
BuilderInstance.prototype._traceMsg = function (field, msg, timing) {
  console.log("TRACE: " + (field !== null ? "'" + field + "' - " : "") + msg + (typeof timing !== 'undefined' ? " (" + timing + "ms)" : ""))
}

/**
 * Enable log tracing for the next request
 *
 * @this {BuilderInstance}
 * @return {BuilderInstance}
 */
BuilderInstance.prototype.trace = function () {
  this.traceNext = true
  return this
}

/**
 * Exit early with an error
 *
 * @this {BuilderInstance}
 * @param {Object} wrapper the build wrapper object
 * @param {Error} error
 */
BuilderInstance.prototype._error = function (wrapper, error) {
  if (wrapper.returned) return
  if (wrapper.tracing) this._traceMsg(null, "returning with error", (new Date()/1 - wrapper.traceStart))

  wrapper.returned = true
  wrapper.callback(error, null)
}

/**
 * Mark a field as having ran, check for completion, and run dependencies
 *
 * @this {BuilderInstance}
 * @param {Object} wrapper the build wrapper object
 * @param {String} key the name of the field that ran
 */
BuilderInstance.prototype._ran = function (wrapper, key) {
  if (wrapper.returned) return
  if (this.requiredFields[key] && typeof wrapper.requiredData[key] === 'undefined') {
    wrapper.requiredData[key] = wrapper.data[key]
    wrapper.pendingRequired--
    if(wrapper.pendingRequired <= 0) {
      wrapper.returned = true
      return wrapper.callback(null, wrapper.requiredData)
    }
  }

  var path = this.paths[key]
    , k
  for (k in path) {
    if (!wrapper.handled[k]) {
      this._run(wrapper, k, this.handlers[k].deps)
    }
  }
}

/**
 * Load local data or run a function asynchronously to load data for a field
 *
 * @this {BuilderInstance}
 * @param {Object} wrapper the build wrapper object
 * @param {String} key the field to run
 * @param {Array.<String>} a list of dependencies for the field
 */
BuilderInstance.prototype._run = function (wrapper, key, deps) {
  if (wrapper.returned || wrapper.handled[key]) return

  if (typeof wrapper.data[key] !== 'undefined') {
    wrapper.handled[key] = FINISHED_HANDLING
    return this._ran(wrapper, key)
  }

  var args = []
    , i = 0
    , field
    , iEnd = deps.length
    , isDot
  for(; i<iEnd; i+=1) {
    isDot = deps[i].indexOf('.') !== -1
    var field = isDot ? deps[i].substr(0,deps[i].indexOf('.')) : deps[i]
    if(wrapper.handled[field] !== FINISHED_HANDLING) return

    if (isDot) {
      var obj = wrapper.data[field]
        , fieldParts = deps[i].split(/\./)
        , j = 1

      // wrapping inputs, need to create a new BuilderResponse if there is no error
      if (this.options.wrapInputs) {
        if (!obj.hasError()) {
          var tempObj = obj.get()
          for( ; typeof tempObj !== 'undefined' && j < fieldParts.length ; j+=1) {
            tempObj = tempObj[fieldParts[j]]
          }
          obj = new BuilderResponse(tempObj)
        }
      } else {
        for( ; typeof obj !== 'undefined' && j < fieldParts.length ; j+=1) {
          obj = obj[fieldParts[j]]
        }
      }

      args.push(obj)

    } else args.push(wrapper.data[deps[i]])
  }
  wrapper.handled[key] = STARTED_HANDLING

  var self = this
    , handler = this.handlers[key]

  if (typeof handler === 'undefined') {
    throw new Error("No handler defined for '" + key + "'")
  }

  // add a callback if we're not using promises
  if (!this.options.usePromises) {
    args.push(function (err, data) {
      if (err) {
        if (!self.options.wrapInputs) return self._error(wrapper, err)
        wrapper.data[key] = new BuilderResponse(null, err)
        wrapper.handled[key] = FINISHED_HANDLING
        self._ran(wrapper, key)
        return
      }

      wrapper.data[key] = data
      wrapper.handled[key] = FINISHED_HANDLING
      self._ran(wrapper, key)
    })
  }

  if (typeof handler.fn !== 'function') {
    throw new Error("Invalid function for handler '" + key + "'")
  }

  try {
    var response = handler.fn.apply(null, args)
    if (this.options.usePromises) {
      q.when(response, function (response) {
        wrapper.data[key] = self.options.wrapInputs ? new BuilderResponse(response) : response
        wrapper.handled[key] = FINISHED_HANDLING
        self._ran(wrapper, key)
      }, function (e) {
        if (self.options.wrapInputs) {
          wrapper.data[key] = new BuilderResponse(null, e)
          wrapper.handled[key] = FINISHED_HANDLING
          self._ran(wrapper, key)
        } else {
          self._error(wrapper, e)
        }
      })
    }
  } catch (e) {
    if (this.options.wrapInputs) {
      wrapper.data[key] = new BuilderResponse(null, e)
      wrapper.handled[key] = FINISHED_HANDLING
      self._ran(wrapper, key)
    } else {
      self._error(wrapper, e)
    }
  }
}

/**
 * Build a response object for this Builder instance
 *
 * @this {BuilderInstance}
 * @param {Object} data input data
 * @param {Function} callback
 */
BuilderInstance.prototype.build = function (inputData, callback) {
  var data = {}
  if (this.options.wrapInputs) {
    for (var key in inputData) {
      data[key] = new BuilderResponse(inputData[key])
    }
  } else data = inputData

  // check for any missing handlers
  var missedHandlers = false
  var missingHandlers = {}
  for (var key in this.handlers) {
    for (var i = 0; i < this.handlers[key].deps.length; i += 1) {
      var dep = this.handlers[key].deps[i].split('.')[0]

      if (typeof data[dep] === 'undefined' && typeof this.handlers[dep] === 'undefined') {
        missedHandlers = true
        if (!missingHandlers[key]) missingHandlers[key] = []
        missingHandlers[key].push(dep)
      }
    }
  }
  if (missedHandlers) {
    var msgs = []
    for (var key in missingHandlers) {
      msgs.push(key + " requires [" + missingHandlers[key].join(', ') + "]")
    }
    throw new Error(msgs.join("; "))
  }

  // start the call
  if (typeof callback !== 'function') throw new Error('callback is not a function')
  if (this.numRequiredFields === 0) return callback(null, {})
  var wrapper = {
    tracing: this.traceNext
  , handled: {}
  , data: data
  , requiredData: {}
  , pendingRequired: this.numRequiredFields
  , returned: false
  , callback: callback
  }
  , i
  , iEnd

  // run any methods without deps
  for(i=0, iEnd=this.noDeps.length; i<iEnd; i+=1) this._run(wrapper, this.noDeps[i], [])
}

module.exports = BuilderInstance
