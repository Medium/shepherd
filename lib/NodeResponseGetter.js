function NodeResponseGetter() {}

NodeResponseGetter.prototype.getError = function () {
  return this._err
}

NodeResponseGetter.prototype.setValue = function (val) {
  this._val = val
  return this
}

NodeResponseGetter.prototype.setError = function (err) {
  this._err = err
  return this
}

NodeResponseGetter.prototype.get = function () {
  if (this._err) throw this._err
  return this._val
}

module.exports = NodeResponseGetter