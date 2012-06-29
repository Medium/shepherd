function BuilderResponse(data, error) {
	this.data = data
	this.error = error
}

BuilderResponse.prototype.get = function () {
	if (this.error) throw this.error
	return this.data
}

BuilderResponse.prototype.hasError = function () {
	return !!this.error
}

module.exports = BuilderResponse
