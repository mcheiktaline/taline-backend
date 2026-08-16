const asyncHandler = require("../utils/asyncHandler");
const Dispute = require("../models/disputeModel");
const Order = require("../models/orderModel");
const {
    applyNoShowPenalty,
    applyManualAdjustment,
} = require("../services/trustScoreService");
const { notifyUser } = require("../sockets/socketHandler");

// @desc    Raise a dispute on an order (quality/mismatch issue)
// @route   POST /api/disputes
// @access  Private
const raiseDispute = asyncHandler(async (req, res) => {
    const { orderId, reason, evidencePhoto, evidenceDescription } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    const isParty =
        order.business.toString() === req.user._id.toString() ||
        order.counterparty.toString() === req.user._id.toString();

    if (!isParty) {
        res.status(403);
        throw new Error("Not authorized to dispute this order");
    }

    // FR-19: dispute freezes any pending payout related to that order
    const dispute = await Dispute.create({
        order: order._id,
        raisedBy: req.user._id,
        type: "dispute",
        reason,
        evidencePhoto,
        evidenceDescription,
        payoutFrozen: true,
        status: "open",
    });

    order.status = "disputed";
    order.isException = true;
    order.exceptionType = "dispute";
    await order.save();

    const io = req.app.get("io");
    notifyUser(io, order.business, "disputeRaised", { orderId, disputeId: dispute._id });
    notifyUser(io, order.counterparty, "disputeRaised", { orderId, disputeId: dispute._id });

    res.status(201).json(dispute);
});

// @desc    System-triggered: mark an order as a no-show (FR-18)
// @route   PUT /api/disputes/no-show/:orderId
// @access  Private/Admin (or triggered internally by a job)
const markNoShow = asyncHandler(async (req, res) => {
    const { responsiblePartyId } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    order.status = "no_show";
    order.isException = true;
    order.exceptionType = "no_show";
    await order.save();

    const dispute = await Dispute.create({
        order: order._id,
        raisedBy: req.user._id,
        type: "no_show",
        reason: "Pickup window elapsed with no confirmation",
        status: "open",
    });

    // FR-18: trust-score penalty applied to the responsible party
    const newScore = await applyNoShowPenalty(responsiblePartyId);

    const io = req.app.get("io");
    notifyUser(io, responsiblePartyId, "noShowPenalty", { newTrustScore: newScore });

    res.json({ message: "Order marked as no-show", dispute });
});

// @desc    Get all open exceptions (Admin exception queue - FR-16)
// @route   GET /api/disputes
// @access  Private/Admin
const getExceptionQueue = asyncHandler(async (req, res) => {
    const disputes = await Dispute.find({ status: { $ne: "resolved" } })
        .populate("order")
        .populate("raisedBy", "name role")
        .sort({ createdAt: -1 });

    res.json(disputes);
});

// @desc    Admin reviews and resolves a dispute (FR-20)
// @route   PUT /api/disputes/:id/resolve
// @access  Private/Admin
const resolveDispute = asyncHandler(async (req, res) => {
    const { resolution, resolutionNotes, trustScorePoints, affectedUserId } =
        req.body;

    const validResolutions = [
        "full_refund",
        "partial_refund",
        "trust_score_adjustment",
        "dismissed",
    ];

    if (!validResolutions.includes(resolution)) {
        res.status(400);
        throw new Error(`Resolution must be one of: ${validResolutions.join(", ")}`);
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
        res.status(404);
        throw new Error("Dispute not found");
    }

    dispute.status = "resolved";
    dispute.resolution = resolution;
    dispute.resolutionNotes = resolutionNotes;
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();
    dispute.payoutFrozen = resolution === "dismissed" ? false : dispute.payoutFrozen;
    await dispute.save();

    if (resolution === "trust_score_adjustment" && affectedUserId && trustScorePoints) {
        await applyManualAdjustment(affectedUserId, trustScorePoints);
    }

    const order = await Order.findById(dispute.order);
    if (order) {
        order.status = "closed";
        order.closedAt = new Date();
        await order.save();

        const io = req.app.get("io");
        notifyUser(io, order.business, "disputeResolved", { resolution });
        notifyUser(io, order.counterparty, "disputeResolved", { resolution });
    }

    res.json({ message: "Dispute resolved", dispute });
});

module.exports = {
    raiseDispute,
    markNoShow,
    getExceptionQueue,
    resolveDispute,
};