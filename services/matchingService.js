const NgoRequest = require("../models/ngoRequestModel");
const User = require("../models/userModel");

const MAX_DISTANCE_METERS = 15000; // configurable radius (15km)

// FR-04: Targeted matching - checks open NGO requests that match
// this listing's food type and quantity, closest first
const findTargetedMatch = async (listing) => {
    const matchingRequests = await NgoRequest.find({
        status: "open",
        $or: [{ foodType: listing.category }, { foodType: "any" }],
        quantity: { $lte: listing.quantityRemaining },
        neededByDate: { $gte: new Date() },
    })
        .populate("ngo")
        .sort({ createdAt: 1 }); // first-come-first-served among matches

    if (matchingRequests.length === 0) {
        return null;
    }

    // Prefer the request from the NGO closest to the listing, if location is set
    if (
        listing.location &&
        listing.location.coordinates &&
        listing.location.coordinates[0] !== 0
    ) {
        const nearbyNgos = await User.find({
            role: "ngo",
            isVerified: true,
            location: {
                $near: {
                    $geometry: listing.location,
                    $maxDistance: MAX_DISTANCE_METERS,
                },
            },
        }).select("_id");

        const nearbyNgoIds = nearbyNgos.map((u) => u._id.toString());
        const nearMatch = matchingRequests.find((r) =>
            nearbyNgoIds.includes(r.ngo._id.toString())
        );

        if (nearMatch) return nearMatch;
    }

    return matchingRequests[0];
};

// FR-06: Broadcast to all verified NGOs within radius when no targeted match exists
const findBroadcastRecipients = async (listing) => {
    if (
        !listing.location ||
        !listing.location.coordinates ||
        listing.location.coordinates[0] === 0
    ) {
        // No location set - fall back to all verified NGOs
        return await User.find({ role: "ngo", isVerified: true });
    }

    return await User.find({
        role: "ngo",
        isVerified: true,
        location: {
            $near: {
                $geometry: listing.location,
                $maxDistance: MAX_DISTANCE_METERS,
            },
        },
    });
};

// FR-04: main entry point - tries targeted first, falls back to broadcast list
const matchDonationListing = async (listing) => {
    const targetedMatch = await findTargetedMatch(listing);

    if (targetedMatch) {
        return { mode: "targeted", request: targetedMatch, recipients: null };
    }

    const recipients = await findBroadcastRecipients(listing);
    return { mode: "broadcast", request: null, recipients };
};

module.exports = {
    findTargetedMatch,
    findBroadcastRecipients,
    matchDonationListing,
};