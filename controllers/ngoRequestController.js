const asyncHandler = require("../utils/asyncHandler");
const NgoRequest = require("../models/ngoRequestModel");
const Listing = require("../models/listingModel");
const { getFulfillmentWindowMinutes } = require("../services/urgencyService");
const { notifyUser } = require("../sockets/socketHandler");

// @desc    NGO submits a standing food request
// @route   POST /api/ngo-requests
// @access  Private/NGO
const createNgoRequest = asyncHandler(async (req, res) => {
    const { foodType, quantity, neededByDate, notes } = req.body;

    const request = await NgoRequest.create({
        ngo: req.user._id,
        foodType,
        quantity,
        neededByDate,
        notes,
        status: "open",
    });

    res.status(201).json(request);
});

// @desc    Get all open requests for the logged-in NGO
// @route   GET /api/ngo-requests/mine
// @access  Private/NGO
const getMyRequests = asyncHandler(async (req, res) => {
    const requests = await NgoRequest.find({ ngo: req.user._id }).sort({
        createdAt: -1,
    });
    res.json(requests);
});

// @desc    Get broadcast donation listings visible to this NGO
// @route   GET /api/ngo-requests/broadcast-feed
// @access  Private/NGO
const getBroadcastFeed = asyncHandler(async (req, res) => {
    const listings = await Listing.find({
        listingType: "donate",
        status: "live",
        quantityRemaining: { $gt: 0 },
    })
        .populate("business", "businessName")
        .sort({ urgencyTier: 1, createdAt: -1 });

    res.json(listings);
});

// @desc    NGO accepts a donation match (first to accept wins - FR-07)
// @route   PUT /api/ngo-requests/accept/:listingId
// @access  Private/NGO
const acceptDonationMatch = asyncHandler(async (req, res) => {
    const { logisticsChoice } = req.body; // "ngo_van" or "courier"

    // Atomic: only succeeds if the listing is still live (first NGO to accept wins)
    const listing = await Listing.findOneAndUpdate(
        { _id: req.params.listingId, status: "live", listingType: "donate" },
        { status: "matched" },
        { new: true }
    );

    if (!listing) {
        res.status(409);
        throw new Error("This donation is no longer available - already matched");
    }

    const windowMinutes = getFulfillmentWindowMinutes(listing.urgencyTier);

    listing.fulfillmentType =
        logisticsChoice === "courier" ? "courier" : "self_pickup";
    await listing.save();

    const io = req.app.get("io");
    // FR-07: Business is notified of the confirmed match in real time
    notifyUser(io, listing.business, "donationMatched", {
        listingId: listing._id,
        ngoId: req.user._id,
        windowMinutes,
    });

    res.json({ message: "Match accepted", listing });
});

module.exports = {
    createNgoRequest,
    getMyRequests,
    getBroadcastFeed,
    acceptDonationMatch,
};