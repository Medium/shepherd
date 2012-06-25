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
function BuilderInstance(handlers, paths, noDeps, requiredFields) {
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
  if(wrapper.tracing) this._traceMsg(null, "returning with error", (new Date()/1 - wrapper.traceStart))

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
      if(wrapper.tracing) this._traceMsg(null, "successfully returning", (new Date()/1 - wrapper.traceStart))
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
    if (wrapper.tracing) this._traceMsg(key, "found in input data")
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
      for( ; typeof obj !== 'undefined' && j < fieldParts.length ; j+=1) {
        obj = obj[fieldParts[j]]
      }
      args.push(obj)

    } else args.push(wrapper.data[deps[i]])
  }
  wrapper.handled[key] = STARTED_HANDLING

  var self = this
    , handler = this.handlers[key]
    , currentTime = wrapper.tracing ? new Date()/1 : 0

  if (typeof handler === 'undefined') {
    throw new Error("No handler defined for '" + key + "'")
  }

  if (wrapper.tracing) {
    args.push(function (err, data) {
      if (err) {
        self._traceMsg(key, "finished with error", (new Date()/1 - currentTime))
        return self._error(wrapper, err)
      }

      self._traceMsg(key, "finished successfully", (new Date()/1 - currentTime))

      wrapper.data[key] = data
      wrapper.handled[key] = FINISHED_HANDLING
      self._ran(wrapper, key)
    })
  } else {
    args.push(function (err, data) {
      if (err) return self._error(wrapper, err)

      wrapper.data[key] = data
      wrapper.handled[key] = FINISHED_HANDLING
      self._ran(wrapper, key)
    })
  }

  if (typeof handler.fn !== 'function') {
    throw new Error("Invalid function for handler '" + key + "'")
  }
  if (wrapper.tracing) this._traceMsg(key, "starting async request")

  try {
    handler.fn.apply(null, args)
  } catch (e) {
    self._error(wrapper, e)
  }
}

/**
 * Build a response object for this Builder instance
 *
 * @this {BuilderInstance}
 * @param {Object} data input data
 * @param {Function} callback
 */
BuilderInstance.prototype.build = function (data, callback) {
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

  if (wrapper.tracing) {
    wrapper.traceStart = new Date()/1
    wrapper.traceInfo = {}
    this.traceNext = false
    if(wrapper.tracing) this._traceMsg(null, "starting build")
  }
  for(i=0, iEnd=this.noDeps.length; i<iEnd; i+=1) this._run(wrapper, this.noDeps[i], [])
}

module.exports = BuilderInstance
