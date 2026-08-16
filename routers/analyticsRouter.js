const express = require("express");
const router = express.Router();
const {
    getAdminOverview,
    getLiveMapData,
    getPlatformStats,
} = require("../controllers/analyticsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/platform-stats", getPlatformStats); // Public - shown on landing page

router.get("/admin-overview", protect, authorizeRoles("admin"), getAdminOverview);
router.get("/live-map", protect, authorizeRoles("admin"), getLiveMapData);

module.exports = router;