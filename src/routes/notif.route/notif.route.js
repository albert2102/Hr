import express from 'express';
import NotifController from '../../controllers/notif.controller/notif.controller';
import { requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import {parseObject} from '../../controllers/shared.controller/shared.controller'
const router = express.Router();

router.route('/')
    .get(requireAuth, NotifController.findMyNotification);

router.route('/FindAll').get(requireAuth,NotifController.findAll);
router.route('/deleteMutliple').delete(requireAuth,NotifController.validateDeleteMulti(),NotifController.deleteMuti)

router.post('/sendToAll',
    multerSaveTo('notification').single('image'), 
    requireAuth, 
    parseObject(['titleOfNotification','text']),
    NotifController.validateAdminSendToAll(), 
    NotifController.adminSendToAllUsers)

router.post('/sendToSpecificUser',
    multerSaveTo('notification').single('image'), 
    requireAuth, 
    parseObject(['titleOfNotification','text','users']),
    NotifController.validateAdminSendToSpecificUsers(), 
    NotifController.adminSendToAllSpecificUsers)

router.route('/user-delete/:notifId').delete(requireAuth,NotifController.userDelete)

router.route('/:notifId/read')
    .put(requireAuth, NotifController.read)

router.route('/:notifId/unread')
    .put(requireAuth, NotifController.unread);

router.route('/:notifId')
    .get(requireAuth,NotifController.findById)
    .delete(NotifController.delete);

export default router;