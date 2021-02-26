import mongoose, { Schema } from "mongoose";
import mongooseI18n from 'mongoose-i18n-localize'
import autoIncrement from 'mongoose-auto-increment';
const sliderSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        // required: true,
        i18n: true
    },
    image: {
        type: String,
        required: true
    },
    category:{
        type: Number
    },
    product:{
        type:Number
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

sliderSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
sliderSchema.plugin(mongooseI18n, {locales: ['en', 'ar']});
sliderSchema.plugin(autoIncrement.plugin, { model: 'slider', startAt: 1 });

export default mongoose.model('slider', sliderSchema);