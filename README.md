asyncBuilder: to build objects… asynchronously
==================================

Dealing with nested asynchronous javascript is little fun and is virtually impossible to optimize by hand with any reasonably complicated block of code. Nested sets of functions will run at the speed of their slowest calls combined, regardless of what the actual dependency tree may look like. This little tool is built to help optimize these paths and to give some insight into what's going on.

Setting up and using a builder involves the following 3 steps:

Create a BuilderFactory
-------

A `BuilderFactory` is used to create a map of functions that produce output and receive a given set of inputs. The `add` function may be called to add handlers to the BuilderFactory with a name, function, and list of inputs into the function (from other handlers' output or data passed into `build()` of the `BuilderInstance`).

```javascript
var builderFactory = new require("asyncBuilder").BuilderFactory

builderFactory
  .add("firstName", getFirstName, ["user"])
  .add("lastName", getLastName, ["user"])
  .add("fullName", getFullName, ["firstName", "lastName"])

function getFirstName(user, next) {
  if (!user) return next(new Error("User does not exist"))
  next(null, user.firstName)
}

function getLastName(user, next) {
  if (!user) return next(new Error("User does not exist"))
  next(null, user.lastName)
}

function getFullName(firstName, lastName, next) {
  next(null, firstName + ' ' + lastName)
}
```

As a note: any errors passed into the first parameter of `next` for a given handler will end the execution of the current `build()` call (with the exception of any calls in progress which will silently be ignored) and will bubble up to the callback specified to the `build` step.

You may also provide the name of one handler as the function for another if you wish to provide another accessor:

```javascript
builderFactory
  .add("shortName", "firstName")
```

`BuilderFactory` instances may be cloned as a method of extending them without overriding (or adding to) the handlers on the original factory:

```javascript
var newBuilderFactory = builderFactory
  .clone()
  .add("fullName", getAbbreviatedName, ["firstName", "lastName"])
  .add("shortName", "lastName")
```

Create a `BuilderInstance`
-------

The `BuilderFactory` can create `BuilderInstance` objects via the `newBuilder` method. Each `BuilderInstance` will have a code path optimized for it's specific set of required output fields. Only the code needed to fulfill a given instance's outputs will ever be ran by a given `BuilderInstance`.

```javascript
var myBuilder = builderFactory.newBuilder(["fullName", "shortName"])
```

Build your object
-------

Your `BuilderInstance` can now be used to asynchronously generate output via the `build` method.

```javascript
myBuilder.build({user: {firstName: "Jeremy", lastName: "Stanley"}}, function (err, data) {
  //data.fullName and data.shortName should both be present
})
```

If you have a need to further inspect what's happening with the asyncBuilder, a utility method `trace()` has been exposed on the `BuilderInstance` and will show timing information and execution steps for a given `build()` call:

```javascript
myBuilder
  .trace()
  .build({user: {firstName: "Jeremy", lastName: "Stanley"}}, function (err, data) {
  //data.fullName and data.shortName should both be present
})
```

Contributing
------------

Questions, comments, bug reports, and pull requests are all welcome.
Submit them at [the project on GitHub](https://github.com/Obvious/asyncBuilder/).

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
See the top-level file `LICENSE.txt` and
(http://www.apache.org/licenses/LICENSE-2.0).
