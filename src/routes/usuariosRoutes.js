import express from 'express';
import { registrarUsuario, loginUsuario, getPerfil, patchUsuario, upload,actualizarPerfil } from '../controladores/usuariosCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Registro y login
router.post('/registro', registrarUsuario);
router.post('/login', loginUsuario);

// Perfil y actualización
router.get('/perfil', verifyToken, getPerfil);
router.patch('/perfil', verifyToken, upload, patchUsuario);
router.put('/perfil', verifyToken, actualizarPerfil);

export default router;
