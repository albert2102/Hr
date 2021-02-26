
import Advertisments from '../../models/advertisments.model/advertisments.model';
import Category from '../../models/category.model/category.model';
import Product from '../../models/product.model/product.model';
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import ApiError from '../../helpers/ApiError';


const populateQuery = [
    { path: 'product', model: 'product' },{ path: 'category', model: 'category' }
];

export default {

    async find(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            let {type,numberOfSlots} = req.query

            let query = {  deleted: false };
            if (numberOfSlots) {
               query.numberOfSlots = numberOfSlots
            }
            if (type) {
                query.type = type
             }

            let advertisment = await Advertisments.find(query)
                .sort({ createdAt: -1 }).populate(populateQuery)
                .limit(limit)
                .skip((page - 1) * limit);

            const advertismentCount = await Advertisments.count(query);
            const pageCount = Math.ceil(advertismentCount / limit);
            res.status(200).send(new ApiResponse(advertisment, page, pageCount, limit, advertismentCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody() {
        let validations = [
                body('numberOfSlots').not().isEmpty().withMessage(() => { return i18n.__('numberOfSlotsRequired') })
                .isInt({max:4,min:1}).withMessage(() => { return i18n.__('invalidSlot') }),
                body('type').not().isEmpty().withMessage(() => { return i18n.__('typeRequired') })
                    .isIn(['HOME_PAGE','PRODUCT_PAGE']).withMessage(() => { return i18n.__('invalidType') }),
                body('homeAddsAfetr').optional().not().isEmpty().withMessage(() => { return i18n.__('homeAddsAfetrRequired') })
                    .isIn(['PRODUCT','CATEGORY']).withMessage(() => { return i18n.__('invalidType') })

            ];

        return validations;
    },

    async create(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            
            if(req.file)
                validatedBody.image =await handleImg(req,{attributeName:'image'}) ;
            let advertisment = await Advertisments.create(validatedBody);
            advertisment = await Advertisments.populate(advertisment,populateQuery);
            res.status(200).send(advertisment);
        } catch (error) {
            next(error)
        }
    },

    async update(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false , populate:populateQuery });
            if(req.file)
                validatedBody.image = handleImg(req,{attributeName:'image'}) ;
            advertisment = await Advertisments.findByIdAndUpdate(AdvertismentsId , validatedBody , {new:true});
            res.status(200).send(advertisment);
        } catch (error) {
            next(error)
        }
    },

    async findById(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false , populate:populateQuery });
            res.status(200).send(advertisment);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false  });
            advertisment.deleted = true;
            await advertisment.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    }
}

