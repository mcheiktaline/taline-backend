const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const User = require("../models/userModel");

// @desc    Register a new user (any role)
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role, phone, businessName, ngoName } =
        req.body;

    if (!name || !email || !password || !role) {
        res.status(400);
        throw new Error("Name, email, password, and role are required");
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error("A user with this email already exists");
    }

    // Business and NGO accounts require Admin verification before going live
    const needsVerification = role === "business" || role === "ngo";

    const user = await User.create({
        name,
        email,
        password,
        role,
        phone,
        businessName: role === "business" ? businessName : undefined,
        ngoName: role === "ngo" ? ngoName : undefined,
        isVerified: !needsVerification,
    });

    res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        token: generateToken(user._id),
    });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error("Email and password are required");
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
        res.status(401);
        throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
        res.status(403);
        throw new Error("This account has been deactivated");
    }

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        token: generateToken(user._id),
    });
});

// @desc    Get currently logged-in user's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    res.json(req.user);
});

module.exports = { registerUser, loginUser, getMe };