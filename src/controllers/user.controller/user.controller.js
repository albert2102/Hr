import bcrypt from 'bcryptjs';
import { body } from 'express-validator/check';
import { checkValidations, handleImg, fieldhandleImg } from '../shared.controller/shared.controller';
import { generateToken } from '../../utils/token';
import { checkExistThenGet, checkExist } from '../../helpers/CheckMethods';
import ApiError from '../../helpers/ApiError';
import { sendEmail } from '../../services/emailMessage.service'
import i18n from 'i18n'
import ApiResponse from '../../helpers/ApiResponse'
import moment from 'moment'
import socketEvents from '../../socketEvents'
// import { twilioSend, twilioVerify } from '../../services/twilo'
// import NotificationController from '../notif.controller/notif.controller';






export default {

};