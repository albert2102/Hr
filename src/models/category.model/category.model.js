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
    images:{
        type: String,
        // required: true,
    },
    image:{
        type: String,
        // required: true,
    },
    slider:{
        type: [String]
    },
    hasChild:{
        type: Boolean
    },
    parent:{
        type: Number,
        ref: 'category'
    },
    deleted: {
        type: Boolean,
        default: false
    },
    type:{
        type: String,
        enum: ['FIRST_CATEGORY','SECOND_CATEGORY','THIRD_CATEGORY']
    }
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