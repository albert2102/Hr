import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';
import bcrypt from 'bcryptjs';
import isEmail from 'validator/lib/isEmail';
import mongooseI18n from 'mongoose-i18n-localize'

const userSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        // required: true,
    },
    password: {
        type: String
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        validate: {
            validator: (email) => isEmail(email),
            message: 'Invalid Email Syntax'
        }
    },
    type: {
        type: String,
        enum: ['ADMIN','SUB_ADMIN','CLIENT','INSTITUTION','DRIVER'],
        required: true,
        default:'CLIENT'
    },
    deleted: {
        type: Boolean,
        default: false
    },
    tokens:{
        type:[
            {
                token:{type: String,required: true},
                type:{type:String,required: true,enum:['ios','android','web']}
            }
        ]
    },
    activated :{
        type: Boolean,
        default: true
    },
    rules:{
        type:[Number],
        ref:'assignRule'
    },
    image:{
        type: String
    },
    language:{
        type:String,
        default:'ar',
        enum:['ar','en']
    },
    notification:{
        type:Boolean,
        default:true
    },
    countryCode:{
        type:String,
        default:'20'
    },
    countryKey:{
        type:String,
        default:'EG'
    },
    socialId:{
        type: String
    },
    socialMediaType:{
        type: String,
        enum: ['NORMAL','FACEBOOK','TWITTER','INSTAGRAM','GOOGLE','APPLE'],
        default:'NORMAL'
    },
    country:{
        type: Number,
        ref: 'country'
    },
    city:{
        type: Number,
        ref: 'city'
    },
    activeChatHead:{
        type: Boolean,
        default: false
    },
    category:{
        type: Number,
        ref:'category'
    },
    nationalIdImage:{
        type: String
    },
    frontCarLicenceImage:{
        type: String
    },
    backCarLicenceImage:{
        type: String
    },
    frontDriverLicenceImage:{
        type: String
    },
    backDriverLicenceImage:{
        type: String
    },
    internallyCarImage:{// صورة السيارة داخليا
        type: [String]
    },
    frontCarImage:{// صورة السيارة من الامام
        type: String
    },
    backCarImage:{// صورة السيارة من الخلف
        type: String
    },
    frontCarPlateImage:{// صورة لوحة السيارة مع اللوحة من الامام
        type: String
    },
    backCarPlateImage:{// صورة لوحة السيارة مع اللوحة من الخلف
        type: String
    },
    carPlateWithYouImage:{// صورة لك مع لوحة السيارة 
        type: String
    },
    carInsuranceImage:{// صورة تفويض السيارة
        type: String
    },
    ibanNumber:{
        type: String
    },
    commercialRegister:{
        type: String
    },
    geoLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [30.98758, 30.867589] }
    },
    responsibleName:{
        type: String
    },
    online:{
        type: Boolean,
        default: true
    },
    ajamTaxes:{
        type: Number,
    }

}, { timestamps: true });


userSchema.pre('save', function (next) {
    const account = this;
    if (!account.isModified('password')) return next();
    const salt = bcrypt.genSaltSync();
    bcrypt.hash(account.password, salt).then(hash => {
        account.password = hash;
        next();
    }).catch(err => console.log(err));
});
userSchema.methods.isValidPassword = function (newPassword, callback) {
    let user = this;
    bcrypt.compare(newPassword, user.password, function (err, isMatch) {
        if (err)
            return callback(err);
        callback(null, isMatch);
    });
};

userSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret.password;
        delete ret._id;
        delete ret.__v;
    }
});

autoIncrement.initialize(mongoose.connection);
userSchema.index({ geoLocation: "2dsphere" });
userSchema.plugin(mongooseI18n, {locales: ['en', 'ar']});
userSchema.plugin(autoIncrement.plugin, { model: 'user', startAt: 1 });
export default mongoose.model('user', userSchema);