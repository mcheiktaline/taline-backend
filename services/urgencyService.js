const Listing = require("../models/listingModel");

// FR-02: Urgency Auto-Classification
// Normal: 24h+ away | Priority: 6-24h away | Critical: <6h away
const calculateUrgencyTier = (expiryDate) => {
    const now = new Date();
    const hoursRemaining = (new Date(expiryDate) - now) / (1000 * 60 * 60);

    if (hoursRemaining < 6) {
        return "critical";
    } else if (hoursRemaining <= 24) {
        return "priority";
    } else {
        return "normal";
    }
};

// FR-10: Urgency-Driven Promotion - discount range per tier
const getDiscountRange = (urgencyTier) => {
    switch (urgencyTier) {
        case "critical":
            return { min: 60, max: 70 };
        case "priority":
            return { min: 40, max: 50 };
        case "normal":
        default:
            return { min: 20, max: 30 };
    }
};

// FR-10: whether courier/express delivery is auto-enabled for this tier
const isCourierMandatory = (urgencyTier) => {
    return urgencyTier === "critical";
};

// FR-08: tighter pickup/delivery windows for more urgent tiers (in minutes)
const getFulfillmentWindowMinutes = (urgencyTier) => {
    switch (urgencyTier) {
        case "critical":
            return 40;
        case "priority":
            return 120;
        case "normal":
        default:
            return 240;
    }
};

// Recalculates and persists the urgency tier for a single listing.
// Returns true if the tier changed (useful for triggering notifications).
const recalculateListingUrgency = async (listing) => {
    const newTier = calculateUrgencyTier(listing.expiryDate);
    const tierChanged = newTier !== listing.urgencyTier;

    if (tierChanged) {
        listing.urgencyTier = newTier;
        await listing.save();
    }

    return tierChanged;
};

// FR-02: rolling recalculation for ALL live listings (used by the cron job)
const recalculateAllListingsUrgency = async () => {
    const listings = await Listing.find({
        status: { $in: ["live", "matched"] },
    });

    const changedListings = [];

    for (const listing of listings) {
        const tierChanged = await recalculateListingUrgency(listing);
        if (tierChanged) {
            changedListings.push(listing);
        }
    }

    return changedListings;
};

module.exports = {
    calculateUrgencyTier,
    getDiscountRange,
    isCourierMandatory,
    getFulfillmentWindowMinutes,
    recalculateListingUrgency,
    recalculateAllListingsUrgency,
};