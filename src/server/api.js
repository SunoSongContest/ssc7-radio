const express = require("express");
const path = require("path");
const { google } = require("googleapis");
const router = express.Router();

require("dotenv").config();

const googleAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

router.get("/data", async (req, res) => {
  try {
    const client = await googleAuth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Accepted!A2:H389",
    });

    const data = [];

    sheetData.data.values.forEach((sD) => {
      const d = {};

      d.song_title = sD[3];
      d.suno_username = sD[4];
      d.song_url = sD[5];
      d.song_country = sD[7];

      data.push(d);
    });

    res.status(200).json(data);
  } catch (err) {
    console.error("Unexpected error while fetching data:", err);
    res
      .status(500)
      .json({ error: "Unexpected error occurred while fetching data." });
  }
});

module.exports = router;
