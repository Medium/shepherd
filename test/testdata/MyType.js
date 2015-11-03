'use strict'

/**
 * A constructor for testing. Split into a separate file so that
 * we can load it conditionally if the env supports ES6.
 */
class MyType {
  constructor(a, b) {
    this.a = a
    this.b = b
  }
}

module.exports = MyType
