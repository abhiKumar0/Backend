import dotenv from "dotenv";
import dbConnect from "./db/index.js";
import express from "express";

//configuring .env variables
dotenv.config({ path: "./.env" });

const app = express();

//if connected to MongoDB successfully then start the server or else deal with errors
dbConnect()
  .then(() => {
    app.listen(process.env.PORT || 8000, () =>
      console.log("listening on port " + process.env.PORT)
    );
  })
  .catch((err) => {
    console.log("SERVER CONNECTION FAILED: " + err);
  });
