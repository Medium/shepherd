// Copyright 2013 The Obvious Corporation.

/**
 * @fileoverview The intermediate results of a graph being built.
 *
 * TODO(nick): This used to be an implementation detail of Builder.js,
 * and over time we should fix this so that Builder doesn't reach
 * into its internal state.
 */

var Q = require('kew')

/**
 * @param {Object} inputData
 * @param {Config} config
 * @constructor
 */
function GraphResults(inputData, config) {
  this._numResolvedInputs = {}
  this._values = inputData || {}
  this._hashedValues = {}
  this._errors = {}
  this._hashedErrors = {}
  this._outputDefer = Q.defer()
  this._startTimes = {}
  this._shouldProfile = config.enableProfiling && (Math.random() < config.profilingFrequency)
}

/**
 * @param {CompiledNode} node
 * @param {*} result
 */
GraphResults.prototype.setNodeResult = function (node, result) {
  var nodeName = node.newName
  this._values[nodeName] = result
  this._hashedValues[node.nonSilentHash] = result
}

/**
 * @param {CompiledNode} node
 * @param {*} error
 */
GraphResults.prototype.setNodeError = function (node, error) {
  var nodeName = node.newName
  this._errors[nodeName] = error
}

/**
 * @param {CompiledNode} node
 * @return {Promise} A promise with the value resolved or the error rejected.
 *     null if there's no cached result.
 */
GraphResults.prototype.getCachedResultPromise = function (node) {
  if (this._hashedValues[node.nonSilentHash]) {
    return Q.resolve(this._hashedValues[node.nonSilentHash])
  }
  return null
}

/** @return {Promise} */
GraphResults.prototype.getPromise = function () {
  return this._outputDefer.promise
}

/** @param {string} nodeName */
GraphResults.prototype.resolveOutputNode = function (nodeName) {
  if (this._errors[nodeName]) this._outputDefer.reject(this._errors[nodeName])
  else this._outputDefer.resolve(this._values[nodeName])
}


module.exports = GraphResults
