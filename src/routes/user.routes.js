import { Router } from "express";

import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();


//Using middleware
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1
    },
    {
      name: "coverImage",
      maxCount: 1
    }
  ]),
   registerUser);
router.route("/loginUser").post(loginUser);



//secured routes
router.route("/logoutUser").post(verifyJWT, logoutUser)



export default router