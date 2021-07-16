import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { handleImg, checkValidations } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Zone from "../../models/zone.model/zone.model";
import i18n from 'i18n'
import dotObject from 'dot-object';
import moment from 'moment'

export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, month, year, all, long, lat, user } = req.query
            let query = { deleted: false };
            if (user) query.user = user;
            if (name) {
                query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }]
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

            const zonesCount = await Zone.count(query);
            let zones;
            let pageCount = zonesCount;
            if (all) {
                limit = pageCount;
                zones = await Zone.find(query).sort({ createdAt: -1 })
            } else if (long && lat) {
                zones = await Zone.aggregate([
                    // Find points or objects "near" and project the distance
                    {
                        $geoNear: {
                            near: {
                                type: "Point",
                                coordinates: [+long, +lat]
                            },
                            distanceField: "distance",
                            query: { user: { $ne: null } }
                        }
                    },
                    // Logically filter anything outside of the radius
                    {
                        $redact: {
                            $cond: {
                                if: { $gt: ["$distance", "$radius"] },
                                then: "$$PRUNE",
                                else: "$$KEEP"
                            }
                        }
                    }
                ])
            }
            else {
                pageCount = Math.ceil(zonesCount / limit);
                zones = await Zone.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit)
            }
            // zones = Zone.schema.methods.toJSONLocalizedOnly(zones, i18n.getLocale());
            res.send(new ApiResponse(zones, page, pageCount, limit, zonesCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('name.en').not().isEmpty().withMessage(() => { return i18n.__('englishName') }),
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') }),
                body('radius').not().isEmpty().withMessage(() => { return i18n.__('radiusRequired') }),
                body('location').not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
                body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
                body('user').optional().not().isEmpty().withMessage(() => { return i18n.__('userRequired') }),

            ];
        }
        else {
            validations = [

                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') }),
                body('radius').not().isEmpty().withMessage(() => { return i18n.__('radiusRequired') }),
                body('location').not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
                body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),

            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let validatedBody = checkValidations(req);
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                validatedBody.user = user.id;
            }
            console.log(validatedBody.location)
            validatedBody.location = {
                type: 'Point',
                coordinates: [+validatedBody.location.long, +validatedBody.location.lat]
            }
            let createdZone = await Zone.create(validatedBody);
            createdZone = Zone.schema.methods.toJSONLocalizedOnly(createdZone, i18n.getLocale());
            res.status(200).send(createdZone);

        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { zoneId } = req.params;
            let { removeLanguage } = req.query;
            var zone = await checkExistThenGet(zoneId, Zone, { deleted: false });
            if (!removeLanguage) {
                zone = Zone.schema.methods.toJSONLocalizedOnly(zone, i18n.getLocale());
            }
            res.status(200).send(zone);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { zoneId } = req.params;
            let { removeLanguage } = req.query;
            let zone = await checkExistThenGet(zoneId, Zone, { deleted: false });
            var validatedBody = checkValidations(req);

            validatedBody = dotObject.dot(validatedBody);
            let updatedZone = await Zone.findByIdAndUpdate(zoneId, validatedBody, { new: true })
            if (!removeLanguage) {
                updatedZone = Zone.schema.methods.toJSONLocalizedOnly(updatedZone, i18n.getLocale());
            }
            res.status(200).send(updatedZone);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { zoneId } = req.params;
            let zone = await checkExistThenGet(zoneId, Zone, { deleted: false });
            zone.deleted = true;
            await zone.save();
            res.status(200).send('Deleted Successfully');
        }
        catch (err) {
            next(err);
        }
    },
};