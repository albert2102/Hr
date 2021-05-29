import express from 'express';
import { requireSignIn, requireAuth } from '../../services/passport';
import { multerSaveTo } from '../../services/multer-service';
import adminController from '../../controllers/admin.controller/admin.controller';
import { parseObject } from '../../controllers/shared.controller/shared.controller';

const parseArray = ['location','internallyCarImage','paymentMethod']

const router = express.Router();
router.get('/traderReport', adminController.reportsByCategory);

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
    parseObject(parseArray),
    adminController.validateAdminChangeUser(),
    adminController.adminUpdateUser);

router.route('/deleteFromArchive').delete(requireAuth, adminController.validateDeleteFromArchive(), adminController.deleteFromArchive);

router.route('/driver')
    .post(multerSaveTo('users').single('image'),
        parseObject(parseArray),
        requireAuth, adminController.validateAddDriverBody(), adminController.addDriver)

    .put(multerSaveTo('users').single('image'),
        parseObject(parseArray),
        requireAuth, adminController.validateAdminChangeDriver(), adminController.adminUpdateUser);


router.route('/institution')
    .post(multerSaveTo('users').single('image'),
        parseObject(parseArray),
        requireAuth, adminController.validateAddInstitutionBody(), adminController.addInstitution)

    .put(multerSaveTo('users').single('image'),
        parseObject(parseArray),
        requireAuth, adminController.validateAdminChangeInstitution(), adminController.adminUpdateUser);

router.post('/uploadImage', requireAuth, multerSaveTo('admins').single('image'), adminController.uploadImage)

router.route('/changeStatus').put(requireAuth,adminController.validateChangeStatus(),adminController.changeStatus)

export default router;
