import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js'; 

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).send({ message: 'Token no proporcionado' });
  }

  // Extraer el token desde "Bearer <token>"
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(403).send({ message: 'Token malformado' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Token no válido' });
    }

 // Guardar ID y rol
  req.user = { id: decoded.id, rol: decoded.rol };

    // Para depuración opcional
    console.log('Usuario autenticado:', req.user);
    console.log('Contenido del token decodificado:', decoded);

    next();
  });
};
