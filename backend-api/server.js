const express = require("express");
const cors = require('cors');

// Add these back
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Only add webhook for now
app.use("/webhook", webhookRoutes);

app.get("/", (req, res) => {
  res.json({
      status: "success",
      message: "11za Backend - Webhook Only Test Running ✅",
      endpoints: ["/webhook"]
  });
});

module.exports = app;