function ConditionalError() {
  Error.apply(this, arguments)
}
require('util').inherits(ConditionalError, Error)

module.exports = ConditionalError