const express = require("express");
const router = express.Router();
const {
    createOrder,
    assignCourier,
    confirmPickup,
    validatePickupCode,
    confirmDelivery,
    rateOrder,
    getMyOrders,
} = require("../controllers/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/", protect, createOrder);
router.get("/mine", protect, getMyOrders);
router.put("/:id/rate", protect, rateOrder);

router.put("/:id/assign-courier", protect, authorizeRoles("courier"), assignCourier);
router.put("/:id/confirm-pickup", protect, authorizeRoles("courier"), confirmPickup);
router.put("/:id/confirm-delivery", protect, authorizeRoles("courier"), confirmDelivery);

router.put("/:id/validate-code", protect, authorizeRoles("business"), validatePickupCode);

module.exports = router;