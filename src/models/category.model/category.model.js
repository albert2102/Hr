import mongoose, { Schema } from "mongoose";
import mongooseI18n from 'mongoose-i18n-localize'
import autoIncrement from 'mongoose-auto-increment';
const CategorySchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        // required: true,
        i18n: true
    },
    icon:{
        type: String,
        // required: true,
    },
    parent:{
        type: Number,
        ref: 'category'
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

CategorySchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
CategorySchema.plugin(mongooseI18n, {locales: ['en', 'ar']});
CategorySchema.plugin(autoIncrement.plugin, { model: 'category', startAt: 1 });

export default mongoose.model('category', CategorySchema);