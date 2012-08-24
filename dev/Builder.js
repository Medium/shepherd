var clone = require('./clone')
var NodeInstance = require('./NodeInstance')
var Q = require('kew')
var util = require('util')

function getNodeRealName(name) {
  if (name.charAt(0) === '!' || name.charAt(0) === '?') return name.substr(1)
  return name
}

function getNodeShortName(name) {
  name = getNodeRealName(name)

  if (name.indexOf('.') !== -1) {
    var parts = name.split('.')
    return parts[parts.length - 1]
  } else {
    return name.split('-')[0]
  }
}

function Builder(graph) {
  this._graph = graph
  this._nodes = {}
  this._outputs = {}
  this._compiled
}

Builder.prototype.outputs = function (fieldName) {
  var realFieldName = getNodeRealName(fieldName)
  this._outputs[fieldName] = 1
  var node = this._nodes[realFieldName] = new NodeInstance(this, this._graph._nodeDefinitions[realFieldName])
  return node
}

Builder.prototype._setupNodeDefinition = function (name, nodeDefinition, args) {
  name = name.split('.')[0]
  var nodeName = name.charAt(0) === '?' ? name.substr(1) : name
  if (!nodeDefinition) return

  if (!this._compiled.nodes[nodeName]) this._compiled.nodes[nodeName] = {}
  var compiledNode = this._compiled.nodes[nodeName]
  var i, j

  // start setting up inputs
  var inputs = compiledNode.inputs = {}
  var inputOrder = compiledNode.inputOrder = []
  var overrides = this._compiled.inputOverrides[name] || {}

  compiledNode.fn = nodeDefinition.getFunction()

  // set up default inputs from the node's definition
  var args = nodeDefinition.getArgs()
  for (i = 0; i < args.length; i++) {
    var argName = getNodeShortName(args[i])
    if (args[i].charAt(0) === '?') this._compiled.optionalFields[argName] = 1
    else inputs[argName] = overrides[argName] || getNodeRealName(argName)
    if (argName === args[i]) inputOrder.push(args[i])
  }

  // set up any children
  var children = nodeDefinition.getBuilds()
  for (i = 0; i < children.length; i += 1) {
    var child = children[i]
    var childName = getNodeRealName(child.field)

    if (child.provides) {
     for (j = 0; j < child.provides.length; j += 1) {
        this._addOverride(childName, child.provides[j], inputs)
      }
    }

    // set up the child if it doesn't exist
    if (!this._compiled.nodes[childName]) {
      this._setupNodeDefinition(childName, this._graph._nodeDefinitions[childName])
    }
  }
}

Builder.prototype._setupNodeInstance = function (name, node) {
  var realName = getNodeRealName(name)

  var node = this._nodes[realName]
  this._setupNodeDefinition(name, node.getDefinition())
}

Builder.prototype._addOverride = function (nodeName, val, args) {
  if (!this._compiled.inputOverrides[nodeName]) this._compiled.inputOverrides[nodeName] = {}
  var inputName, inputValue

  if (typeof val === 'object') {
    for (var key in val) {
      inputName = key
      inputVal = val[key]
    }
  } else if (typeof val === 'string') {
    inputName = getNodeShortName(val)
    inputVal = val
  }

  if (typeof inputVal === 'string') {
    if (inputVal.length > 5 && inputVal.substr(0, 5) === 'args.') {
      var inputValParts = inputVal.substr(5).split('.')
      var firstPart = inputValParts.shift()
      inputVal = args[firstPart] || args['!' + firstPart]
      if (inputValParts.length) inputVal += '.' + inputValParts.join('.')
    } else {
      inputName = getNodeShortName(inputName)
    }
  }

  if (typeof inputVal === 'function') {
    // map a function to a node
    inputVal = this._graph.addAnonymous(inputName + '-' + nodeName, inputVal)

  } else if (typeof inputVal !== 'string') {
    // map a literal to a node
    inputVal = this._graph.addAnonymous(inputName + '-' + nodeName, this._graph.literal(inputVal))
  }

  // map one node to another node
  this._compiled.inputOverrides[nodeName][inputName] = inputVal
}

