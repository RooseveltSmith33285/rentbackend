// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Create base uploads directory and subdirectories
// const createUploadDirs = () => {
//   const dirs = [
//     'uploads/',
//     'uploads/products/',
//     'uploads/profiles/',
//     'uploads/temp/'
//   ];
  
//   dirs.forEach(dir => {
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }
//   });
// };

// // Initialize directories
// createUploadDirs();

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     // You can customize destination based on the route or file type
//     let uploadPath = 'uploads/';
    
//     // Example: different folders for different purposes
//     if (req.route.path.includes('product')) {
//       uploadPath = 'uploads/products/';
//     } else if (req.route.path.includes('profile')) {
//       uploadPath = 'uploads/profiles/';
//     }
    
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     // More descriptive filename with timestamp
//     const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const fileName = file.fieldname + '-' + uniqueName + path.extname(file.originalname);
//     cb(null, fileName); 
//   }
// });

// const fileFilter = (req, file, cb) => {
//   // Allow images
//   if (file.mimetype.startsWith('image/')) {
//     cb(null, true);
//   } else {
//     cb(new Error('Only images are allowed! Please upload JPG, PNG, or GIF files.'), false);
//   }
// };

// // Configure multer with error handling
// const upload = multer({ 
//   storage, 
//   fileFilter,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB limit
//     files: 5 // Maximum 5 files at once
//   }
// });

// module.exports = upload;




const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Base path for all uploads
const BASE_UPLOAD_PATH = '/tmp/public/files/images';

// Create base uploads directory and subdirectories
const createUploadDirs = () => {
  const dirs = [
    BASE_UPLOAD_PATH,
    path.join(BASE_UPLOAD_PATH, 'products'),
    path.join(BASE_UPLOAD_PATH, 'profiles'),
    path.join(BASE_UPLOAD_PATH, 'temp')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Initialize directories
createUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Default to base images path
    let uploadPath = BASE_UPLOAD_PATH;
    
    // Example: different folders for different purposes
    if (req.route.path.includes('product')) {
      uploadPath = path.join(BASE_UPLOAD_PATH, 'products');
    } else if (req.route.path.includes('profile')) {
      uploadPath = path.join(BASE_UPLOAD_PATH, 'profiles');
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // More descriptive filename with timestamp
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = file.fieldname + '-' + uniqueName + path.extname(file.originalname);
    cb(null, fileName); 
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed! Please upload JPG, PNG, or GIF files.'), false);
  }
};

// Configure multer with error handling
const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 9 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files at once
  }
});

module.exports = upload;