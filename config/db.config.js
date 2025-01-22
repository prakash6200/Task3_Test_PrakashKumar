const config = require("./config");
const mongoose = require("mongoose");

const connectDb = mongoose.connect(config.DATABASE)
                    .then(()=>console.log("Database connection successful."))
                    .catch(()=>console.log("Connection to Database failed."))

const database = mongoose.connection;

database.on("error", console.error.bind(console, "MongoDB connection error"));

module.exports = connectDb;
