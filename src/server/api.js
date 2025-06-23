const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const router = express.Router();

require("dotenv").config();

router.get("/data", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "accepted_songs.json"));

    const jsonData = await fs.readFile(filePath, "utf8");
    
    const data = JSON.parse(jsonData);

    res.status(200).json(data);
  } catch (err) {
    console.error("Unexpected error while fetching data:", err);
    res
      .status(500)
      .json({ error: "Unexpected error occurred while fetching data." });
  }
});

module.exports = router;
