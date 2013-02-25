// Copyright 2013 The Obvious Corporation.

/**
 * Wrapper for a node to be resolved. Used for nodes that
 * require getters() for their arguments
 *
 * @constructor
 */
function NodeResponseGetter() {}

/**
 * Get the error for this response if there is one
 *
 * @return {Error}
 */
NodeResponseGetter.prototype.getError = function () {
  return this._err
}

/**
 * Set the value for this response
 *
 * @param {Object} val
 * @return {NodeResponseGetter} the current instance
 */
NodeResponseGetter.prototype.setValue = function (val) {
  this._val = val
  return this
}

/**
 * Set the error for this response
 *
 * @param {Error} err
 * @return {NodeResponseGetter} the current instance
 */
NodeResponseGetter.prototype.setError = function (err) {
  this._err = err
  return this
}

/**
 * Get the value for this response or throw the error
 * which was originally thrown
 *
 * @return {Object}
 * @throws {Error}
 */
NodeResponseGetter.prototype.get = function () {
  if (this._err) throw this._err
  return this._val
}

module.exports = NodeResponseGetter