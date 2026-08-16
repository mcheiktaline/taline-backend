// Generic helper: checks that required fields exist and are not empty
const requireFields = (...fields) => {
    return (req, res, next) => {
        const missing = fields.filter(
            (field) =>
                req.body[field] === undefined ||
                req.body[field] === null ||
                req.body[field] === ""
        );

        if (missing.length > 0) {
            res.status(400);
            throw new Error(`Missing required field(s): ${missing.join(", ")}`);
        }

        next();
    };
};

// FR-01: Create Listing validation - rejects blank fields and past expiry dates
const validateListing = (req, res, next) => {
    const { itemName, quantity, expiryDate } = req.body;

    if (!itemName || !quantity || !expiryDate) {
        res.status(400);
        throw new Error("Item name, quantity, and expiry date are required");
    }

    if (isNaN(Date.parse(expiryDate))) {
        res.status(400);
        throw new Error("Expiry date is not a valid date");
    }

    if (new Date(expiryDate) <= new Date()) {
        res.status(400);
        throw new Error("Expiry date cannot be in the past");
    }

    if (quantity <= 0) {
        res.status(400);
        throw new Error("Quantity must be greater than 0");
    }

    next();
};

// FR-05: NGO Request validation
const validateNgoRequest = (req, res, next) => {
    const { foodType, quantity, neededByDate } = req.body;

    if (!foodType || !quantity || !neededByDate) {
        res.status(400);
        throw new Error("Food type, quantity, and needed-by date are required");
    }

    if (new Date(neededByDate) <= new Date()) {
        res.status(400);
        throw new Error("Needed-by date cannot be in the past");
    }

    next();
};

module.exports = { requireFields, validateListing, validateNgoRequest };