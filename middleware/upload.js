const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create base uploads directory and subdirectories
const createUploadDirs = () => {
  // const dirs = [
  //   'uploads/',
  //   'uploads/products/',
  //   'uploads/profiles/',
  //   'uploads/temp/'
  // ];
  
  const dirs=[
    '/tmp/public/files/images'
  ]
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize directories
createUploadDirs();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    
    let uploadPath = 'uploads/';
    
 
    if (req.route.path.includes('product')) {
      uploadPath = 'uploads/products/';
    } else if (req.route.path.includes('profile')) {
      uploadPath = 'uploads/profiles/';
    }else{
      uploadPath = '/tmp/public/files/images';
   
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
   
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = file.fieldname + '-' + uniqueName + path.extname(file.originalname);
    cb(null, fileName); 
  }
});

const fileFilter = (req, file, cb) => {
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed! Please upload JPG, PNG, or GIF files.'), false);
  }
};


const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
    files: 5 
  }
});

module.exports = upload;