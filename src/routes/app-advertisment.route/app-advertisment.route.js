import express from 'express';
import advertismentController from '../../controllers/app-advertisments.controller/app-advertisments.controller';
import {requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
const router = express.Router();

router.route('/')
    .post(requireAuth,multerSaveTo('app-advertisment').single('image'),advertismentController.create)
    .get(advertismentController.find);

    
router.route('/deleteMutliple').delete(requireAuth,advertismentController.validateDeleteMulti(),advertismentController.deleteMuti)

router.route('/:AdvertismentsId')
    .put(requireAuth,multerSaveTo('app-advertisment').single('image'),advertismentController.update)
    .delete(requireAuth,advertismentController.delete)
    .get(requireAuth,advertismentController.findById)

    
export default router;