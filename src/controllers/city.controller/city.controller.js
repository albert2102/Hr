import City from "../../models/city.model/city.model";
import Country from "../../models/country.model/country.model";
import Region from "../../models/region.model/region.model";
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import dotObject from 'dot-object';
let populateQuery = [{ path: 'country', model: 'country' }];
import moment from 'moment'


export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.ar': val, deleted: false, country: req.body.country };
                        let city = await City.findOne(query).lean();
                        if (city)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.en': val, deleted: false, country: req.body.country };
                        let city = await City.findOne(query).lean();
                        if (city)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('country').not().isEmpty().withMessage(() => { return i18n.__('countryRequired') }).custom(async (val, { req }) => {
                    await checkExist(val, Country, { deleted: false });
                    return true;
                })
            ];
        }
        else {
            validations = [
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.ar': val, deleted: false,  _id: { $ne: req.params.cityId } };
                        let city = await City.findOne(query).lean();
                        if (city)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {

                        let query = { 'name.en': val, deleted: false,  _id: { $ne: req.params.cityId } };
                        let city = await City.findOne(query).lean();
                        if (city)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') }).custom(async (val, { req }) => {
                    await checkExist(val, Country, { deleted: false });
                    return true;
                })
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            var { name, country,month,year} = req.query;
            let query = { deleted: false };
    
            if (name) query.$or = [{'name.ar': { '$regex': name, '$options': 'i' }},{'name.en': { '$regex': name, '$options': 'i' }}];
                
            if (country) query.country = country;
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
            let cities = await City.find(query)
                .sort({ createdAt: -1 }).populate(populateQuery).sort({ _id: -1 });

            cities = City.schema.methods.toJSONLocalizedOnly(cities, i18n.getLocale());
            
            res.send({data:cities});


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
            let city = await City.create(validatedBody);
            city = await City.populate(city, populateQuery);
            city = City.schema.methods.toJSONLocalizedOnly(city, i18n.getLocale());
            res.status(200).send(city);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { cityId } = req.params;
            let { removeLanguage } = req.query;            
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            await checkExist(cityId, City, { deleted: false });
            let validatedBody = checkValidations(req);
            validatedBody = dotObject.dot(validatedBody);
            let updatedCity = await City.findByIdAndUpdate(cityId, validatedBody, { new: true });
            if(! removeLanguage) 
                updatedCity = City.schema.methods.toJSONLocalizedOnly(updatedCity, i18n.getLocale());
            res.status(200).send(updatedCity);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { cityId } = req.params;
            let { removeLanguage } = req.query;
            let city = await checkExistThenGet(cityId, City, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                city = City.schema.methods.toJSONLocalizedOnly(city, i18n.getLocale());
            }
            res.status(200).send(city);

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
            let { cityId } = req.params;
            let city = await checkExistThenGet(cityId, City, { deleted: false });
            city.deleted = true;
            await city.save();
            res.status(200).send("Deleted Successfully");
            await Region.updateMany({deleted: false,city:cityId},{deleted: true})

        }
        catch (err) {
            next(err);
        }
    }
}