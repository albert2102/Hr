import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18n from 'mongoose-i18n-localize'

const promocodeSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    numberOfUse: {
        type: Number,
        required: true
    },
    promoCodeType: {
        type: String,
        enum: ['RATIO', 'VALUE'],
        default: 'VALUE'
    },
    usersType: {
        type: String,
        enum: ['SPECIFIC', 'ALL'],
        default: 'ALL'
    },
    users: {
        type: [Number],
        ref: 'user'
    },
    deleted: {
        type: Boolean,
        default: false
    },
    promoCodeOn: {
        type: String,
        enum: ['TRANSPORTATION', 'PRODUCTS','ALL'],
        default: 'ALL'
    },
    maxAmount:{
        type: Number
    },
    deletedDate:{
        type: Date
    },
    country:{
        type: Number
    }
}, { timestamps: true });

promocodeSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
promocodeSchema.plugin(autoIncrement.plugin, { model: 'promocode', startAt: 1 });
promocodeSchema.plugin(mongooseI18n, {locales: ['en', 'ar']});

export default mongoose.model('promocode', promocodeSchema);