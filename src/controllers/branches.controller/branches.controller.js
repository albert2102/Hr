import Branch from "../../models/branches.model/branches.model";
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import moment from 'moment'
import ApiError from "../../helpers/ApiError";
import dot from 'dot-object'

let populateQuery = [];


export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
                body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicNameRequired') }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('englishNameRequired') }),
                body('long').not().isEmpty().withMessage(() => { return i18n.__('longRequired') }),
                body('lat').not().isEmpty().withMessage(() => { return i18n.__('latRequired') }),
                body('address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') })
            ];
        }
        else {
            validations = [
                body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),

                body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicNameRequired') }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('englishNameRequired') }),
                body('long').optional().not().isEmpty().withMessage(() => { return i18n.__('longRequired') }),
                body('lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latRequired') }),
                body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') })
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            var { name, month, year ,address,removeLanguage,phone} = req.query;
            let query = { deleted: false };
            if (name) query.$or=[{ 'name.en': {'$regex': name, '$options': 'i'} },{ 'name.ar': {'$regex': name, '$options': 'i'} }];
            if (address) query.address = {'$regex': address, '$options': 'i'} ;            
            if (phone) query.phone = {'$regex': phone, '$options': 'i'} ;            

            let date = new Date();
            if (month && year) {
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('month');
                let endOfDate = moment(date).endOf('month');

                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            if (year && !month) {
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            let branchees = await Branch.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            const brancheCount = await Branch.count(query);
            let pageCount = Math.ceil(brancheCount / limit);
            if (!removeLanguage) {
                branchees = Branch.schema.methods.toJSONLocalizedOnly(branchees, i18n.getLocale());
            }
            res.send(new ApiResponse(branchees, page, pageCount, limit, brancheCount, req));
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let branche = await Branch.create(validatedBody);
            branche = Branch.schema.methods.toJSONLocalizedOnly(branche, i18n.getLocale());
            res.status(200).send(branche);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { brancheId } = req.params;
            await checkExist(brancheId, Branch, { deleted: false });
            let validatedBody = checkValidations(req);
            console.log(validatedBody);
            if (validatedBody.long || validatedBody.lat) {
                if (!(validatedBody.lat && validatedBody.long)) {
                    return next(new ApiError(404,i18n.__('locationValueError')));
                }
            }
            validatedBody  = dot.dot(validatedBody);
            let updatedbranche = await Branch.findByIdAndUpdate(brancheId, {...validatedBody}, { new: true }).populate(populateQuery);
            updatedbranche = Branch.schema.methods.toJSONLocalizedOnly(updatedbranche, i18n.getLocale());
            res.status(200).send(updatedbranche);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { brancheId } = req.params;
            let {removeLanguage}  = req.query
            let branche = await checkExistThenGet(brancheId, Branch, { deleted: false });
            if (!removeLanguage) {
                branche = Branch.schema.methods.toJSONLocalizedOnly(branche, i18n.getLocale());
            }
            res.status(200).send(branche);
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { brancheId } = req.params;
            let branche = await checkExistThenGet(brancheId, Branch, { deleted: false });
            branche.deleted = true;
            await branche.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    }
}