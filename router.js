"use strict";
const express = require("express");
const router = express.Router();

const userRouter = require("./user/router/router");

// router.use("/admin", adminRouter);
router.use("/user", userRouter);

module.exports = router;
