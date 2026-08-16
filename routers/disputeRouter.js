const express = require("express");
const router = express.Router();
const {
    raiseDispute,
    markNoShow,
    getExceptionQueue,
    resolveDispute,
} = require("../controllers/disputeController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/", protect, raiseDispute);

router.get("/", protect, authorizeRoles("admin"), getExceptionQueue);
router.put("/no-show/:orderId", protect, authorizeRoles("admin"), markNoShow);
router.put("/:id/resolve", protect, authorizeRoles("admin"), resolveDispute);

module.exports = router;