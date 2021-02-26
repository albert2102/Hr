import express from 'express';
import { requireSignIn, requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import adminController from '../../controllers/admin.controller/admin.controller';

const router = express.Router();

router.route('/signup')
    .post(multerSaveTo('users').single('image'),
        adminController.validateAdminSignUp(), adminController.signUp);

router.post('/signin', adminController.validateAdminSignin(), adminController.adminSignIn);

router.put('/updateProfile',
    requireAuth,
    multerSaveTo('users').single('image'),
    adminController.validateAdminSignUp(true),
    adminController.updateProfile);

router.route('/addUser')
    .post(multerSaveTo('users').single('image'),
        requireAuth, adminController.validateAddUserBody(), adminController.addUser);
      
router.get('/userInfo', requireAuth, adminController.userInformation)

router.put('/activate', requireAuth, adminController.validateAdminActivateUser(), adminController.adminActivateUser);
router.route('/account').delete(requireAuth, adminController.validateDeleteUserAccount(), adminController.deleteUserAccount);

router.put('/updateUser',
    requireAuth,
    multerSaveTo('users').single('image'),
    adminController.validateAdminChangeUser(),
    adminController.adminUpdateUser);

router.route('/deleteFromArchive').delete(requireAuth, adminController.validateDeleteFromArchive(), adminController.deleteFromArchive);

export default router;
