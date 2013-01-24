shepherd: asynchronous dependency injection and more!
==================================

**Shepherd** is a graph-based dependency resolution system, designed to simplify request pipelines that have multiple asynchronous steps. Shepherd makes it easy to split code into fine-grained, composable units.

For example, a feed may draw on multiple sources of data which need to be fetched in parallel (and each may have multiple processing steps), but they may have some common dependencies. With **Shepherd**, you would break each step into a single function, which would return immediately or through a promise, and specify any direct dependencies. Once all of the components are created atomically, the `Graph` will handle when each node runs and provide you with the processed output once all steps have completed.

Getting started
-------

To get started with **shepherd**, you need to create a `Graph`. A `Graph` is a registry of all of the things you want to be able to do (units of work). First, instantiate the Graph:

```javascript
var graph = new require("shepherd").Graph
```

Next, you need to add some nodes to the `Graph` which perform said units of work. Let's add 2 nodes to the Graph:

```javascript
// create a node which returns the current timestamp in millis
graph.add('timestamp-nowMillis', Date.now)

// create a node which will uppercase a string
function toUpper(str) {
  return str.toUpperCase()
}
graph.add('str-toUpper', toUpper, ['str'])
```

Now that you have a `Graph` of things that can be done, you need to create a `Builder` which will connect those different pieces together to produce a desired result. In this case we'll create a `Builder` which will uppercase an input string and return the current timestamp in millis:

```javascript
var builder = graph.newBuilder()
  .builds('str-toUpper')
  .builds('timestamp-nowMillis')
```

Finally, you can run the `Builder` with a given set of inputs and it will optimally run through the units of work:

```javascript
builder.run({str: "Hello"}, function (err, data) {
  // data['str-toUpper'] should be HELLO
  // data['timestamp-nowMillis'] should be the current timestamp in millis
})
```

And that's the simple flow through **shepherd**, though there's a lot of additional functionality listed below.

What is the Graph really?
-------

The `Graph` in shepherd is the place where you put all the things your application is able to do. Before you add any nodes to a `Graph`, you'll need to make sure to instantiate it first:

```javascript
var graph = new require("shepherd").Graph
```

Adding nodes to the Graph
-------

In order to make the `Graph` do some work for you, you'll have to add some nodes with `Graph#add`. The first argument is the name of the node (which will be used to reference this node later), the second is the handler function to perform the work of this node, and the third is an optional array of arguments to be passed in to this node (which may be passed separately via .args()):

```javascript
// add a function to uppercase an input string by passing the arguments in .add()
graph.add("str-toUpper", function (str) { return str.toUpperCase() }, ['str'])

// add a function to lowercase an input string by passing the arguments via chaining
graph.add("str-toLower", function (str) { return str.toLowerCase() })
  .args('str')
```

### About node names

Many functions in **shepherd** can take *either* the name of a node *or* an object (arg-to-node or node-to-arg mapping based on context) as an input. If the name of a node is passed in, the following rules are used to determine what the corresponding arg name should be (returning as soon as a rule is met):

1. If the node name contains a **.** (using members, defined later), the arg name is anything to the right of the last **.** *e.g.: user.username becomes username*
2. If the node name contains a **-**, the arg name is anything to the left of the first **-** *e.g.: user-fromSpain becomes user*
3. If no previous match is made, the arg name is the node name *e.g.: userCredentials becomes userCredentials*

This leads to certain *suggested* naming patterns within the **shepherd** world:

* Nodes should be named as *TYPE_OF_RESPONSE*-*SOURCE_OF_RESPONSE* *e.g.: user-byId*
* Nodes should be referenced as specifically as possible via members (defined later) *e.g.: user-byId.username*

Using these syntaxes provides a lot of benefits as nodes that take in args with a given name can automatically infer their inputs:

