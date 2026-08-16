const asyncHandler = require("../utils/asyncHandler");
const Listing = require("../models/listingModel");
const Reservation = require("../models/reservationModel");
const { notifyUser } = require("../sockets/socketHandler");

const HOLD_TIMEOUT_MINUTES = 15;

// @desc    Reserve a quantity from a listing (places an immediate hold)
// @route   POST /api/reservations
// @access  Private/Consumer,NGO
const createReservation = asyncHandler(async (req, res) => {
    const { listingId, quantity } = req.body;

    if (!listingId || !quantity || quantity <= 0) {
        res.status(400);
        throw new Error("listingId and a valid quantity are required");
    }

    // FR-11: atomic decrement to prevent two consumers reserving the same stock
    const listing = await Listing.findOneAndUpdate(
        {
            _id: listingId,
            quantityRemaining: { $gte: quantity },
            status: "live",
        },
        { $inc: { quantityRemaining: -quantity } },
        { new: true }
    );

    if (!listing) {
        res.status(409);
        throw new Error(
            "Unable to reserve - insufficient stock or listing no longer available"
        );
    }

    const reservation = await Reservation.create({
        listing: listing._id,
        reservedBy: req.user._id,
        reserverRole: req.user.role,
        quantityReserved: quantity,
        status: "pending_payment",
        holdExpiresAt: new Date(Date.now() + HOLD_TIMEOUT_MINUTES * 60 * 1000),
    });

    const io = req.app.get("io");
    notifyUser(io, listing.business, "listingReserved", {
        listingId: listing._id,
        reservationId: reservation._id,
    });

    res.status(201).json(reservation);
});

// @desc    Confirm payment for a reservation
// @route   PUT /api/reservations/:id/pay
// @access  Private
const confirmPayment = asyncHandler(async (req, res) => {
    const { paymentAmount } = req.body;

    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
        res.status(404);
        throw new Error("Reservation not found");
    }

    if (reservation.reservedBy.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized to pay for this reservation");
    }

    if (reservation.status !== "pending_payment") {
        res.status(400);
        throw new Error(`Cannot pay - reservation status is '${reservation.status}'`);
    }

    if (new Date() > reservation.holdExpiresAt) {
        res.status(410);
        throw new Error("This hold has expired");
    }

    reservation.isPaid = true;
    reservation.paymentAmount = paymentAmount;
    reservation.status = "confirmed";
    await reservation.save();

    const listing = await Listing.findById(reservation.listing);
    listing.status = "reserved";
    await listing.save();

    res.json(reservation);
});

// @desc    Manually release a reservation (early cancellation - FR-17)
// @route   PUT /api/reservations/:id/release
// @access  Private
const releaseReservation = asyncHandler(async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
        res.status(404);
        throw new Error("Reservation not found");
    }

    if (reservation.reservedBy.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized to release this reservation");
    }

    reservation.status = "released";
    await reservation.save();

    // FR-17: return the quantity to the listing and re-list it
    await Listing.findByIdAndUpdate(reservation.listing, {
        $inc: { quantityRemaining: reservation.quantityReserved },
        status: "live",
    });

    res.json({ message: "Reservation released, item re-listed" });
});

module.exports = { createReservation, confirmPayment, releaseReservation };