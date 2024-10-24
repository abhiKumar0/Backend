import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

//initializing cors 
app.use(cors({
  origin: process.env.CORS_ORIGIN, // specify the domain you want to allow to access your API
  credentials: true, // enable sending cookies
}));

// parse request body as JSON and limit the size to 16KB
app.use(express.json({limit: "16kb"}));

// manages url parameters like "how to learn javascript" to "how%20to%20learn%20javascript"
app.use(express.urlencoded({extended: true}));

// serve static files from the "public" folder
app.use(express.static(path.join(__dirname || "public")));


app.use(cookieParser());