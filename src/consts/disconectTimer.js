require("dotenv").config();

const disconectTimeMS =
  (Number.parseInt(process.env.IDLE_TIMEOUT_SEC, 10) || 300) * 1000;

module.exports = disconectTimeMS;
