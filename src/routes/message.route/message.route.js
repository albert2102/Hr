import express from 'express';
import { requireAuth } from '../../services/passport';
import messageController from '../../controllers/message.controller/message.controller'
import { multerSaveTo } from '../../services/multer-service'


const router = express.Router();

router.route('/').post(requireAuth,
    multerSaveTo('chat').single('file'),
    messageController.validateCreateDefault(),
    messageController.create
)

router.route('/specificChat').get(requireAuth, messageController.getChatForUser)
router.route('/lastChats').get(requireAuth, messageController.getLastChatsForAdmin)


router.route('/:id')
    .get(requireAuth, messageController.getById)
    .delete(requireAuth, messageController.deleteForEveryOne)
export default router;