// Copyright 2012 The Obvious Corporation.
/**
 * @fileOverview Contains the class definition for NodeInstance which represents
 *     a node that is being built within a Builder and any dependencies that the
 *     node might have
 * @author <a href="http://github.com/azulus">Jeremy Stanley</a>
 * @version 1.0.0
 */

/**
 * Representation of a node that needs to be created in a Builder;
 * defines any inputs and/or modifiers that should be passed to the node
 *
 * @param {Builder} builder the builder that issued this request
 * @param {string} alias the alias that this node is referenced under
 * @param {string} nodeName the actual name of the node that should be built
 * @param {NodeDefinition} nodeDefinition the node that should be built
 * @constructor
 */
function NodeInstance(builder, alias, nodeName, nodeDefinition) {
  this._builder = builder
  this._alias = alias
  this._nodeName = nodeName
  this._def = nodeDefinition
  this._inputs = []
  this._modifiers = []
}

/**
 * Specify inputs to this node as either strings or a key to value mapping
 *
 * @param {string|Object} var_args a variable number of arguments, each of which
 *     is either a string representing another node name or an object with a
 *     key of the dependency name to set and value to provide (may be a literal
 *     or the name of another node)
 * @return {NodeDefinition}
 */
NodeInstance.prototype.using = function (var_args) {
  this._inputs = Array.prototype.slice.call(arguments, 0)
  return this
}

/**
 * Specify modifiers to this node as either strings or a key to value mapping
 *
 * @param {string|function(Object)|Object} var_args a variable number of arguments,
 *     each of which is either a string representing the modifier node name or a
 *     function that takes a single input and returns a new value or an object with
 *     a key of the node name to set and the dependency field in the node name to
 *     pass this node as
 * @return {NodeDefinition}
 */
NodeInstance.prototype.modifiers = function (var_args) {
  this._modifiers = Array.prototype.slice.call(arguments, 0)
  return this
}

/**
 * Proxy function which can be used to chain builds() requests back
 * to the builder
 */
NodeInstance.prototype.builds = function () {
  return this._builder.builds.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain compile() requests back
 * to the builder
 */
NodeInstance.prototype.compile = function () {
  return this._builder.compile.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain run() requests back
 * to the builder
 */
NodeInstance.prototype.run = function () {
  return this._builder.run.apply(this._builder, arguments)
}

/**
 * Proxy function which can be used to chain getDotGraph() requests back
 * to the builder
 */
NodeInstance.prototype.getDotGraph = function () {
  return this._builder.getDotGraph.apply(this._builder, arguments)
}

module.exports = NodeInstance