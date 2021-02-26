import multer from 'multer';
import path from 'path';
import mkdirp from 'mkdirp';
import ApiError from '../helpers/ApiError';
import mime from 'mime';
import uuidv4 from 'uuid/v4';

const fileFilter = (req, file, cb) => {

    // const filetypes = /jpeg|jpg|png|image\/\*/;
    // const mimetype = filetypes.test(file.mimetype);
    // const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    // if (mimetype && extname) {
    //     return cb(null, true);
    // }

    // cb(new ApiError.UnprocessableEntity('File upload only supports images types'));
    return cb(null, true);
};

export function multerSaveTo(folderName) {

    let storage = multer.diskStorage({
        destination: function (req, file, cb) {
            //console.log(file)
            //console.log("file in mulllllllllllllllllllllllllllllllllllllllllllllllllllllrt")
            let dest =  'uploads/'+folderName;
            mkdirp(dest, function (err) {
                if (err)
                    return cb(new ApiError(500, 'Couldn\'t create dest'));
                cb(null, dest);
            });
        },
        filename: function (req, file, cb) {
            //console.log(file)
            //console.log("file in fileeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeename")
            if(!file.originalname.includes('.')){
                var extension = file.mimetype.split('/')[1];
                file.originalname = file.originalname +'.'+extension;
            }
            cb(null, uuidv4() + path.extname(file.originalname));
        }
    });

    return multer({
        storage ,
        //fileFilter,
        limits: {
            fieldNameSize: 1024 * 1024 * 10,
            fieldSize: 1024 * 1024 * 50, // limit 10mb
        }
    });
}