```javascript
// uppercases a name, expects a 'name' variable
graph.add('name-toUpper', function (name) { return name }, ['name'])

// provides a name, will be provided as the 'name' arg due to the -
graph.add('name-fromLiteral', graph.literal('Jeremy'))

// an object with a name, can be accessed as userObj.name
graph.add('userObj', {name: "Jeremy"})

// DON'T WORRY ABOUT THE DETAILS WITH THE BUILDER NOW, THEY'LL BE EXPLAINED LATER
// creates a builder which passes name-fromLiteral into name-toUpper
graph.newBuilder()
  .builds('name-toUpper')
    .using('name-fromLiteral') // this automatically figures out that it should be passed as 'name'

// creates a builder which passes userObj.name into name-toUpper
graph.newBuilder()
  .builds('name-toUpper')
    .using('userObj.name') // this automatically figures out that it should be passed as 'name'
```

These syntaxes

### Returning and errors
`Graph` nodes may choose to return or throw synchronously or they may return or throw asynchronously through a promise (we currently use the node module `kew` which is a lighter implementation of much `Q` functionality) or via a node-style callback passed in as the last argument:

```javascript
// returns synchronously
graph.add('result-sync', function () { return true })

// returns asynchronously via promise
graph.add('result-promise', function () { return require('kew').resolve(true) })

// returns asynchronously via callback
graph.add('result-callback', function (next) { next(undefined, true) })

// throws synchronously
graph.add('throws-sync', function () { throw new Error('NOOOO') })

// throws asynchronously via promise
graph.add('throws-promise', function () { return require('kew').reject(new Error('NOOOO')) })

// throws asynchronously via callback
graph.add('throws-callback', function () { next(new Error('NOOOO')) })
```

### Literals
Non-string literals may also be added as graph nodes by passing them directly to .add():

```javascript
// add a number as a literal
graph.add('secret-ofLifeTheUniverseAndEverything', 42)

// add an object as a literal
graph.add('object-test', {isTest: true})
```

String literals must be passed in through a special wrapper object or through the utility method `Graph#literal`:

```javascript
// add a string as a literal with a wrapper object
graph.add('name-fromObject', {_literal: 'Jeremy'})

// add a string as a literal with the utility method
graph.add('name-fromFunction', graph.literal('Jeremy'))
```

Strings require a special case due to the cloning behavior built into **shepherd**. If you wish to clone a node into a node with a new name, call .add() with the old name and the new name:

```javascript
// copy one node to another
graph.add('name-oldNode', 'name-newNode')
```

### Modifiers
A node may also define one or more modifiers for itself when it is added to the `Graph`. Modifiers exist as other nodes in the `Graph` and serve to transform the output of a node (asynchronously). If a modifier is added with only the name of the node, the name of the argument to use when calling the modifier is deduced from the parent's name:

```javascript
// uppercase a given string
graph.add('name-toUpper', function (name) { return name.toUpperCase() }, ['name'])

graph.add('name-fromObject', {_literal: 'Jeremy'})
  // the parent's name is 'name-fromObject' so the input into 'name-toUpper' is inferred to be 'name'
  .modifiers('name-toUpper', 'name-someOtherModifier')
```

You can explicitly pass in the name of the argument for the modifier by creating an object with a key of the modifer node name and a value of the argument name (think "into modifier *as* argument"):

```javascript
// uppercase a given string
graph.add('str-toUpper', function (str) { return str.toUpperCase() }, ['str'])

graph.add('name-fromObject', {_literal: 'Jeremy'})
  // inferring the name wouldn't work here as 'name-fromObject' would be converted to 'name'
  // and 'str-toUpper' is expecting 'str'
  .modifiers({'str-toUpper': 'str'})
```

You may also create modifiers from functions which take the node to be modified as the first argument:

```javascript
function toUpper(str) { return str.toUpperCase() }

graph.add('name-fromObject', {_literal: 'Jeremy'})
  .modifiers(toUpper)
```

