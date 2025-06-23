const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use("/api", require("./api"));

app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"))
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
