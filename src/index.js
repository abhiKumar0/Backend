import dotenv from 'dotenv';
import dbConnect from "./db/index.js";
import express from "express";

dotenv.config({path: "./.env"});

const app = express();

//if connected to MongoDB successfully then start the server or else deal with errors
dbConnect().then(() => {
  app.listen(process.env.PORT, () => console.log('listening on port ' + process.env.PORT))
}).catch((err) => {
  console.log("Error: " + err);
});
