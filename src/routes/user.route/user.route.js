import express from 'express';
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import userController from '../../controllers/user.controller/user.controller';
import { parseObject } from '../../controllers/shared.controller/shared.controller';

const parseArray = ['location', 'internallyCarImage', 'paymentMethod']

const uploadedFiles = [
    { name: "image", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
]
const router = express.Router();



export default router;
