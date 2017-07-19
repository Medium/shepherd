'use strict'

/**
 * Arrow functions testing. Split into a separate file so that
 * we can load it conditionally if the env supports ES6.
 */

module.exports = {
  empty: () => something(true),
  single: (param) => something(true),
  singleBare: param => something(true),
  multiple: (hot, cross, buns) => something(true),
}
