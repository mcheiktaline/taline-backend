const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
        },
        reservation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Reservation",
        },
        business: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // The consumer or NGO on the other side of the transaction
        counterparty: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        counterpartyRole: {
            type: String,
            enum: ["consumer", "ngo"],
            required: true,
        },
        orderType: {
            type: String,
            enum: ["donate", "sell"],
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        amountPaid: {
            type: Number,
            default: 0,
            min: 0,
        },
        // FR-12: Fulfillment Type Selection
        fulfillmentType: {
            type: String,
            enum: ["self_pickup", "courier"],
            required: true,
        },
        pickupCode: {
            type: String, // generated when fulfillmentType = self_pickup
        },
        courier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        pickupWindowStart: {
            type: Date,
        },
        pickupWindowEnd: {
            type: Date,
        },
        // FR-13: Order Confirmation & Closure
        status: {
            type: String,
            enum: [
                "awaiting_pickup",
                "courier_assigned",
                "picked_up",
                "delivered",
                "closed",
                "cancelled",
                "no_show",
                "disputed",
            ],
            default: "awaiting_pickup",
        },
        closedAt: {
            type: Date,
        },
        // FR-14: Feedback & Ratings
        rating: {
            stars: {
                type: Number,
                min: 1,
                max: 5,
            },
            comment: {
                type: String,
                trim: true,
            },
            ratedAt: {
                type: Date,
            },
        },
        // FR-16/17/18: Exception tracking
        isException: {
            type: Boolean,
            default: false,
        },
        exceptionType: {
            type: String,
            enum: ["early_cancellation", "no_show", "dispute", null],
            default: null,
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;