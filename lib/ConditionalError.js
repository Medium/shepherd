// Copyright 2013 The Obvious Corporation.


/**
 * Special type of error to be thrown in the case of a
 * conditional error within Shepherd. To be caught by
 * conditional wrapper nodes
 *
 * @constructor
 */
function ConditionalError() {
  Error.apply(this, arguments)
}
require('util').inherits(ConditionalError, Error)

module.exports = ConditionalError