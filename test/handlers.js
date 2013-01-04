// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.graph = new (require ('../lib/asyncBuilder')).Graph
  done()
}

// test pre handlers for a graph
exports.testPre = function (test) {
  this.graph.add("str-duplicated", function (str) {
    return str + str
  }, ['str'])

  var builder = this.graph.newAsyncBuilder()
    .builds({basic: 'str-duplicated'})
      .using({str: 'str1'})
    .builds({preprocessed: 'str-duplicated'})
      .using({str: 'str2'})

  builder.preRun(function (data) {
    var defer = Q.defer()
    setTimeout(function () {
      data['str2'] = data['str2'] + '?'
      defer.resolve(data)
    }, 1)
    return defer.promise
  })

  builder.preRun(function (data) {
    data['str2'] = data['str2'] + '!'
    return data
  })

  builder.run({
    str1: "hello",
    str2: "hello"
  })
  .then(function (data) {
    test.equal(data['basic'], 'hellohello', "Output string should be hellohello")
    test.equal(data['preprocessed'], 'hello?!hello?!', "Output string should be hello?!hello?!")
    test.done()
  })
  .end()
}

// test post handlers for a graph
exports.testPost = function (test) {
  this.graph.add("str-duplicated", function (str) {
    return str + str
  }, ['str'])

  var builder = this.graph.newAsyncBuilder()
    .builds({basic: 'str-duplicated'})
      .using({str: 'str1'})
    .builds({postprocessed: 'str-duplicated'})
      .using({str: 'str2'})

  builder.postRun(function (data) {
    var defer = Q.defer()
    setTimeout(function () {
      data['postprocessed'] = data['postprocessed'] + '?'
      defer.resolve(data)
    }, 1)
    return defer.promise
  })

  builder.postRun(function (data) {
    data['postprocessed'] = data['postprocessed'] + '!'
    return data
  })

  builder.run({
    str1: "hello",
    str2: "hello"
  })
  .then(function (data) {
    test.equal(data['basic'], 'hellohello', "Output string should be hellohello")
    test.equal(data['postprocessed'], 'hellohello?!', "Output string should be hellohello?!")
    test.done()
  })
  .end()
}

// test mixed handlers for a graph
exports.testMixed = function (test) {
  this.graph.add("str-duplicated", function (str) {
    return str + str
  }, ['str'])

  var builder = this.graph.newAsyncBuilder()
    .builds({basic: 'str-duplicated'})
      .using({str: 'str1'})
    .builds({processed: 'str-duplicated'})
      .using({str: 'str2'})

  builder.preRun(function (data) {
    var defer = Q.defer()
    setTimeout(function () {
      data['str2'] = '"' + data['str2'] + '"'
      defer.resolve(data)
    }, 1)
    return defer.promise
  })

  builder.preRun(function (data) {
    data['str2'] = '<h3>' + data['str2'] + '</h3>'
    return data
  })

  builder.postRun(function (data) {
    var defer = Q.defer()
    setTimeout(function () {
      data['processed'] = data['processed'] + '?'
      defer.resolve(data)
    }, 1)
    return defer.promise
  })

  builder.postRun(function (data) {
    data['processed'] = data['processed'] + '!'
    return data
  })

  builder.run({
    str1: "hello",
    str2: "hello"
  })
  .then(function (data) {
    test.equal(data['basic'], 'hellohello', "Output string should be hellohello")
    test.equal(data['processed'], '<h3>"hello"</h3><h3>"hello"</h3>?!', "Output string should be <h3>\"hello\"</h3><h3>\"hello\"</h3>?!")
    test.done()
  })
  .end()
}