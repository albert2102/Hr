import config from '../config';
import jwt from 'jsonwebtoken';


const { jwtSecret } = config;

export const generateToken = id => {
    return jwt.sign({
        sub: id,
        iss: 'App',
        iat: new Date().getTime()
    }, jwtSecret, { expiresIn: '30d' });
};