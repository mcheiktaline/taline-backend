const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
    {
        business: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        itemName: {
            type: String,
            required: [true, "Item name is required"],
            trim: true,
        },
        category: {
            type: String,
            enum: ["bakery", "produce", "prepared_meals", "pantry"],
            required: [true, "Category is required"],
        },
        quantity: {
            type: Number,
            required: [true, "Quantity is required"],
            min: [1, "Quantity must be at least 1"],
        },
        quantityRemaining: {
            type: Number,
            required: true,
        },
        expiryDate: {
            type: Date,
            required: [true, "Expiry date is required"],
            validate: {
                validator: function (value) {
                    return value > Date.now();
                },
                message: "Expiry date cannot be in the past",
            },
        },
        photo: {
            type: String, // URL to uploaded image
        },
        // FR-02: Urgency Auto-Classification
        urgencyTier: {
            type: String,
            enum: ["normal", "priority", "critical"],
            default: "normal",
        },
        // FR-03: Donate or Sell Decision
        listingType: {
            type: String,
            enum: ["donate", "sell", null],
            default: null,
        },
        isTypeLocked: {
            type: Boolean,
            default: false, // locks once a consumer/NGO commits
        },
        // FR-10: Pricing (only relevant when listingType = "sell")
        originalPrice: {
            type: Number,
            min: 0,
        },
        discountedPrice: {
            type: Number,
            min: 0,
        },
        discountPercent: {
            type: Number,
            min: 0,
            max: 100,
        },
        // Status lifecycle
        status: {
            type: String,
            enum: [
                "pending_classification",
                "live",
                "matched",
                "reserved",
                "completed",
                "expired",
                "cancelled",
            ],
            default: "pending_classification",
        },
        // Location for radius search (FR-06, FR-09)
        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
            address: {
                type: String,
                trim: true,
            },
        },
        // FR-12: Fulfillment
        fulfillmentType: {
            type: String,
            enum: ["self_pickup", "courier", null],
            default: null,
        },
        // FR-16/17: exception tracking
        wasRelisted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

listingSchema.index({ location: "2dsphere" });

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;