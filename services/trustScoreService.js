const User = require("../models/userModel");

const NO_SHOW_PENALTY = 15; // points deducted from trust score
const MIN_TRUST_SCORE = 0;
const MAX_TRUST_SCORE = 100;

// FR-18: applies a trust-score penalty to the responsible party after a no-show
const applyNoShowPenalty = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.trustScore = Math.max(
        MIN_TRUST_SCORE,
        user.trustScore - NO_SHOW_PENALTY
    );
    await user.save();

    return user.trustScore;
};

// FR-20: admin-issued manual trust-score adjustment (from a dispute resolution)
const applyManualAdjustment = async (userId, points) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.trustScore = Math.min(
        MAX_TRUST_SCORE,
        Math.max(MIN_TRUST_SCORE, user.trustScore + points)
    );
    await user.save();

    return user.trustScore;
};

// FR-14: records a new rating and updates the running average
const addRating = async (userId, stars) => {
    const user = await User.findById(userId);
    if (!user) return null;

    const totalPoints = user.averageRating * user.ratingCount + stars;
    user.ratingCount += 1;
    user.averageRating = totalPoints / user.ratingCount;

    await user.save();

    return { averageRating: user.averageRating, ratingCount: user.ratingCount };
};

module.exports = {
    applyNoShowPenalty,
    applyManualAdjustment,
    addRating,
};