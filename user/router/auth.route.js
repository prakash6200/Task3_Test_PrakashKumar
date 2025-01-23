const express = require("express");
const router = express.Router();

const authController = require("../controller/auth.controller");
const authValidator = require("../validator/auth.validator");

const { verifyJWTToken } = require("../../middleware/jwt.middleware");
const limiteRewuest = require("../../middleware/limited.request.middleware");

router.post("/register", authValidator.signUp, limiteRewuest, authController.signUp);
router.post("/login", authValidator.login, limiteRewuest, authController.login);
router.post("/send/otp", authValidator.sendOtp, limiteRewuest, authController.sendOtp);
router.patch("/verify/otp", authValidator.verifyOtp, limiteRewuest, authController.verifyOtp);

// for admin
router.get("/user/list", verifyJWTToken, limiteRewuest, authController.checkUserList);

module.exports = router;