### Caching and de-duplication
By default, a `Builder` instance will merge all nodes that it finds have the exact same handler function when it runs through its compile() phase and these functions will only ever run once during a `Builder#run` call. If you wish to make sure that a node is ran every time it is referenced by another node, you can call `.disableCache()` on the node when adding the node to the `Graph`:

```javascript
graph.add("timestamp-nowMillis", Date.now)
  .disableCache()
```

### A word about chaining
The methods defined above that apply to nodes when they're added to the graph (`.args()` and `.modifiers()`) must be ran before any `.builds()` calls are ran for the node in order to disambiguate what node the calls should affect.

Building nodes
-------
Now that we have nodes added to a `Graph` instance, we need to actually set up relationships between and make a `Builder` which will create our output. All of the functions specified here can be applied to either a node that has been added to the `Graph` or to a node being built in a `Builder`. Basic examples will be provided for both options and the variations can be extrapolated from those.

### .builds()
`.builds()` should be called when a node needs to be ran in the current context:

```javascript
builder
  .builds('name-fromLiteral') // build name-fromLiteral before returning from the builder

graph.add('name-validated', validateName)
  .builds('name-fromLiteral') // build name-fromLiteral and pass it as an input to validateName()
```

### Member variables
If you only wish to retrieve a member variable of a node, you can access it using standard javascript *.* delimiters:

```javascript
builder
  .builds('user.name')
  .builds('user.emails.primary')
```

### Remapping
Nodes can be renamed / aliased at build time by passing an object to `.builds()` with the new name of the node as the key and the current node name as the value. This allows you to call a node multiple times while providing each instance with different inputs

```javascript
// DON'T WORRY, .using() WILL BE EXPLAINED SOON
builder
  .builds({'user1': 'user-byUserId'})
    .using({userId: 1})
  .builds({'user2': 'user-byUserId'})
    .using({userId: 2})
```

### Silent nodes
Nodes can also be built and ran without their output being provided to the requester by prefixing the node name with **!** *e.g.: !validateEmail* (if the node is remapped, prefix the alias with **!** *e.g.: {'!validator': 'validateEmail'}*). This is particularly useful in the case of validators which may throw an `Error` if a condition isn't met. The following example uses a silent node to actually stop the work from being done:

```javascript
// create a node which will call an update e-mail function for a user but will only run if validateEmail is successful
graph.add('updateEmail', updateEmail, ['user', 'email'])
  // take the email as an input
  .args('email')
  // call validateEmail with the email arg passed in to updateEmail
  .builds('!validateEmail')
    .using('args.email')
```

### .using()
Nodes defined via `.builds()` will often need to be wired up to know what context they should be called in. `.using()` provides this ability by specifying where a node should get its inputs from. Inputs may be literals (using the rules provided above), anonymous functions, other nodes, or arguments provided to the parent node (in the case of a `Graph` node).

```javascript
graph.add('str-fromInput', {_literal: "This is my string"})
graph.add('str-toUpper', toUpper, ['str'])

// call str-toUpper by piping str-fromInput into it
builder
  .builds('str-toUpper')
    .using('str-fromInput') // automatically mapped to 'str' by the name resolution explained earlier

// call str-toUpper by passing it a literal
builder
  .builds('str-toUpper')
    .using({'str': { _literal: 'This is my string' }})

// call str-toUpper by passing in an anonymous function
builder
  .builds('str-toUpper')
    .using({'str': function () { return 'This is my string' }})

// call str-toUpper from str-transformed by passing in the 'str' arg which was passed into 'str-transformed'
graph.add('str-transformed', transformString)
  // take in 'str' as an arg but don't pass it through to transformString
  .args('!str')
  // pass the results of str-toUpper through to transformString
  .builds('str-toUpper')
    .using('args.str')
```

### .modifiers()
Nodes defined via `.builds()` may have modifiers added on in a manner identical to a node adding a modifier to itself (as defined above):

