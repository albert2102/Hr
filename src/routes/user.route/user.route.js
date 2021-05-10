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

router.route('/institution/updateInfo')
    .put(requireAuth,
        multerSaveTo('users').fields(uploadedFiles),
        parseObject(parseArray),
        userController.validateUpdateInstitution(),
        userController.updateInfo);

router.route('/institution/signup')
    .post(
        multerSaveTo('users').single('image'), 
        parseObject(parseArray), 
        userController.validateAddInstitutionBody(), 
        userController.institutionSignUp);

router.route('/driver/updateInfo')
    .put(requireAuth, 
        multerSaveTo('users').single('image'), 
        parseObject(parseArray), 
        userController.validateUpdateDriver(), 
        userController.updateInfo);

router.route('/driver/signup')
    .post(
        multerSaveTo('users').single('image'), 
        parseObject(parseArray), 
        userController.validateCreateDriver(), 
        userController.driverSignUp);

router.get('/Home', userController.Home);

router.route('/user/openActiveChatHead').put(requireAuth, userController.openActiveChatHead)
router.route('/user/closeActiveChatHead').put(requireAuth, userController.closeActiveChatHead)

router.route('/signup')
    .post(multerSaveTo('users').single('image'), userController.validateUserCreateBody(), userController.userSignUp);

router.route('/socialMedia')
    .post(userController.validateSocialMediaLogin(), userController.socialMedialLogin);

router.route('/deleteAccount').delete(requireAuth, userController.validateDeleteUserAccount(), userController.deleteUserAccount);

router.post('/signin', userController.validateUserSignin(), userController.signIn);

router.get('/allUsers', requireAuth, userController.findAll);

router.get('/userInfo',userController.userInformation)

router.route('/addToken').post(requireAuth, userController.validateAddToken(), userController.addToken);

router.route('/logout').post(requireAuth, userController.validateLogout(), userController.logout);


router.post('/checkExistPhone', userController.validateCheckPhone(), userController.checkExistPhone);
router.post('/checkExistEmail', userController.validateCheckEmail(), userController.checkExistEmail);


router.put('/user/updateInfo',
    requireAuth,
    multerSaveTo('users').fields(uploadedFiles),
    parseObject(parseArray),
    userController.validateUserUpdate(true),
    userController.updateInfo);

router.put('/user/changePassword',
    requireAuth,
    userController.validateUpdatedPassword(),
    userController.updatePasswordFromProfile);


router.post('/reset-password',
    userController.validateResetPassword(),
    userController.resetPassword);

// forgetpassword by mail 
router.post('/forgetPassword', userController.validateForgetPassword(), userController.forgetPassword);
router.put('/confirmationCode', userController.validateConfirmCode(), userController.verifyForgetPasswordCode);
router.put('/confirmationchange', userController.validateResetPassword(), userController.updatePassword);

// forgetpassword by phone number  
router.post('/phoneForgetPassword', userController.validateForgetPasswordByPhone(), userController.forgetPasswordByPhone);
router.put('/phoneConfirmationCode', userController.validateVerifyForgetPasswordByPhone(), userController.verifyForgetPasswordByPhone);
router.put('/phonePasswordChange', userController.validateUpdatePasswordByPhone(), userController.updatePasswordByPhone);

router.route('/account').delete(requireAuth, userController.deleteAccount);

router.post('/uploadImage', multerSaveTo('users').single('image'), userController.uploadImage)

export default router;
