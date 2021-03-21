import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Credit from "../../models/credit.model/credit.model";
import i18n from 'i18n' ;
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var user = req.user;
            let query = { deleted: false , user : user.id };
            let credits = await Credit.find(query).sort({ createdAt: -1 })  
            let pageCount;
            const creditsCount = await Credit.count(query);
            pageCount = Math.ceil(creditsCount / limit);
            res.status(200).send(new ApiResponse(credits, page, pageCount, limit, creditsCount, req));
        } catch (err) {
            next(err);
        }
    },

    validate() {
        let validator = [
            body('cardNumber').not().isEmpty().withMessage(() => { return i18n.__('invalidCreditCardNumber') }),
            body('cvc').not().isEmpty().withMessage(()=>{ return i18n.__('cvcIsRequired') }),
            body('expireDateYear').not().isEmpty().withMessage(() => { return i18n.__('expireDateYearRequired')})
                .isNumeric().withMessage(() => { return i18n.__('expireDateYearValueError')})
                .isLength({min:4,max:4}).withMessage(() => { return i18n.__('expireDateYearValueError')}),
            body('expireDateMonth').not().isEmpty().withMessage(() => { return i18n.__('expireDateMonthRequired')})
                .isNumeric().withMessage(() => { return i18n.__('expireDateMonthValueError')})
                .isLength({min:2,max:2}).withMessage(() => { return i18n.__('expireDateMonthValueError')}),
            body('holder').not().isEmpty().withMessage(() => { return i18n.__('holderRequired')}),
            body('paymentType').not().isEmpty().withMessage(() => { return i18n.__('paymentTypeRequired') }).isIn(['VISA','MASTERCARD','MADA']).withMessage('Wrong type'),
        ];
        
        return validator;
    },
    
    async create(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            validatedBody.user = req.user.id ;
            let oldCard = await Credit.findOne({deleted:false , cardNumber : validatedBody.cardNumber , user:req.user.id });
            if(oldCard){
                return next(new ApiError(400, i18n.__('oldCard')) );
            }
            let createdCredit = await Credit.create(validatedBody );
            let credits = await Credit.find({deleted:false , user :req.user.id })
                .sort({createdAt:-1})  
            res.status(201).send(credits);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { id } = req.params;
            let Credit = await checkExistThenGet(id, Credit, { deleted: false });
            res.send(Credit);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {

        try {
            let validatedBody = checkValidations(req);
            let  creditId = req.params.id;
            await checkExist(creditId, Credit, { deleted: false });
            
            let oldCard = await Credit.findOne({deleted:false ,cardNumber : validatedBody.cardNumber, user:req.user.id , _id: {$ne:creditId} });
            if(oldCard){
                return next(new ApiError(400,() => {return i18n.__('oldCard')}));
            }
            let updatedCredit = await Credit.findByIdAndUpdate(creditId, validatedBody, { new: true });
            let cards = await Credit.find({deleted:false , user:req.user.id});
            res.status(200).send({ cards: cards });
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            
            let {id} = req.params ;
            let credit = await checkExistThenGet(id, Credit, { deleted: false });
            credit.deleted = true;
            await credit.save();
            let cards = await Credit.find({deleted:false , user : req.user.id})
            res.status(200).send({ cards:cards });
        }
        catch (err) {
            next(err);
        }
    },
};