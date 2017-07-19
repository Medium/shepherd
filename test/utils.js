// Copyright 2013 The Obvious Corporation.

var Q = require('kew')
var nodeunitq = require('nodeunitq')
var semver = require('semver')
var builder = new nodeunitq.Builder(exports)
var utils = require('../lib/utils')

builder.add(function testNodeNames(test) {
  var ok = function (str) {
    utils.assertValidNodeName(str)
  }
  var bad = function (str) {
    test.throws(function () {
      ok(str)
    }, 'Expected error: ' + str)
  }

  ok('req')
  ok('req.body')
  ok('req.body.id')
  ok('*')
  ok('args.*')
  ok('!req')
  ok('+req')
  ok('?req')
  ok('req1')
  ok('body-forId')
  ok('body-forId.property')

  ok('req.params.*')
  ok('req_params_*') // internal-only representation
  ok('req.0') // arrays
  ok('req.10') // arrays

  bad('1req')
  bad('req..body')
  bad('!!req')
  bad('req.body-fromX')
  bad('req.1x')
  bad('req.*x')
  bad('**')
  bad('req.**')
  bad('req.*.*')
  bad('req.*.*')
  bad('req.*.abc')
  bad('req*')

  test.done()
})

builder.add(function testParseClassicFnParams(test) {
  function named(one, two, three) {
    something(true)
  }

  function single(arg) {
    something(true)
  }

  function empty() {
    something(true)
  }

  test.deepEqual(['one', 'two', 'three'], utils.parseFnParams(named))
  test.deepEqual(['arg'], utils.parseFnParams(single))
  test.deepEqual([], utils.parseFnParams(empty))

  test.deepEqual(['one', 'two', 'three'], utils.parseFnParams(function (one, two, three) {
    something(true)
  }))
  test.deepEqual(['arg'], utils.parseFnParams(function (arg) { something(true) }))
  test.deepEqual([], utils.parseFnParams(function() { something(true) }))

  test.done()
})

builder.add(function testParseArrowFnParams(test) {
  'use strict'

  if (semver.lt(process.version, 'v4.0.0')) return test.done()

  var arrows = require('./testdata/arrows')

  test.deepEqual([], utils.parseFnParams(arrows.empty))
  test.deepEqual(['param'], utils.parseFnParams(arrows.single))
  test.deepEqual(['param'], utils.parseFnParams(arrows.singleBare))
  test.deepEqual(['hot', 'cross', 'buns'], utils.parseFnParams(arrows.multiple))

  test.done()
})
