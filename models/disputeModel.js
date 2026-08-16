const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        raisedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // FR-16: Three exception types detected/raised
        type: {
            type: String,
            enum: ["early_cancellation", "no_show", "dispute"],
            required: true,
        },
        reason: {
            type: String,
            trim: true,
        },
        // FR-19: attached evidence
        evidencePhoto: {
            type: String, // URL to uploaded image
        },
        evidenceDescription: {
            type: String,
            trim: true,
        },
        // FR-19: freezes any pending payout until resolved
        payoutFrozen: {
            type: Boolean,
            default: true,
        },
        // FR-20: Admin Case Review & Resolution
        status: {
            type: String,
            enum: ["open", "under_review", "resolved"],
            default: "open",
        },
        resolution: {
            type: String,
            enum: [
                "full_refund",
                "partial_refund",
                "trust_score_adjustment",
                "dismissed",
                null,
            ],
            default: null,
        },
        resolutionNotes: {
            type: String,
            trim: true,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Admin
        },
        resolvedAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

const Dispute = mongoose.model("Dispute", disputeSchema);

module.exports = Dispute;