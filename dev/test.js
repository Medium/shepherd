var Graph = require('./Graph')
var graph = new Graph

/**
 * Convert a user id into a user
 */
function upcastUser(userId) {
  return typeof userId === 'object' ? userId : {
    id: userId,
    username: "Fred"
  }
}
graph.add('user-byId', upcastUser, ['userId'])

/**
 * Convert a collection id into a collection
 */
function upcastCollection(collectionId) {
  return typeof collectionId === 'object' ? collectionId : {id: collectionId}
}
graph.add('collection-byId', upcastCollection, ['collectionId'])

/**
 * Check whether a user can post to a collection
 */
function canPost(user, username, collection) {
  return true
}
graph.add('canPost', canPost, ['user', 'username', 'collection'])

/**
 * Require that a user can post to a collection
 */
function requireCanPost(canPost) {
  if (!canPost) throw new Error("User is unable to post to collection")
  return true
}
graph.add('requireCanPost', requireCanPost)
  .args('!user', '!username', '!collection')
  .build('canPost')
    .using('args.user', 'args.user.username', 'args.collection')

/**
 * Add a timestamp to a post
 */
function postWithTimestamp(post) {
  post.timestamp = Date.now()
  return post
}
graph.add('post-withTimestamp', postWithTimestamp, ['post'])

/**
 * Create a post
 */
function createPost(title, body, user, collection) {
  return {
    title: title,
    body: body,
    user: user,
    collection: collection
  }
}
graph.add('post-create', createPost)
  .args('title', 'body', 'user', 'collection')
  .build('!requireCanPost')
    .using('args.user', 'args.user.username', 'args.collection')
  .build('?post-withTitleByUsername')
    .using('args.user.username')
  .modifiers('post-withTitleByUsername', 'post-withTimestamp')

/**
 * Add quotes to the timestamp in a post
 */
function postWithQuotedTimestamp(post) {
  post.timestamp = '"' + post.timestamp + '"'
  return post
}
graph.add('post-withQuotedTimestamp', postWithQuotedTimestamp, ['post'])

function postWithTitleByUsername(post, username) {
  post.title = "\"" + post.title + "\" by " + username
  return post
}
graph.add('post-withTitleByUsername', postWithTitleByUsername, ['post', 'username'])

// Create a builder which will create a post
var asyncBuilder = graph.newAsyncBuilder()
  .outputs('!collection-byId').using('req.query.collectionId')
  .outputs('!user-byId').using('req.query.userId')
  .outputs('post-create')
    .using('user-byId', 'collection-byId', {'body': 'req.query.body'}, 'req.query.title')
    .modifiers({'post-withQuotedTimestamp': 'post'})
  .outputs("!req.query.body")
  .build()

// build a response
asyncBuilder.run({
  req: {
    query: {
      body: "This is the body",
      title: "this is the title",
      collectionId: "this is the collection id",
      userId: "this is the user id"
    }
  }
})
  .then(function (data) {
    console.log("DATA", data)
  })
  .fail(function (e) {
    console.log("ERR", e)
  })
  .end()

