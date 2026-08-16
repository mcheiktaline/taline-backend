const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const { initSocket } = require("./sockets/socketHandler");

// Routers
const authRouter = require("./routers/authRouter");
const userRouter = require("./routers/userRouter");
const listingRouter = require("./routers/listingRouter");
const reservationRouter = require("./routers/reservationRouter");
const orderRouter = require("./routers/orderRouter");
const ngoRequestRouter = require("./routers/ngoRequestRouter");
const disputeRouter = require("./routers/disputeRouter");
const analyticsRouter = require("./routers/analyticsRouter");

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/listings", listingRouter);
app.use("/api/reservations", reservationRouter);
app.use("/api/orders", orderRouter);
app.use("/api/ngo-requests", ngoRequestRouter);
app.use("/api/disputes", disputeRouter);
app.use("/api/analytics", analyticsRouter);

app.get("/", (req, res) => {
    res.send("Taline API is running...");
});

// Error handling (must be after routes)
app.use(notFound);
app.use(errorHandler);

// HTTP server + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
});
initSocket(io);
app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});