Builder.prototype._addModifier = function (field, modifier) {
  var idx, newNodeName, currentNodeName, modifierInputField, modifierNodeName

  if (typeof modifier === 'string') {
    modifierNodeName = modifier
    modifierInputField = getNodeShortName(field)
  } else {
    for (var key in modifier) {
      modifierNodeName = key
      modifierInputField = modifier[key]
    }
  }

  if (!this._compiled.modifierIndexes[field]) idx = this._compiled.modifierIndexes[field] = 1
  else idx = ++this._compiled.modifierIndexes[field]
  var movedFieldName = field + '_modifier_' + idx

  this._compiled.nodes[movedFieldName] = clone(this._compiled.nodes[field])
  if (!this._compiled.nodes[modifierNodeName]) {
    this._setupNodeDefinition('?' + modifierNodeName, this._graph._nodeDefinitions[modifierNodeName])
  }
  this._compiled.nodes[field] = clone(this._compiled.nodes[modifierNodeName])
  this._compiled.nodes[field].inputs[modifierInputField] = movedFieldName
}

Builder.prototype.build = function () {
  var key, i

  this._compiled = {
      optionalFields: {}
    , nodes: {}
    , outputIndexes: {}
    , inputOverrides: {}
    , modifierIndexes: {}
  }

  for (key in this._nodes) {
    // set up new inputs
    var inputs = this._nodes[key].getInputs()
    if (inputs.length) {
      for (i = 0; i < inputs.length; i += 1) {
        this._addOverride(key, inputs[i])
      }
    }

    // set up the node
    this._setupNodeInstance(key, this._nodes[key].getDefinition())
  }

  for (key in this._nodes) {
    // set up definition modifiers
    var def = this._nodes[key].getDefinition()
    if (def) {
      var modifiers = def.getModifiers()
      if (modifiers.length) {
        for (i = 0; i < modifiers.length; i += 1) {
          this._addModifier(key, modifiers[i])
        }
      }
    }

    // set up builder modifiers
    var node = this._nodes[key]
    if (node) {
      for (i = 0; i < node._modifiers.length; i += 1) {
        this._addModifier(key, node._modifiers[i])
      }
    }
  }

  delete this._compiled.inputOverrides
  delete this._compiled.modifierIndexes

  return this
}

Builder.prototype.resolve = function (data, nodeName) {
  var originalNodeName = nodeName
  nodeName = getNodeRealName(nodeName)

  // dot notation
  if (nodeName.indexOf('.') !== -1) {
    var parts = nodeName.split('.')
    return data._resolve(parts[0])
      .then(function (result) {
        for (var i = 1; i < parts.length; i += 1) {
          if (!result) return result
          result = result[parts[i]]
        }
        return result
      })
  }

  // node already exists in data
  if (data.hasOwnProperty(nodeName)) return data[nodeName]

  // find all dependencies
  var node = this._compiled.nodes[nodeName]
  var promises = []
  var ordering = {}
  if (node.inputs) {
    var inputs = node.inputs
    var promises = []
    for (var key in inputs) {
      promises.push(data._resolve(inputs[key]))
      ordering[key] = promises.length - 1
    }
  }

  // wait for dependencies to resolve
  return data[nodeName] = Q.all(promises)
    .then(function (results) {
      // compose the args for the function to call
      var args = []
      for (var i = 0; i < node.inputOrder.length; i += 1) {
        args.push(results[ordering[node.inputOrder[i]]])
      }

      // add a deferred callback
      var deferred = Q.defer()
      args.push(deferred.makeNodeResolver())

      // call the function
      var result = node.fn.apply(null, args)
      return typeof result === 'undefined' ? deferred.promise : result
    })
}

Builder.prototype.run = function (data) {
  if (!this._compiled) this.build()
  var outputs = this._outputs
  var outputIndexes = this._compiled.outputIndexes
  var i, key

  // create a clean object for running this build
  data = clone(data)
  for (key in data) data[key] = Q.resolve(data[key])
  data._resolve = this.resolve.bind(this, data)
  var promises = []
  var keys = []
  for (key in outputs) {
    if (!this._compiled.optionalFields[key]) {
      promises.push(data._resolve(key))
      keys.push(key)
    }
  }

  // start resolving all of the top level nodes
  return Q.all(promises)
    .then(function (results) {
      var outputMap = {}
      for (i = 0; i < keys.length; i += 1) {
        if (keys[i].charAt(0) !== '?' &&  keys[i].charAt(0) !== '!') {
          outputMap[keys[i]] = results[i]
        }
      }
      return outputMap
    })
}

module.exports = Builder