```javascript
function toUpper(str) { return str.toUpperCase() }

builder
  .builds('str-fromInput')
    .modifiers('str-toUpper', {'str-toLower': 'str'}, toUpper)
```

Running the Builder
-------
Once your `Graph` has been constructed and your `Builder` has been built, you can actually do something with it! `Builder#run()` accepts an input object, which will add new nodes to the graph (data-only) at run-time, and an optional callback:

```
// node-style callback can be passed in as the second argument
builder.run({name: "Jeremy", currentTimestamp: Date.now()}, function (err, data) {
  // you should have either an error or data at this point
})
// but a kew promise is also returned!
.then(function (data) {

})
.fail(function (err) {

})
```

Utility Methods
-------

### Graph#forceClone()
If you wish to create a base `Graph` instance which may be extended without mutating the original, you may explicitly call `Graph#clone()` or use `Graph#forceClone()` to cause any mutating changes to create a new `Graph` instance with a copy of all existing `NodeDefinition` instances:

```javascript
// explicitly create a clone
var newGraph = graph.clone()

// force clones for mutating changes
graph.forceClone()

// this creates a new graph as well
var newGraph = graph.add('someNode', someFunction)
```

### Graph#validator()
`Graph#validator()` may be called to create a function which takes a string inputs and validates it against a regular expression. If the regular expression fails, an Error is returned with a specified error message:

```javascript
// I know this is a horrible e-mail regex...
graph.add('email-validated', graph.validator(/^[^@]+@.*/, "An invalid-email address was provided"), ['email'])
```

### Graph#setter()
`Graph#setter()` may be called to create a function which takes an object and a value and sets a field on the object to that value:

```javascript
graph.add('user-setEmail', graph.setter('email'), ['user', 'email'])
```

### Graph#deleter()
`Graph#deleter()` may be called to create a function which takes an object and deletes a specified field on the object:

```javascript
graph.add('user-deleteEmail', graph.deleter('email'), ['user'])
```

### Graph#subgraph()
`Graph#subgraph()` returns a function which will always return the last non-callback parameter passed into it, this is useful for created a "subgraph" within a `Graph` which doesn't contain any new functions but may coordinate complex operations:

```javascript
graph.add('user-updateEmail', graph.subgraph)
  // takes user and email as inputs but doesn't send them to graph.subgraph
  .args('!user', '!email')
  // set the email value on the user
  .builds('!user-setEmail')
    .using('args.email')
    // validate the user has a valid e-mail address
    .modifiers('user-validateEmail')
  // finally, pipe the results of user-setEmail into user-save and return the result to graph.subgraph
  .builds('user-save')
    .using('user-setEmail')
```

Utility Nodes
-------

### _requiredFields
Nodes may use the `_requiredFields` node to reflect on what member variables are expected of them from within a given `Builder`. If a node is only ever referenced via member variables, `_requiredFields` will return an array of required member names. Otherwise, `_requiredFields` will return '*' to signify that the entire object is being asked for:

```javascript
function getUser(userId, _requiredFields) {
  var user

  if (_requiredFields == '*') {
    // retrieve the entire user
  } else {
    // loop over the fields in _requiredFields and figure out what we actually need for this request
  }

  // construct a cookie object somehow
  return user
}
graph.add('user-byUserId', getUser, ['userId', '_requiredFields'])
```

Contributing
------------

Questions, comments, bug reports, and pull requests are all welcome.
Submit them at [the project on GitHub](https://github.com/Obvious/shepherd/).

Bug reports that include steps-to-reproduce (including code) are the
best. Even better, make them in the form of pull requests that update
the test suite. Thanks!


Author
------

[Jeremy Stanley](https://github.com/azulus)
supported by
[The Obvious Corporation](http://obvious.com/).


License
-------

Copyright 2012 [The Obvious Corporation](http://obvious.com/).

Licensed under the Apache License, Version 2.0.
See the top-level file `LICENSE.TXT` and
(http://www.apache.org/licenses/LICENSE-2.0).
