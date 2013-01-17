// Copyright 2012 The Obvious Corporation.
var Q = require('kew')

// set up a graph for testing
exports.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/shepherd')).Graph

  done()
}

// test adding an anonymous function as a modifier
exports.testAnonymousModifier = function (test) {
  var name = "Jeremy"

  this.graph.add('name-fromLiteral', this.graph.literal(name))
    .modifiers(function (name) {
      return name.toUpperCase()
    })

  this.graph.newBuilder()
    .builds('name-fromLiteral')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-fromLiteral'], name.toUpperCase(), 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-fromLiteral'], name.toUpperCase(), 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// builder can apply modifiers to built node
exports.testModifiersFromBuilder = function (test) {
  var now = Date.now()
  var userName = 'Jeremy'
  var nameHolder = {
    name: userName
  }
  this.graph.add('user', function (name) {
    return {
      name: name
    }
  }, ['name'])

  this.graph.add('addDate', function (obj, date) {
    obj.date = date
    return obj
  }, ['obj', 'date'])

  this.graph.add('nameHolder', this.graph.literal(nameHolder))

  this.graph.newBuilder()
    .configure('addDate')
      .using({date: now})
    .builds('user')
      .using({name: 'nameHolder.name'})
      .modifiers({'addDate': 'obj'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result.user.name, userName, 'User name should be correct')
      test.equal(result.user.date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result.user.date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node can apply modifiers to child node
exports.testModifiersFromSubgraph = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withoutDate', function () {
    return user
  })

  this.graph.add('addDate', function (obj, date) {
    obj.date = date
    return obj
  }, ['obj', 'date'])

  this.graph.add('user-withDate', this.graph.subgraph)
    .configure('addDate')
      .using({date: now})
    .builds('user-withoutDate')
      .modifiers({'addDate': 'obj'})

  this.graph.newBuilder()
    .builds('user-withDate')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      //test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      //test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// node can apply modifiers to itself
exports.testModifiersFromSelf = function (test) {
  var now = Date.now()
  var userName = 'Jeremy'
  var nameHolder = {
    name: userName
  }
  this.graph.add('user-withDate', function (name) {
    return {
      name: name
    }
  }, ['name'])
  .modifiers({'addDate': 'obj'})

  this.graph.add('addDate', function (obj) {
    obj.date = now
    return obj
  }, ['obj'])

  this.graph.add('nameHolder', this.graph.literal(nameHolder))

  this.graph.newBuilder()
    .builds('user-withDate')
      .using({name: 'nameHolder.name'})
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].name, userName, 'User name should be correct')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      //test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// modifiers should run for self first, then builder
exports.testModifiersOrdering = function (test) {
  var nodeValue = "Jeremy"

  this.graph.add("trimFirstChar", function (name) {
    return name.substr(1)
  }, ['name'])

  this.graph.add("addQuotes", function (name) {
    return '"' + name + '"'
  }, ['name'])

  this.graph.add("name-fromLiteral", this.graph.literal(nodeValue))
    .modifiers('trimFirstChar')

  this.graph.newBuilder()
    .builds('name-fromLiteral')
      .modifiers('addQuotes')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['name-fromLiteral'], '"' + nodeValue.substr(1) + '"', 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['name-fromLiteral'], '"' + nodeValue.substr(1) + '"', 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// modifiers can take prefixed node names as inputs
exports.testModifiersWithPrefixedNodes = function (test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withDate', function () {
    return user
  })
    .modifiers('addDate')

  this.graph.add('addDate', function (userObj) {
    userObj.date = now
    return userObj
  }, ['user'])

  this.graph.newBuilder()
    .builds('user-withDate')
    .run({}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['user-withDate'].date, now, 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test creating modifiers with optional fields
exports.testOptionalModifiers = function (test) {
  var username = "Jeremy"
  this.graph.add('str-base', this.graph.literal(username))

  this.graph.add('str-modifier', function (str, modifier) {
    return modifier === 'lower' ? str.toLowerCase() : str.toUpperCase()
  }, ['str', 'modifier'])

  this.graph.add("str-test", this.graph.subgraph)
    .builds('?str-modifier')
      .using({'modifier': {_literal: 'lower'}})
    .builds('str-base')
      .modifiers('str-modifier')

  this.graph.newBuilder()
    .builds('str-test')
    .run({username: username}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through callback')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through promise')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test passing a subgraph as a modifier (using args.)
exports.testSubgraphAsModifier = function (test) {
  this.graph.add('str-upper', function (str) {
    return str.toUpperCase()
  }, ['str'])

  this.graph.add('str-lower', function (str) {
    return str.toLowerCase()
  }, ['str'])

  this.graph.add('str-mixed', function (str1, str2) {
    var newStr = ''
    for (var i = 0; i < str1.length; i++) {
      newStr += i % 2 == 0 ? str1[i] : str2[i]
    }
    return newStr
  }, ['!str'])
    .builds('str-upper')
      .using('args.str')
    .builds('str-lower')
      .using('args.str')

  this.graph.add('str-proxy1', this.graph.subgraph, ['str'])
    .modifiers('str-mixed')

  this.graph.add('str-proxy2', this.graph.subgraph, ['str'])

  var startStr = 'This_is_a_test'
  var endStr = 'ThIs_iS_A_TeSt'
  this.graph.newBuilder()
    .builds('str-proxy1')
      .using({str: 'inputStr'})
    .builds('str-proxy2')
      .using({str: 'inputStr'})
      .modifiers('str-mixed')
    .run({inputStr: startStr}, function (err, result) {
      test.equal(err, undefined, 'Error should be undefined')
      test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      test.equal(result['str-proxy2'], endStr, 'String should be mixed case')
    })
    .fail(function (err) {
      test.equal(true, false, 'Error handler in promise should not be called')
    })
    .then(function (result) {
      test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      test.equal(result['str-proxy2'], endStr, 'String should be mixed case')
    })
    .then(function () {
      test.done()
    })
    .end()
}

// test passing a subgraph as a modifier (using args.)
exports.testSubgraphAsModifierWithObjects = function (test) {
  try {
    this.graph.add('str-upper', function (str) {
      return str.toUpperCase()
    }, ['str'])

    this.graph.add('str-lower', function (str) {
      return str.toLowerCase()
    }, ['str'])

    this.graph.add('str-mixed', function (str1, str2) {
      var newStr = ''
      for (var i = 0; i < str1.length; i++) {
        newStr += i % 2 == 0 ? str1[i] : str2[i]
      }
      return newStr
    }, ['!obj'])
      .builds('str-upper')
        .using('args.obj.str')
      .builds('str-lower')
        .using('args.obj.str')

    this.graph.add('str-proxy1', this.graph.subgraph, ['obj'])
      .modifiers({'str-mixed': 'obj'})

    var startStr = 'This_is_a_test'
    var endStr = 'ThIs_iS_A_TeSt'
    this.graph.newBuilder()
      .builds('str-proxy1')
        .using({obj: {str: startStr}})
      .run({inputStr: startStr}, function (err, result) {
        test.equal(err, undefined, 'Error should be undefined')
        test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      })
      .fail(function (err) {
        test.equal(true, false, 'Error handler in promise should not be called')
      })
      .then(function (result) {
        test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      })
      .then(function () {
        test.done()
      })
      .end()
  } catch (e) {
    console.error(e.stack)
  }
}