const asyncHandler = require("../utils/asyncHandler");
const Listing = require("../models/listingModel");
const Order = require("../models/orderModel");
const Dispute = require("../models/disputeModel");
const User = require("../models/userModel");

// @desc    Admin Ops Control Panel overview stats
// @route   GET /api/analytics/admin-overview
// @access  Private/Admin
const getAdminOverview = asyncHandler(async (req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
        newUnmatched,
        activeDeliveries,
        closedToday,
        totalOrdersToday,
        matchedOrdersCount,
        openExceptions,
    ] = await Promise.all([
        Listing.countDocuments({ status: "live" }),
        Order.countDocuments({
            status: { $in: ["awaiting_pickup", "courier_assigned", "picked_up"] },
        }),
        Order.countDocuments({ status: "closed", closedAt: { $gte: startOfToday } }),
        Order.countDocuments({ createdAt: { $gte: startOfToday } }),
        Order.countDocuments({
            createdAt: { $gte: startOfToday },
            fulfillmentType: { $exists: true },
        }),
        Dispute.countDocuments({ status: { $ne: "resolved" } }),
    ]);

    const autoMatchedPercent =
        totalOrdersToday > 0
            ? Math.round((matchedOrdersCount / totalOrdersToday) * 100)
            : 0;

    res.json({
        newUnmatched,
        activeDeliveries,
        closedToday,
        autoMatchedPercent,
        openExceptions,
    });
});

// @desc    Live map data - active listings and couriers with locations
// @route   GET /api/analytics/live-map
// @access  Private/Admin
const getLiveMapData = asyncHandler(async (req, res) => {
    const listings = await Listing.find({
        status: { $in: ["live", "matched"] },
    })
        .select("itemName urgencyTier location status")
        .populate("business", "businessName");

    const activeCouriers = await User.find({
        role: "courier",
        isActive: true,
    }).select("name location");

    res.json({ listings, activeCouriers });
});

// @desc    Platform-wide impact stats (shown on landing page)
// @route   GET /api/analytics/platform-stats
// @access  Public
const getPlatformStats = asyncHandler(async (req, res) => {
    const [totalKgResult, partnerBusinesses, closedOrders] = await Promise.all([
        Listing.aggregate([
            { $match: { status: { $in: ["completed", "matched", "reserved"] } } },
            { $group: { _id: null, totalKg: { $sum: "$quantity" } } },
        ]),
        User.countDocuments({ role: "business", isVerified: true }),
        Order.find({ status: "closed" }).select("createdAt closedAt"),
    ]);

    const foodDiverted = totalKgResult[0]?.totalKg || 0;

    let avgMatchMinutes = 0;
    if (closedOrders.length > 0) {
        const totalMinutes = closedOrders.reduce((sum, o) => {
            return sum + (o.closedAt - o.createdAt) / (1000 * 60);
        }, 0);
        avgMatchMinutes = Math.round(totalMinutes / closedOrders.length);
    }

    res.json({
        foodDivertedKg: foodDiverted,
        partnerBusinesses,
        avgMatchMinutes,
    });
});

module.exports = { getAdminOverview, getLiveMapData, getPlatformStats };