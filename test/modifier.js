// Copyright 2012 The Obvious Corporation.
var Q = require('kew')
var nodeunitq = require('nodeunitq')
var builder = new nodeunitq.Builder(exports)

// set up a graph for testing
exports.setUp = function (done) {
  this.error = new Error('This should break')
  this.graph = new (require ('../lib/shepherd')).Graph

  done()
}

// test adding an anonymous function as a modifier
builder.add(function testAnonymousModifier(test) {
  var name = "Jeremy"

  this.graph.add('name-fromLiteral', this.graph.literal(name))

  return this.graph.newBuilder()
    .builds('name-fromLiteral')
      .modifiers(function (name) {
        return name.toUpperCase()
      })
    .run({})
    .then(function (result) {
      test.equal(result['name-fromLiteral'], name.toUpperCase(), 'Response should be returned through promise')
    })
})

// builder can apply modifiers to built node
builder.add(function testModifiersFromBuilder(test) {
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

  return this.graph.newBuilder()
    .configure('addDate')
      .using({date: now})
    .builds('user')
      .using({name: 'nameHolder.name'})
      .modifiers({'addDate': 'obj'})
    .run({})
    .then(function (result) {
      test.equal(result.user.date, now, 'Response should be returned through promise')
    })
})

// node can apply modifiers to child node
builder.add(function testModifiersFromSubgraph(test) {
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

  return this.graph.newBuilder()
    .builds('user-withDate')
    .run({})
    .then(function (result) {
      test.equal(result['user-withDate'].date, now, 'Response should be returned through promise')
    })
})

// modifiers should run for self first, then builder
builder.add(function testModifiersOrdering(test) {
  var nodeValue = "Jeremy"

  this.graph.add("trimFirstChar", function (name) {
    return name.substr(1)
  }, ['name'])

  this.graph.add("addQuotes", function (name) {
    return '"' + name + '"'
  }, ['name'])

  this.graph.add("name-fromLiteral", this.graph.literal(nodeValue))
  this.graph.add("name-wrapped", this.graph.subgraph)
    .builds('name-fromLiteral')
      .modifiers('trimFirstChar')

  return this.graph.newBuilder()
    .builds('name-wrapped')
      .modifiers('addQuotes')
    .run({})
    .then(function (result) {
      test.equal(result['name-wrapped'], '"' + nodeValue.substr(1) + '"', 'Response should be returned through promise')
    })
})

// modifiers can take prefixed node names as inputs
builder.add(function testModifiersWithPrefixedNodes(test) {
  var now = Date.now()
  var user = {
    name: 'Jeremy'
  }
  this.graph.add('user-withDate', function () {
    return user
  })
  this.graph.add('user-wrapped', this.graph.subgraph)
    .builds('user-withDate')
      .modifiers('addDate')

  this.graph.add('addDate', function (userObj) {
    userObj.date = now
    return userObj
  }, ['user'])

  return this.graph.newBuilder()
    .builds('user-wrapped')
    .run({})
    .then(function (result) {
      test.equal(result['user-wrapped'].date, now, 'Response should be returned through promise')
    })
})

builder.add(function testStrConfiguredModifier(test) {
  var username = "Jeremy"
  this.graph.add('str-base', this.graph.literal(username))

  this.graph.add('str-modifier', function (str, modifier) {
    return modifier === 'lower' ? str.toLowerCase() : str.toUpperCase()
  }, ['str', 'modifier'])

  this.graph.add("str-test", this.graph.subgraph)
    .configure('str-modifier')
      .using({'modifier': this.graph.literal('lower')})
    .builds('str-base')
      .modifiers('str-modifier')

  return this.graph.newBuilder()
    .builds('str-test')
    .run({username: username})
    .then(function (result) {
      test.equal(result['str-test'], username.toLowerCase(), 'Response should be returned through promise')
    })
})

// test creating modifiers with void fields
builder.add(function testVoidModifiersDoesNotWork(test) {
  var username = "Jeremy"
  this.graph.add('str-base', this.graph.literal(username))

  this.graph.add('str-modifier', function (str, modifier) {
    return modifier === 'lower' ? str.toLowerCase() : str.toUpperCase()
  }, ['str', 'modifier'])

  this.graph.add("str-test", this.graph.subgraph)
    // This shouldn't work, because all the arguments haven't been passed.
    .builds('?str-modifier')
      .using({'modifier': this.graph.literal('lower')})
    .builds('str-base')
      .modifiers('str-modifier')

  return this.graph.newBuilder()
    .builds('str-test')
    .run({username: username})
    .then(function () {
      test.fail('Expected error')
    })
    .fail(function (e) {
      if (!/Node 'str' was not found/.test(e.message)) {
        throw e
      }
    })
})

// test passing a subgraph as a modifier (using args.)
builder.add(function testSubgraphAsModifier(test) {
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

  this.graph.add('str-testLiteral', this.graph.subgraph, ['str'])

  this.graph.add('str-proxy1', this.graph.subgraph, ['str'])
    .builds('str-testLiteral')
      .using('args.str')
      .modifiers('str-mixed')

  this.graph.add('str-proxy2', this.graph.subgraph, ['str'])

  var startStr = 'This_is_a_test'
  var endStr = 'ThIs_iS_A_TeSt'
  return this.graph.newBuilder()
    .builds('str-proxy1')
      .using({str: 'inputStr'})
    .builds('str-proxy2')
      .using({str: 'inputStr'})
      .modifiers('str-mixed')
    .run({inputStr: startStr})
    .then(function (result) {
      test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      test.equal(result['str-proxy2'], endStr, 'String should be mixed case')
    })
})

// test passing a subgraph as a modifier (using args.)
builder.add(function testSubgraphAsModifierWithObjects(test) {
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

  this.graph.add('obj-testLiteral', this.graph.subgraph, ['obj'])

  this.graph.add('str-proxy1', this.graph.subgraph, ['obj'])
    .builds('obj-testLiteral')
      .using('args.obj')
      .modifiers('str-mixed')

    var startStr = 'This_is_a_test'
    var endStr = 'ThIs_iS_A_TeSt'
    return this.graph.newBuilder()
      .builds('str-proxy1')
        .using({obj: this.graph.literal({str: startStr})})
      .run({inputStr: startStr})
      .then(function (result) {
        test.equal(result['str-proxy1'], endStr, 'String should be mixed case')
      })
  } catch (e) {
    console.error(e.stack)
  }
})
