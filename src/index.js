import dotenv from "dotenv";
import dbConnect from "./db/index.js";
import { app } from "./app.js";

//configuring .env variables
dotenv.config({ path: "./.env" });


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
