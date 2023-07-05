const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const session = require("express-session");
const formatMessage = require("./utils/messages");

const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const { env } = require("process");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Connect to MongoDB
mongoose
  .connect("mongodb+srv://mayurdhvajsinhjadeja:Mbj%401833@chatapp.sn0jnx1.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Set up session middleware
app.use(
  session({
    secret: "Thisismysecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const botName = "Bot";

// Run when client connects
io.on("connection", (socket) => {
  // console.log(io.of("/").adapter);

  // Get username and room from session
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    socket.emit("message", formatMessage(botName, "Welcome to Baatein!"));

    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// Login route
app.get("/", (req, res) => {
  const options = {
    root: path.join(__dirname, "public"),
  };
  res.sendFile("login.html", options);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user exists in the database
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid password");
    }
      // Store username and room in session
      req.session.username = username;
      // Handle successful login
      res.redirect("/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Register route
app.get("/register", (req, res) => {
  const options = {
    root: path.join(__dirname, "public"),
  };
  res.sendFile("register.html", options);
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user already exists in the database
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).send("Username already exists");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      username,
      password: hashedPassword,
    });

    // Save the user to the database
    await user.save();

    // Handle successful registration
    res.redirect("/"); // Redirect to the login page after registration

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Chat route
app.get("/home", (req, res) => {
  // Check if username and room are set in the session
  if (!req.session.username) {
    return res.redirect("/");
  }

  const options = {
    root: path.join(__dirname, "public"),
  };
  res.sendFile("home.html", options);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
