import { pool } from '../db.js'; // Importa la conexión a la base de datos desde el archivo db.js
import bcrypt from 'bcrypt'; // Importa bcrypt para el hashing de contraseñas
import { SignJWT, jwtVerify } from 'jose'; // Importa funciones para manejar JSON Web Tokens (JWT)
import { validateUser } from "../../validacion.js"; // Importa la función validateUser desde el archivo validacion.js
import dotenv from "dotenv"; // Importa dotenv para cargar variables de entorno desde un archivo .env

dotenv.config(); // Carga las variables de entorno desde el archivo .env
const secret = process.env.secret; // Asigna la variable de entorno secret a la constante secret

// Middleware de autenticación
const authenticateToken = async (req, res, next) => { 
    const { authorization } = req.headers; // Obtiene el token de autorización de los encabezados de la solicitud

    if (!authorization) return res.status(401).send('Token no proporcionado'); // Si no hay token, responde con un error 401

    try {
        const encoder = new TextEncoder(); // Crea un nuevo TextEncoder
        const { payload } = await jwtVerify(authorization, encoder.encode(secret)); // Verifica el token y extrae el payload
        req.user = payload; // Asigna el payload del token al objeto req.user
        next(); // Llama al siguiente middleware
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        return res.status(401).send('Token inválido o expirado'); // Responde con un error 401 si el token es inválido o ha expirado
    }
};

// Exporta la función getUser que obtiene todos los usuarios de la base de datos
export const getUser = (authenticateToken, validateUser, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users'); // Ejecuta una consulta para obtener todos los usuarios
        res.status(200).json(result.rows); // Responde con los usuarios obtenidos en formato JSON
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        res.status(500).send('Error retrieving users'); // Responde con un error 500 si hay un problema al obtener los usuarios
    }
})

// Exporta la función createUser que crea un nuevo usuario en la base de datos
export const createUser = (validateUser, async (req, res) => {
    const { name, email, password } = req.body; // Obtiene el nombre, correo electrónico y contraseña del cuerpo de la solicitud
  
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hashea la contraseña con bcrypt
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *', // Inserta el nuevo usuario en la base de datos
            [name, email, hashedPassword]
        );
        res.status(201).json(result.rows[0]); // Responde con el usuario creado en formato JSON
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        res.status(500).send('Error creating user'); // Responde con un error 500 si hay un problema al crear el usuario
    }
});

// Exporta la función login que autentica a un usuario y genera un token JWT
export const login = (validateUser, async (req, res) => {
    const { email, password } = req.body; // Obtiene el correo electrónico y la contraseña del cuerpo de la solicitud
  
    if (!email || !password) return res.status(400).send('Email y contraseña son requeridos'); // Responde con un error 400 si faltan el correo electrónico o la contraseña
  
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]); // Ejecuta una consulta para obtener el usuario por correo electrónico
        const user = result.rows[0];
        
        if (!user) return res.status(401).send('Email inválido'); // Responde con un error 401 si el usuario no existe
        
        const isPasswordValid = await bcrypt.compare(password, user.password); // Compara la contraseña proporcionada con la almacenada
        if (!isPasswordValid) return res.status(401).send('Contraseña inválida'); // Responde con un error 401 si la contraseña es incorrecta
  
        const encoder = new TextEncoder(); // Crea un nuevo TextEncoder
        const id_users = `${user.id_users}`; // Asigna el ID del usuario a la constante id_users
        const jwtConstructor = new SignJWT({ id_users }); // Crea un nuevo JWT con el ID del usuario
        const jwt = await jwtConstructor
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }) // Establece el encabezado del JWT
            .setIssuedAt() // Establece la fecha de emisión del JWT
            .setExpirationTime('7h') // Establece la fecha de expiración del JWT
            .sign(encoder.encode(secret)); // Firma el JWT con la clave secreta
        
        return res.send({ jwt }); // Responde con el JWT generado
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        res.status(500).send('Error al iniciar sesión'); // Responde con un error 500 si hay un problema al iniciar sesión
    }
})

// Exporta la función getLogin que obtiene la información del usuario autenticado
export const getLogin = (validateUser, authenticateToken, async (req, res) => {
    const { id_users } = req.user; // Obtiene el ID del usuario del payload del token

    try {
        const result = await pool.query('SELECT * FROM users WHERE id_users = $1', [id_users]); // Ejecuta una consulta para obtener el usuario por ID
        const user = result.rows[0];
        
        if (!user) return res.status(401).send('Usuario no encontrado'); // Responde con un error 401 si el usuario no existe
        
        delete user.password; // Elimina la contraseña del objeto usuario

        return res.send(user); // Responde con el usuario en formato JSON
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        return res.status(401).send('Token inválido o expirado'); // Responde con un error 401 si hay un problema con el token
    }
});

// Exporta la función deleteUser que elimina un usuario de la base de datos
export const deleteUser = (validateUser, authenticateToken, async (req, res) => {
    const { id } = req.params; // Obtiene el ID del usuario de los parámetros de la solicitud

    try {
        const result = await pool.query('DELETE FROM users WHERE id_users = $1 RETURNING *', [id]); // Ejecuta una consulta para eliminar el usuario por ID
        const user = result.rows[0];

        if (!user) return res.status(404).send('Usuario no encontrado'); // Responde con un error 404 si el usuario no existe

        res.status(200).json(user); // Responde con el usuario eliminado en formato JSON
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        res.status(500).send('Error al eliminar el usuario'); // Responde con un error 500 si hay un problema al eliminar el usuario
    }
})

// Exporta la función actualizateUser que actualiza la información de un usuario en la base de datos
export const actualizateUser = (validateUser, authenticateToken, async (req, res) => {
    const { id } = req.params; // Obtiene el ID del usuario de los parámetros de la solicitud
    const { name, email, password } = req.body; // Obtiene el nombre, correo electrónico y contraseña del cuerpo de la solicitud

    if (!name || !email || !password) return res.status(401).send('Faltan datos'); // Responde con un error 401 si faltan datos

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hashea la contraseña con bcrypt
        const result = await pool.query(
            'UPDATE users SET name = $1, email = $2, password = $3 WHERE id_users = $4 RETURNING *', // Ejecuta una consulta para actualizar el usuario por ID
            [name, email, hashedPassword, id]
        );
        const user = result.rows[0];

        if (!user) return res.status(404).send('Usuario no encontrado'); // Responde con un error 404 si el usuario no existe

        delete user.password; // Elimina la contraseña del objeto usuario

        return res.status(200).json(user); // Responde con el usuario actualizado en formato JSON
    } catch (err) {
        console.error(err); // Imprime el error en la consola
        res.status(500).send('Error al actualizar el usuario'); // Responde con un error 500 si hay un problema al actualizar el usuario
    }
})
