import express from 'express';
import contactUsController from '../../controllers/contactUs.controller/contactUs.controller';
import {requireAuth } from '../../services/passport';
const router = express.Router();

router.route('/')
    .post(requireAuth,contactUsController.validateBody(),contactUsController.create)
    .get(requireAuth,contactUsController.find);

router.post('/withoutToken', contactUsController.validateBody(),contactUsController.create)

router.post('/:contactUsId/reply',requireAuth,contactUsController.validateReply(),contactUsController.reply)

router.route('/:contactUsId')
    .delete(requireAuth,contactUsController.delete)
    .get(requireAuth,contactUsController.findById)



    
export default router;