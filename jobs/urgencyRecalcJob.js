const cron = require("node-cron");
const {
    recalculateAllListingsUrgency,
} = require("../services/urgencyService");

// Runs every 15 minutes: "*/15 * * * *"
const startUrgencyRecalcJob = (io) => {
    cron.schedule("*/15 * * * *", async () => {
        try {
            const changedListings = await recalculateAllListingsUrgency();

            if (changedListings.length > 0) {
                console.log(
                    `⏱️  Urgency recalculated: ${changedListings.length} listing(s) changed tier`
                );

                // Push real-time update to affected listings (Non-Functional: seconds-level updates)
                changedListings.forEach((listing) => {
                    io.emit("urgencyTierChanged", {
                        listingId: listing._id,
                        newTier: listing.urgencyTier,
                    });
                });
            }
        } catch (error) {
            console.error("❌ Error in urgency recalculation job:", error.message);
        }
    });

    console.log("🕐 Urgency recalculation job scheduled (every 15 minutes)");
};

module.exports = { startUrgencyRecalcJob };