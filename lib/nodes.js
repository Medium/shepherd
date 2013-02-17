var typ = require('typ')

exports.greaterThan = function (val1, val2) {
  return val1 > val2
}

exports.lessThan = function (val1, val2) {
  return val1 < val2
}

exports.equalTo = function (val1, val2) {
  return val1 == val2
}

exports.isNullish = function (val) {
  return typeof val == 'undefined' || val == null
}

exports.isNull = function (val) {
  return val == null
}

exports.isUndefined = function (val) {
  return typeof val == 'undefined'
}