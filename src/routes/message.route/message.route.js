import express from 'express';
import { requireAuth } from '../../services/passport';
import messageController from '../../controllers/message.controller/message.controller'
import { multerSaveTo } from '../../services/multer-service'


const router = express.Router();


router.route('/support').post(requireAuth,
    multerSaveTo('chat').single('file'),
    messageController.validateCreateSupport(),
    messageController.createSupport
)
.get(requireAuth,messageController.getSupportChat)

router.route('/').post(requireAuth,
    multerSaveTo('chat').single('file'),
    messageController.validateCreateDefault(),
    messageController.create
)
router.route('/compalint').post(requireAuth,
    multerSaveTo('chat').single('file'),
    messageController.validateComplaint(),
    messageController.create
)
router.route('/order').post(requireAuth,
    multerSaveTo('chat').single('file'),
    messageController.validateOrder(),
    messageController.create
)
router.route('/specificChat').get(requireAuth,messageController.getChatHistory)
router.route('/lastContacts').get(requireAuth,messageController.getLastContacts)

router.route('/complaintslastChats').get(requireAuth, messageController.getLastComplaintsChatsForAdmin)
router.route('/orderslastChats').get(requireAuth, messageController.getLastOrdersChatsForAdmin)
router.route('/lastChats').get(requireAuth, messageController.getLastChatsForAdmin)
router.route('/adminGetSpecificChat').get(requireAuth, messageController.getSpecificChat)


router.route('/:id')
    .get(requireAuth, messageController.getById)
    .delete(requireAuth, messageController.deleteForEveryOne)
export default router;