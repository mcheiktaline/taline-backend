const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/userModel");

// @desc    Update own profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;

    if (user.role === "business") {
        user.businessName = req.body.businessName || user.businessName;
    }
    if (user.role === "ngo") {
        user.ngoName = req.body.ngoName || user.ngoName;
    }

    if (req.body.password) {
        user.password = req.body.password; // pre-save hook re-hashes it
    }

    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
    });
});

// @desc    Update own location (used for radius search)
// @route   PUT /api/users/location
// @access  Private
const updateLocation = asyncHandler(async (req, res) => {
    const { longitude, latitude, address } = req.body;

    if (longitude === undefined || latitude === undefined) {
        res.status(400);
        throw new Error("Longitude and latitude are required");
    }

    const user = await User.findById(req.user._id);
    user.location = {
        type: "Point",
        coordinates: [longitude, latitude],
        address: address || user.location.address,
    };

    await user.save();

    res.json({ location: user.location });
});

// @desc    Get all unverified Business/NGO accounts (for Admin review)
// @route   GET /api/users/unverified
// @access  Private/Admin
const getUnverifiedUsers = asyncHandler(async (req, res) => {
    const users = await User.find({
        role: { $in: ["business", "ngo"] },
        isVerified: false,
    }).select("-password");

    res.json(users);
});

// @desc    Verify a Business or NGO account
// @route   PUT /api/users/:id/verify
// @access  Private/Admin
const verifyUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    user.isVerified = true;
    await user.save();

    res.json({ message: `${user.name} has been verified`, isVerified: true });
});

// @desc    Deactivate a user account (moderation)
// @route   PUT /api/users/:id/deactivate
// @access  Private/Admin
const deactivateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    user.isActive = false;
    await user.save();

    res.json({ message: `${user.name} has been deactivated` });
});

module.exports = {
    updateProfile,
    updateLocation,
    getUnverifiedUsers,
    verifyUser,
    deactivateUser,
};