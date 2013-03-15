// Copyright 2013 The Obvious Corporation.

var net = require("net")
var repl = require("repl")
var ConditionalError = require('./ConditionalError')

function Debugger(port) {
  this._port = port
  this._socket = null
  this._buildCounter = 0
  this._builds = {}
  this._buildIds = []
}

Debugger.prototype._success = function (msg) {
  return "SUCCESS: " + msg
}

Debugger.prototype._error = function (msg) {
  return "ERROR: " + msg
}

Debugger.prototype.initRepl = function (repl) {
  var contextObj = {}

  // fields to add to the context
  var fields = ['buildId', 'nodes', 'values', 'errors', 'inputs', 'outputs']
  for (var i = 0; i < fields.length; i++) {
    repl.context.__defineGetter__(fields[i], function (field) {
      return contextObj[field]
    }.bind(null, fields[i]))
  }

  repl.context.buildIds = this._buildIds
  repl.context.loadBuild = this.loadBuild.bind(this, contextObj)
  repl.context.loadNode = this.loadNode.bind(this, contextObj)
}

Debugger.prototype._getNodeValue = function (data, nodeName) {
  var nameParts = nodeName.split('.')
  var rootName = nameParts.shift()
  if (data._errors[rootName]) throw data._errors[rootName]

  var currentVal = data._values[rootName]
  var nextChild

  while (nextChild = nameParts.shift()) {
    if (currentVal == null || typeof currentVal === 'undefined') return currentVal
    currentVal = currentVal[nextChild]
  }

  return currentVal
}

Debugger.prototype.loadNode = function (context, nodeName) {
  if (!context.buildId) return this._error("Please select a buildId with loadBuild(id)")
  if (!context.nodes[nodeName]) return this._error("Unknown node '" + nodeName + "'")

  // find all of the input values 
  var buildId = context.buildId
  var build = this._builds[buildId]
  var builder = build.builder
  var builderNodes = builder.getCompiledNodes()
  var data = build.data
  var node = builderNodes[nodeName]

  context.inputs = {
    silentArgs: {},
    args: {},
    values: {},
    errors: {}
  }
  context.outputs = {}

  var i, inputArg, inputName
  for (i = 0; i < node.silentInputs.length; i++) {
    inputArg = node.silentInputs[i]
    inputName = node.inputs[inputArg]
    context.inputs.silentArgs[inputArg] = this._getNodeSummary(data, builderNodes, inputName.split('.')[0])

    try {
      context.inputs.values[inputName] = this._getNodeValue(data, inputName)
    } catch (e) {
      context.inputs.errors[inputName] = e
    }
  }

  for (i = 0; i < node.argInputs.length; i++) {
    inputArg = node.argInputs[i]
    inputName = node.inputs[inputArg]
    context.inputs.args[inputArg] = this._getNodeSummary(data, builderNodes, inputName.split('.')[0])
 
    try {
      context.inputs.values[inputName] = this._getNodeValue(data, inputName)
    } catch (e) {
      context.inputs.errors[inputName] = e
    }
  }

  return this._success("Loaded node '" + nodeName + "'")
}

Debugger.prototype._getNodeSummary = function (data, compiledNodes, nodeName) {
  if (data._values.hasOwnProperty(nodeName)) {
    return {name: nodeName, state: "SUCCESS"}

  } else if (data._errors.hasOwnProperty(nodeName)) {
    return {name: nodeName, state: "ERROR", conditional:data._errors[nodeName] instanceof ConditionalError}

  } else if (data._startTimes[nodeName]) {
    return {name: nodeName, state: "RUNNING", durationMs: (Date.now() - data._startTimes[nodeName])}

  } else if (compiledNodes[nodeName]) {
    return {name: nodeName, state: "WAITING"}

  } else {
    return {name: nodeName, state: "UNKNOWN NODE"}
  }
}

Debugger.prototype.loadBuild = function (context, buildId) {
  if (!this._builds[buildId]) return this._error("Build #" + buildId + " does not exist")
  
  var build = this._builds[buildId]
  var builder = build.builder
  var builderNodes = builder.getCompiledNodes()
  var data = build.data

  context['buildId'] = buildId
  context.nodes = {}
  context.values = {}
  context.errors = {}

  for (var key in builderNodes) {
    var node = context.nodes[key] = this._getNodeSummary(data, builderNodes, key)

    if (node.state === 'SUCCESS') {
      context.values[key] = {
        type: typeof data._values[key],
        value: data._values[key]
      }

    } else if (node.state === 'ERROR') {
      context.errors[key] = {
        isConditional: data._errors[key] instanceof ConditionalError,
        error: data._errors[key]
      }

    }
  }

  return this._success("Loaded build #" + buildId)
}

Debugger.prototype.start = function () {
  var self = this

  net.createServer(function (socket) {
    var sdb = repl.start({
      prompt: "sdb> ",
      input: socket,
      output: socket,
      writer: function (val) {
        return val
      },
      eval: function eval(cmd, context, filename, callback) {
        var cmdParts = cmd.substr(1, cmd.length - 3).split(' ')
        var result
        switch(cmdParts[0]) {
          case "builds":
            result = self._buildIds.join(', ')
            break;

          case "build":
            result = sdb.context.loadBuild(cmdParts[1])
            break;

          case "nodes":
            result = ""
            var nodes = sdb.context.nodes
            for (var key in nodes) {
              result += key + "\t" + JSON.stringify(sdb.context.nodes[key]) + "\n"
            }
            break;

          case "node":
            result = sdb.context.loadNode(cmdParts[1])
            break;

          case "inputs":
            result = ""
            var section = cmdParts[1]
            var inputs = sdb.context.inputs
            var lastKey
            for (var key in inputs) {
              if (!section || !section.length || section.toUpperCase() == key.toUpperCase()) {
                result += "---" + key.toUpperCase() + "---\n"
                var found = false
                for (var subkey in inputs[key]) {
                  result += subkey + "\t" + JSON.stringify(sdb.context.inputs[key][subkey]) + "\n"
                  found = true
                }
                if (!found) result += "null\n"
                result += "\n"
              }
            }
            break;

          case "quit":
            socket.end()
            break;

          default: 
            result = self._error("Unknown command '" + cmdParts[0] + "'")
            break;
        }
        callback(null, result);
      }
    })

    self.initRepl(sdb)

    sdb.on('exit', function() {
      socket.end()
    })
  }).listen(this._port)
  return this
}

Debugger.prototype.stop = function () {

}

Debugger.prototype.addBuild = function (builder, buildData) {
  var buildId = ++this._buildCounter
  console.log("Adding build id '" + buildId + "' to shepherd debugger on port " + this._port)

  this._builds[buildId] = {
    builder: builder,
    data: buildData
  }
  this._buildIds.push(buildId)

  if (this._buildIds.length > 100) {
    var oldBuildId = this._buildIds.shift()
    delete this._builds[oldBuildId]
  }

  return buildId
}

module.exports = Debugger