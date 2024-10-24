import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const dbConnect = async () => {
  try {
    //Connecting to mognodb atlas with uri string
    const db = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`\nMONGODB is connected to ${db.connection.host}`);
    // console.log("db",db)
    
  } catch (err) {
    console.log("Error: ", err);
    process.exit(1);
  }
}

export default dbConnect;