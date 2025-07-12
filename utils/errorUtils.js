class AppError extends Error {
  constructor(message, statusCode = 500, errorType = 'general', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      error: {
        message: this.message,
        type: this.errorType,
        ...(this.details && { details: this.details })
      }
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'validation', details);
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'database');
    this.originalError = originalError;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404, 'not_found');
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super(message, 401, 'authentication');
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super(message, 403, 'authorization');
  }
}

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError
};
