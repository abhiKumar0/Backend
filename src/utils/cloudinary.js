import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


  // Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});


async function uploadOnCloudinary(pathToFile){
  console.log("PathFile",pathToFile)
  try {
    if (!pathToFile) return null;
    const response = await cloudinary.uploader.upload(pathToFile, {
      resource_type: 'auto'
    });
    console.log('File uploaded successfully:', response.url);
    fs.unlinkSync(pathToFile)
    return response;
    
  } catch (error) {
    fs.unlinkSync(pathToFile); // remove the temporary file as the upload operation failed
    return null
  }

}

export {
  uploadOnCloudinary
}