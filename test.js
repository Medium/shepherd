var asyncBuilder = require("./asyncBuilder")

  , getUser = function(req, next) {
      next(null, req.user)
    }

  , getUserName = function(user, next) {
      next(null, user.name)
   }

  , getFirstName = function(name, next) {
      next(null, name.first)
    }

  , getLastName = function(name, next) {
      next(null, name.last)
    }

  , getAge = function(user, next) {
      next(null, user.age)
    }

  , getFirstNamePlusTimestamp = function(firstName, timestamp, next) {
      next(null, firstName + ":" + timestamp)
    }

  , getCurrentDate = function(next) {
      next(null, Date.now())
    }

  , getCurrentTimestamp = function(date, next) {
      next(null, Math.floor(date/1000))
    }

var TestBuilderFactory = new asyncBuilder.BuilderFactory()
  .add("reqUser", getUser, ["req"])
  .add("user", "reqUser")
  .add("name", getUserName, ["user"])
  .add("firstName", getFirstName, ["name"])
  .add("lastName", getLastName, ["name"])
  .add("age", getAge, ["user"])

var SecondTestBuilderFactory = TestBuilderFactory.clone()
  .add("currentDate", getCurrentDate)
  .add("currentTimestamp", getCurrentTimestamp, ["currentDate"])
  .add("namePlusTimestamp", getFirstNamePlusTimestamp, ["firstName", "currentTimestamp"])

var req = {
  user: {
    name: {
      first: "Jeremy"
    , last: "Stanley"
    }
  , age: 28
  }
}

var builder = SecondTestBuilderFactory.newBuilder(["firstName", "lastName", "age", "namePlusTimestamp"])
  .trace()
  .build({req:req}, function(err, data) {
    console.log("-------DONE-------", arguments)
  })
