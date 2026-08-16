const express = require("express");
const router = express.Router();
const {
    createNgoRequest,
    getMyRequests,
    getBroadcastFeed,
    acceptDonationMatch,
} = require("../controllers/ngoRequestController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { validateNgoRequest } = require("../middleware/validateMiddleware");

router.post("/", protect, authorizeRoles("ngo"), validateNgoRequest, createNgoRequest);
router.get("/mine", protect, authorizeRoles("ngo"), getMyRequests);
router.get("/broadcast-feed", protect, authorizeRoles("ngo"), getBroadcastFeed);
router.put("/accept/:listingId", protect, authorizeRoles("ngo"), acceptDonationMatch);

module.exports = router;