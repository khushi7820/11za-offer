const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({
      status: "success",
      message: "11za Backend Minimal Test Running ✅",
      time: new Date().toISOString()
  });
});

app.get("/test", (req, res) => {
    res.send("Backend is reachable!");
});

module.exports = app;