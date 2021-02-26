import Country from "../../models/country.model/country.model";
import City from "../../models/city.model/city.model";
import Region from "../../models/region.model/region.model";
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import dotObject from 'dot-object'
import moment from 'moment'

export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.ar': val, deleted: false };
                        let country = await Country.findOne(query).lean();
                        if (country)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.en': val, deleted: false };
                        let country = await Country.findOne(query).lean();
                        if (country)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    })
            ];
        }
        else {
            validations = [
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.ar': val, deleted: false, _id: { $ne: req.params.countryId } };
                        let country = await Country.findOne(query).lean();
                        if (country)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.en': val, deleted: false, _id: { $ne: req.params.countryId } };
                        let country = await Country.findOne(query).lean();
                        if (country)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    })
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            var { name,month,year , removeLanguage } = req.query;
            let query = { deleted: false };
            if (name) query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }];
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
            let countries = await Country.find(query).sort({ createdAt: -1 });
            if (!removeLanguage) {
                countries = Country.schema.methods.toJSONLocalizedOnly(countries, i18n.getLocale());
            }
            
            res.send({data: countries});


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
            let country = await Country.create(validatedBody);
            country = Country.schema.methods.toJSONLocalizedOnly(country, i18n.getLocale());
            res.status(200).send(country);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { countryId } = req.params;
            let user = req.user;
            let { removeLanguage } = req.query;            
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            await checkExist(countryId, Country, { deleted: false });
            let validatedBody = checkValidations(req);
            validatedBody = dotObject.dot(validatedBody);
            let updatedCountry = await Country.findByIdAndUpdate(countryId, {
                ...validatedBody,
            }, { new: true });
            if(!removeLanguage)
                updatedCountry = Country.schema.methods.toJSONLocalizedOnly(updatedCountry, i18n.getLocale());
            res.status(200).send(updatedCountry);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { countryId } = req.params;
            let { removeLanguage } = req.query;            
            let country = await checkExistThenGet(countryId, Country, { deleted: false });
            if (! removeLanguage) {
                country = Country.schema.methods.toJSONLocalizedOnly(country, i18n.getLocale());
            }
            res.status(200).send(country);

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
            let { countryId } = req.params;
            let country = await checkExistThenGet(countryId, Country, { deleted: false });
            country.deleted = true;
            await country.save();
            res.status(200).send("Deleted Successfully");
            let allCities = await City.find({deleted: false,country:countryId}).distinct('_id');
            await City.updateMany({deleted: false,country:countryId},{deleted: true})
            await Region.updateMany({deleted: false,city:{$in:allCities}},{deleted: true})
        }
        catch (err) {
            next(err);
        }
    }
}