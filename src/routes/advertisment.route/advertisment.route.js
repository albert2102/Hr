import express from 'express';
import advertismentController from '../../controllers/advertisments.controller/advertisments.controller';
import {requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
const router = express.Router();

router.route('/')
    .post(requireAuth,multerSaveTo('advertisment').array('images'),advertismentController.validateBody(),advertismentController.create)
    .get(advertismentController.find);

router.route('/:AdvertismentsId/changeStatus').put(requireAuth,advertismentController.validateAdminChangeStatus(),advertismentController.changeStatus)
router.route('/:AdvertismentsId/increaseViews').put(advertismentController.updateNumberOfViews)

router.route('/:AdvertismentsId')
    .put(requireAuth,multerSaveTo('advertisment').array('images'),advertismentController.validateBody(true),advertismentController.update)
    .delete(requireAuth,advertismentController.delete)
    .get(requireAuth,advertismentController.findById)

    
export default router;