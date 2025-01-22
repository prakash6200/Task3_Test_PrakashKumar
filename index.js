require("./config/db.config");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const cron = require("node-cron");
const express = require("express");
const router = require("./router");
const config = require("./config/config");

const app = express();
const http = require("http");
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan("combined"));
app.use("/", router);

app.use((request, response) => {
    response.type("text/plain");
    response.status(404);
    response.send({ success: true, message: "Server Working. But Api Not Found." }); 
});

server.listen(config.PORT, () => {
    console.log(`App running on http://localhost:${config.PORT}`);
});