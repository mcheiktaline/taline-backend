const asyncHandler = require("../utils/asyncHandler");
const Listing = require("../models/listingModel");
const {
    calculateUrgencyTier,
    getDiscountRange,
} = require("../services/urgencyService");
const { matchDonationListing } = require("../services/matchingService");
const { notifyUser, notifyAll } = require("../sockets/socketHandler");

// @desc    Create a new listing
// @route   POST /api/listings
// @access  Private/Business
const createListing = asyncHandler(async (req, res) => {
    const { itemName, category, quantity, expiryDate, photo, address } =
        req.body;

    // FR-01: system rejects blank fields / past expiry (also checked by validateMiddleware)
    const listing = await Listing.create({
        business: req.user._id,
        itemName,
        category,
        quantity,
        quantityRemaining: quantity,
        expiryDate,
        photo,
        status: "pending_classification",
        location: {
            type: "Point",
            coordinates: req.user.location?.coordinates || [0, 0],
            address: address || req.user.location?.address,
        },
    });

    // FR-02: tag urgency immediately on creation
    listing.urgencyTier = calculateUrgencyTier(listing.expiryDate);
    await listing.save();

    res.status(201).json(listing);
});

// @desc    Choose Donate or Sell for a listing
// @route   PUT /api/listings/:id/decision
// @access  Private/Business
const setDonateOrSell = asyncHandler(async (req, res) => {
    const { listingType, originalPrice } = req.body;

    if (!["donate", "sell"].includes(listingType)) {
        res.status(400);
        throw new Error("listingType must be either 'donate' or 'sell'");
    }

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
        res.status(404);
        throw new Error("Listing not found");
    }

    if (listing.business.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized to modify this listing");
    }

    // FR-03: choice locks once a consumer/NGO has committed
    if (listing.isTypeLocked) {
        res.status(400);
        throw new Error("This listing's type is locked and cannot be changed");
    }

    listing.listingType = listingType;

    if (listingType === "sell") {
        if (!originalPrice) {
            res.status(400);
            throw new Error("originalPrice is required when selling");
        }
        const { min } = getDiscountRange(listing.urgencyTier);
        listing.originalPrice = originalPrice;
        listing.discountPercent = min;
        listing.discountedPrice = Number(
            (originalPrice * (1 - min / 100)).toFixed(2)
        );
    }

    listing.status = "live";
    await listing.save();

    // FR-04: if donate, trigger matching flow immediately
    if (listingType === "donate") {
        const matchResult = await matchDonationListing(listing);
        const io = req.app.get("io");

        if (matchResult.mode === "targeted") {
            notifyUser(io, matchResult.request.ngo._id, "donationOffer", {
                listingId: listing._id,
            });
        } else {
            matchResult.recipients.forEach((ngo) => {
                notifyUser(io, ngo._id, "donationBroadcast", {
                    listingId: listing._id,
                });
            });
        }
    } else {
        const io = req.app.get("io");
        notifyAll(io, "newMarketplaceListing", { listingId: listing._id });
    }

    res.json(listing);
});

// @desc    Get marketplace feed (sell-routed, nearby, sorted by urgency then proximity)
// @route   GET /api/listings/marketplace
// @access  Public
const getMarketplaceFeed = asyncHandler(async (req, res) => {
    const { longitude, latitude, radius = 10000 } = req.query;

    const query = {
        listingType: "sell",
        status: "live",
        quantityRemaining: { $gt: 0 },
    };

    let listings;

    if (longitude && latitude) {
        listings = await Listing.find({
            ...query,
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [Number(longitude), Number(latitude)],
                    },
                    $maxDistance: Number(radius),
                },
            },
        }).populate("business", "businessName averageRating");
    } else {
        listings = await Listing.find(query).populate(
            "business",
            "businessName averageRating"
        );
    }

    // FR-09: default sort by urgency, then proximity ($near already sorts by proximity)
    const urgencyOrder = { critical: 0, priority: 1, normal: 2 };
    listings.sort((a, b) => urgencyOrder[a.urgencyTier] - urgencyOrder[b.urgencyTier]);

    res.json(listings);
});

// @desc    Get a single listing by ID
// @route   GET /api/listings/:id
// @access  Public
const getListingById = asyncHandler(async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate(
        "business",
        "businessName averageRating phone"
    );

    if (!listing) {
        res.status(404);
        throw new Error("Listing not found");
    }

    res.json(listing);
});

// @desc    Get all listings created by the logged-in business
// @route   GET /api/listings/mine
// @access  Private/Business
const getMyListings = asyncHandler(async (req, res) => {
    const listings = await Listing.find({ business: req.user._id }).sort({
        createdAt: -1,
    });
    res.json(listings);
});

// @desc    Close/cancel a listing early
// @route   PUT /api/listings/:id/close
// @access  Private/Business
const closeListing = asyncHandler(async (req, res) => {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
        res.status(404);
        throw new Error("Listing not found");
    }

    if (listing.business.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Not authorized to modify this listing");
    }

    listing.status = "cancelled";
    await listing.save();

    res.json({ message: "Listing closed", listing });
});

// @desc    Business analytics dashboard
// @route   GET /api/listings/analytics
// @access  Private/Business
const getBusinessAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate, path } = req.query;

    const match = { business: req.user._id };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (path && ["donate", "sell"].includes(path)) {
        match.listingType = path;
    }

    const listings = await Listing.find(match);

    const sold = listings.filter((l) => l.listingType === "sell").length;
    const donated = listings.filter((l) => l.listingType === "donate").length;
    const totalKg = listings.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const revenue = listings
        .filter((l) => l.listingType === "sell")
        .reduce((sum, l) => sum + (l.discountedPrice || 0) * (l.quantity - l.quantityRemaining), 0);

    res.json({
        listingsSold: sold,
        listingsDonated: donated,
        kilogramsdiverted: totalKg,
        revenue,
    });
});

module.exports = {
    createListing,
    setDonateOrSell,
    getMarketplaceFeed,
    getListingById,
    getMyListings,
    closeListing,
    getBusinessAnalytics,
};