import Region from "../../models/region.model/region.model";
import City from "../../models/city.model/city.model";
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import dotObject from 'dot-object';
let populateQuery = [{ path: 'city', model: 'city',populate: [{ path: 'country', model: 'country' }] }];
import moment from 'moment'


export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.ar': val, deleted: false, city: req.body.city };
                        let region = await Region.findOne(query).lean();
                        if (region)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.en': val, deleted: false, city: req.body.city };
                        let region = await Region.findOne(query).lean();
                        if (region)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('city').not().isEmpty().withMessage(() => { return i18n.__('cityRequired') }).custom(async (val, { req }) => {
                    await checkExist(val, City, { deleted: false });
                    return true;
                })
            ];
        }
        else {
            validations = [
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false, _id: { $ne: req.params.regionId } };
                        let region = await Region.findOne(query).lean();
                        if (region)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false, _id: { $ne: req.params.regionId } };
                        let region = await Region.findOne(query).lean();
                        if (region)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') }).custom(async (val, { req }) => {
                    await checkExist(val, City, { deleted: false });
                    return true;
                })
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            var { name, city,country,month,year} = req.query;
            let query = { deleted: false };
    
            if (name) query.$or = [{'name.ar': { '$regex': name, '$options': 'i' }},{'name.en': { '$regex': name, '$options': 'i' }}];
            if (city) query.city = city;
            if (country){
                let cities = await City.find({deleted: false,country:country}).distinct('_id');
                query.city = {$in: cities}
            }
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
            let regions = await Region.find(query)
                .sort({ createdAt: -1 }).populate(populateQuery).sort({ _id: -1 });

            regions = Region.schema.methods.toJSONLocalizedOnly(regions, i18n.getLocale());
            
            res.send({data: regions});


        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let validatedBody = checkValidations(req);
            let region = await Region.create(validatedBody);
            region = await Region.populate(region, populateQuery);
            region = Region.schema.methods.toJSONLocalizedOnly(region, i18n.getLocale());
            res.status(200).send(region);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { regionId } = req.params;
            let { removeLanguage } = req.query;            
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            await checkExist(regionId, Region, { deleted: false });
            let validatedBody = checkValidations(req);
            validatedBody = dotObject.dot(validatedBody);
            let updatedRegion = await Region.findByIdAndUpdate(regionId, validatedBody, { new: true });
            if(! removeLanguage) 
                updatedRegion = Region.schema.methods.toJSONLocalizedOnly(updatedRegion, i18n.getLocale());
            res.status(200).send(updatedRegion);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { regionId } = req.params;
            let { removeLanguage } = req.query;
            let region = await checkExistThenGet(regionId, Region, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                region = Region.schema.methods.toJSONLocalizedOnly(region, i18n.getLocale());
            }
            res.status(200).send(region);

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let { regionId } = req.params;
            let region = await checkExistThenGet(regionId, Region, { deleted: false });
            region.deleted = true;
            await region.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    }
}