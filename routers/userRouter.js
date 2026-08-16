const express = require("express");
const router = express.Router();
const {
    updateProfile,
    updateLocation,
    getUnverifiedUsers,
    verifyUser,
    deactivateUser,
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.put("/profile", protect, updateProfile);
router.put("/location", protect, updateLocation);

router.get("/unverified", protect, authorizeRoles("admin"), getUnverifiedUsers);
router.put("/:id/verify", protect, authorizeRoles("admin"), verifyUser);
router.put("/:id/deactivate", protect, authorizeRoles("admin"), deactivateUser);

module.exports = router;