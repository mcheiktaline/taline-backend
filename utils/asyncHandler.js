// Wraps an async route handler so any thrown error is automatically
// passed to Express's error-handling middleware (no try/catch needed everywhere)
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;