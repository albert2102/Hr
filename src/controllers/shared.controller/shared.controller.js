import fs from 'fs';
import ApiError from '../../helpers/ApiError';
import { validationResult } from 'express-validator/check';
import { matchedData } from 'express-validator/filter';
import { toImgUrl, toFileUrl } from '../../utils';



function deleteTempImages(req) {
    if (req.files) {
        console.log("req.files.length======", req.files.length)
        if (req.files.length && req.files.length > 0) {
            req.files.forEach(element => {
                fs.unlink(element.path, (err) => {
                    if (err) throw err;
                    console.log('file deleted');
                });
            });
        } else {
            let files = req.files;
            //console.log(files)
            for (var element in files) {

                files['' + element].forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) throw err;
                        console.log('file deleted');
                    });
                });

            };
        }
    }
    if (req.file) {
        fs.unlink(req.file.path, (err) => {
            if (err) throw err;
            console.log('file deleted');
        });
    }
}


export function deleteImages(images) {
    if (images.length && images.length > 0) {
        images.forEach(element => {
            console.log(element)
            if (fs.existsSync('.'+element))
                fs.unlink('.'+element, (err) => {
                    if (err) throw err;
                    console.log('file deleted');
                });
        });
    }
}
export const localeFn = (localeName) => (value, { req }) => req.__(localeName);

export function checkValidations(req) {

    const validationErrors = validationResult(req).array({ onlyFirstError: true });

    if (validationErrors.length > 0) {
        deleteTempImages(req);

        throw new ApiError(422, validationErrors);
    }

    return matchedData(req);
}


export function handleImgs(req, { attributeName = 'images', isUpdate = false } = {}, errMessage = '') {
    if (req.files && req.files.length > 0 || (isUpdate && req.body[attributeName])) { // .files contain an array of 'images'  
        let images = [];
        if (isUpdate && req.body[attributeName]) {
            if (Array.isArray(req.body[attributeName]))
                images = req.body[attributeName];
            else
                images.push(req.body[attributeName]);
        }

        for (const img of req.files) {
            images.push(toImgUrl(req, img));
        }
        return images;
    }
    throw new ApiError.UnprocessableEntity(`${attributeName} are required`) || errMessage;
}

export function handleImg(req, { attributeName = 'img', isUpdate = false } = {}) {
    if (req.file || (isUpdate && req.body[attributeName]))
        return req.body[attributeName] || toImgUrl(req, req.file);

    throw new ApiError.UnprocessableEntity(`${attributeName} is required`);
}

export function handleFiles(req, { attributeName = 'files', isUpdate = false } = {}) {
    if (req.files && req.files.length > 0 || (isUpdate && req.body[attributeName])) {
        let files = [];
        if (isUpdate && req.body[attributeName]) {
            if (Array.isArray(req.body[attributeName]))
                files = req.body[attributeName];
            else
                files.push(req.body[attributeName]);
        }

        for (const file of req.files) {
            files.push(toFileUrl(req, file));
        }
        return files;
    }
    throw new ApiError.UnprocessableEntity(`${attributeName} are required`);
}
export function parseObject(arrayOfFields, update = false, fieldName = 'body') {
    return (req, res, next) => {
        try {
            for (let index = 0; index < arrayOfFields.length; index++) {
                var name = arrayOfFields[index];
                if (req[fieldName][name]) {
                    req[fieldName][name] = JSON.parse(req[fieldName][name]);
                }
            }
            return next()
        } catch (error) {
            return next(error);
        }
    }
}
export function fieldhandleImg(req, { attributeName = 'images', isUpdate = false } = {}) {
    if (req.files && req.files[attributeName].length > 0 || (isUpdate && req.body[attributeName])) { // .files contain an array of 'images'  
        let images = [];
        for (let index = 0; index < req.files[attributeName].length; index++) {
            let image = toImgUrl(req, req.files[attributeName][index]);
            images.push(image);
        }
        return images;
    }
    throw new ApiError.UnprocessableEntity(`${attributeName} are required`);
}

export function removeFile(file = '', files = []) {
    if (files.length > 0) {
        files.forEach(element => {
            fs.unlink(element, (err) => {
                if (err) throw err;
                console.log('file deleted');
            });
        });
    } else {
        fs.unlink(file, (err) => {
            if (err) throw err;
            console.log('file deleted');
        });
    }
}