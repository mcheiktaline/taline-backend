const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const Order = require("../models/orderModel");
const Reservation = require("../models/reservationModel");
const Listing = require("../models/listingModel");
const {
    isCourierMandatory,
    getFulfillmentWindowMinutes,
} = require("../services/urgencyService");
const { addRating } = require("../services/trustScoreService");
const { notifyUser } = require("../sockets/socketHandler");

// @desc    Create an order from a confirmed reservation, choosing fulfillment type
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
    const { reservationId, fulfillmentType } = req.body;

    const reservation = await Reservation.findById(reservationId);

    if (!reservation || reservation.status !== "confirmed") {
        res.status(400);
        throw new Error("Reservation must be confirmed before creating an order");
    }

    const listing = await Listing.findById(reservation.listing);

    // FR-12: courier is mandatory for Critical-tier orders
    let finalFulfillment = fulfillmentType;
    if (isCourierMandatory(listing.urgencyTier)) {
        finalFulfillment = "courier";
    }

    if (!["self_pickup", "courier"].includes(finalFulfillment)) {
        res.status(400);
        throw new Error("fulfillmentType must be 'self_pickup' or 'courier'");
    }

    const windowMinutes = getFulfillmentWindowMinutes(listing.urgencyTier);
    const pickupWindowStart = new Date();
    const pickupWindowEnd = new Date(Date.now() + windowMinutes * 60 * 1000);

    const order = await Order.create({
        listing: listing._id,
        reservation: reservation._id,
        business: listing.business,
        counterparty: req.user._id,
        counterpartyRole: req.user.role,
        orderType: listing.listingType,
        quantity: reservation.quantityReserved,
        amountPaid: reservation.paymentAmount || 0,
        fulfillmentType: finalFulfillment,
        pickupCode:
            finalFulfillment === "self_pickup"
                ? crypto.randomBytes(3).toString("hex").toUpperCase()
                : undefined,
        pickupWindowStart,
        pickupWindowEnd,
        status:
            finalFulfillment === "courier" ? "awaiting_pickup" : "awaiting_pickup",
    });

    const io = req.app.get("io");
    notifyUser(io, listing.business, "orderCreated", { orderId: order._id });

    res.status(201).json(order);
});

// @desc    Assign a courier to an order
// @route   PUT /api/orders/:id/assign-courier
// @access  Private/Courier
const assignCourier = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    if (order.fulfillmentType !== "courier") {
        res.status(400);
        throw new Error("This order does not use courier fulfillment");
    }

    order.courier = req.user._id;
    order.status = "courier_assigned";
    await order.save();

    const io = req.app.get("io");
    notifyUser(io, order.business, "courierAssigned", { orderId: order._id });
    notifyUser(io, order.counterparty, "courierAssigned", { orderId: order._id });

    res.json(order);
});

// @desc    Courier confirms pickup
// @route   PUT /api/orders/:id/confirm-pickup
// @access  Private/Courier
const confirmPickup = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    order.status = "picked_up";
    await order.save();

    res.json(order);
});

// @desc    Business validates the consumer's pickup code (self pickup closure)
// @route   PUT /api/orders/:id/validate-code
// @access  Private/Business
const validatePickupCode = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    if (order.business.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized");
    }

    if (order.pickupCode !== code) {
        res.status(400);
        throw new Error("Invalid pickup code");
    }

    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    const io = req.app.get("io");
    notifyUser(io, order.counterparty, "orderClosed", { orderId: order._id });

    res.json({ message: "Order closed successfully", order });
});

// @desc    Courier confirms drop-off (closes courier-fulfilled orders)
// @route   PUT /api/orders/:id/confirm-delivery
// @access  Private/Courier
const confirmDelivery = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error("Order not found");
    }

    order.status = "closed";
    order.closedAt = new Date();
    await order.save();

    const io = req.app.get("io");
    notifyUser(io, order.business, "orderClosed", { orderId: order._id });
    notifyUser(io, order.counterparty, "orderClosed", { orderId: order._id });

    res.json({ message: "Delivery confirmed, order closed", order });
});

// @desc    Rate a completed order (FR-14)
// @route   PUT /api/orders/:id/rate
// @access  Private
const rateOrder = asyncHandler(async (req, res) => {
    const { stars, comment } = req.body;

    if (!stars || stars < 1 || stars > 5) {
        res.status(400);
        throw new Error("Stars must be between 1 and 5");
    }

    const order = await Order.findById(req.params.id);

    if (!order || order.status !== "closed") {
        res.status(400);
        throw new Error("Can only rate closed orders");
    }

    order.rating = { stars, comment, ratedAt: new Date() };
    await order.save();

    // Rate the business (rating feeds into business's public rating)
    await addRating(order.business, stars);

    res.json({ message: "Rating submitted", order });
});

// @desc    Get orders for the logged-in user (either side)
// @route   GET /api/orders/mine
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({
        $or: [{ business: req.user._id }, { counterparty: req.user._id }],
    }).sort({ createdAt: -1 });

    res.json(orders);
});

module.exports = {
    createOrder,
    assignCourier,
    confirmPickup,
    validatePickupCode,
    confirmDelivery,
    rateOrder,
    getMyOrders,
};