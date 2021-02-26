import express from 'express';
import advertismentController from '../../controllers/advertisments.controller/advertisments.controller';
import {requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
const router = express.Router();

router.route('/')
    .post(requireAuth,multerSaveTo('advertisment').single('image'),advertismentController.validateBody(),advertismentController.create)
    .get(advertismentController.find);

router.route('/:AdvertismentsId')
    .put(requireAuth,multerSaveTo('advertisment').single('image'),
            advertismentController.validateBody(),advertismentController.update)
    .delete(requireAuth,advertismentController.delete)
    .get(requireAuth,advertismentController.findById)

    
export default router;