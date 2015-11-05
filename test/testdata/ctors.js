'use strict'

/**
 * Constructors for testing. Split into a separate file so that
 * we can load it conditionally if the env supports ES6.
 */

class DefaultCtor {
}

class TwoArgCtor {
  constructor(a, b) {
    this.a = a
    this.b = b
  }
}

class TwoArgCtorWithMethods {
  getA() {
    return a
  }

  constructor(a, b) {
    this.a = a
    this.b = b
  }
}

module.exports = {
  DefaultCtor: DefaultCtor,
  TwoArgCtor: TwoArgCtor,
  TwoArgCtorWithMethods: TwoArgCtorWithMethods
}
