function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  
  const response = { success: false, error: message };
  
  // Include details if they exist (for validation errors)
  if (err.details) {
    response.details = err.details.errors || err.details;
  }
  
  res.status(status).json(response);
}

module.exports = errorHandler;
