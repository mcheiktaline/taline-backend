const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
    {
        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
        },
        reservedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reserverRole: {
            type: String,
            enum: ["consumer", "ngo"],
            required: true,
        },
        quantityReserved: {
            type: Number,
            required: [true, "Quantity reserved is required"],
            min: [1, "Must reserve at least 1"],
        },
        // FR-11: unpaid hold auto-releases after timeout
        status: {
            type: String,
            enum: ["pending_payment", "confirmed", "released", "expired"],
            default: "pending_payment",
        },
        holdExpiresAt: {
            type: Date,
            required: true, // set to now + configurable timeout (e.g. 15 min)
        },
        isPaid: {
            type: Boolean,
            default: false,
        },
        paymentAmount: {
            type: Number,
            min: 0,
        },
    },
    { timestamps: true }
);

// TTL-style helper index — speeds up the job that scans for expired holds
reservationSchema.index({ holdExpiresAt: 1, status: 1 });

const Reservation = mongoose.model("Reservation", reservationSchema);

module.exports = Reservation;