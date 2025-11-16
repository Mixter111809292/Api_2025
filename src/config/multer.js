// middlewares/productos.multer.js
import multer from 'multer';

// Almacenar la imagen en memoria para enviarla a Cloudinary
const storage = multer.memoryStorage();

export const uploadProducto = multer({ storage }).single('imagen'); 
// El front debe enviar el campo: "imagen"
