// Keeps track of which socket belongs to which user (for targeted notifications)
const userSocketMap = new Map();

const initSocket = (io) => {
    io.on("connection", (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Client sends their userId right after connecting
        socket.on("registerUser", (userId) => {
            userSocketMap.set(userId, socket.id);
            socket.join(userId); // room named after the userId, for easy targeting
            console.log(`👤 User ${userId} registered on socket ${socket.id}`);
        });

        socket.on("disconnect", () => {
            for (const [userId, socketId] of userSocketMap.entries()) {
                if (socketId === socket.id) {
                    userSocketMap.delete(userId);
                    break;
                }
            }
            console.log(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
};

// Helper: send an event to one specific user (e.g. "your listing was matched")
const notifyUser = (io, userId, event, data) => {
    io.to(userId.toString()).emit(event, data);
};

// Helper: broadcast an event to everyone (e.g. urgency tier changes on public feed)
const notifyAll = (io, event, data) => {
    io.emit(event, data);
};

module.exports = { initSocket, notifyUser, notifyAll };