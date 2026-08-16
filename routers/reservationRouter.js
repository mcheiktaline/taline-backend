const express = require("express");
const router = express.Router();
const {
    createReservation,
    confirmPayment,
    releaseReservation,
} = require("../controllers/reservationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/", protect, authorizeRoles("consumer", "ngo"), createReservation);
router.put("/:id/pay", protect, confirmPayment);
router.put("/:id/release", protect, releaseReservation);

module.exports = router;