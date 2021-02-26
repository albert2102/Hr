import mongoose, { Schema } from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const rateSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    user: {
        type: Number,
        required: true,
        ref: 'user'
    },
    product: {
        type: Number,
        required: true,
        ref: 'product'
    },
    rate: {
        type: Number,
        required: true
    },
    deleted:{
        type: Boolean,
        default: false
    }

}, { timestamps: true });

rateSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

rateSchema.plugin(autoIncrement.plugin, { model: 'rate', startAt: 1 });
rateSchema.plugin(mongooseI18n, { locales: ['ar', 'en'] });

export default mongoose.model('rate', rateSchema);