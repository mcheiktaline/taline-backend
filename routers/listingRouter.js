const express = require("express");
const router = express.Router();
const {
    createListing,
    setDonateOrSell,
    getMarketplaceFeed,
    getListingById,
    getMyListings,
    closeListing,
    getBusinessAnalytics,
} = require("../controllers/listingController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { validateListing } = require("../middleware/validateMiddleware");

// Public
router.get("/marketplace", getMarketplaceFeed);
router.get("/:id", getListingById);

// Private/Business
router.post("/", protect, authorizeRoles("business"), validateListing, createListing);
router.put("/:id/decision", protect, authorizeRoles("business"), setDonateOrSell);
router.get("/mine/list", protect, authorizeRoles("business"), getMyListings);
router.put("/:id/close", protect, authorizeRoles("business"), closeListing);
router.get("/analytics/dashboard", protect, authorizeRoles("business"), getBusinessAnalytics);

module.exports = router;