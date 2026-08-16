const mongoose = require("mongoose");

const ngoRequestSchema = new mongoose.Schema(
    {
        ngo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        foodType: {
            type: String,
            enum: ["bakery", "produce", "prepared_meals", "pantry", "any"],
            required: [true, "Food type is required"],
        },
        quantity: {
            type: Number,
            required: [true, "Quantity is required"],
            min: [1, "Quantity must be at least 1"],
        },
        neededByDate: {
            type: Date,
            required: [true, "Needed-by date is required"],
            validate: {
                validator: function (value) {
                    return value > Date.now();
                },
                message: "Needed-by date cannot be in the past",
            },
        },
        notes: {
            type: String,
            trim: true,
        },
        // FR-05: request stays open until matched or expired
        status: {
            type: String,
            enum: ["open", "matched", "expired", "cancelled"],
            default: "open",
        },
        matchedListing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
        },
    },
    { timestamps: true }
);

const NgoRequest = mongoose.model("NgoRequest", ngoRequestSchema);

module.exports = NgoRequest;