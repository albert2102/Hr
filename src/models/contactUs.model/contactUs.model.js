import mongoose, { Schema } from "mongoose";
import autoIncrement from 'mongoose-auto-increment';

const contactUsSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name:{
        type: String
    },
    email: {
        type: String
    },
    notes: {
        type: String,
        required:true
    },
    phone: {
        type: String,
        required:true
    },
    reply:[String],

    user:{
        type:Number
    },
    deleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

contactUsSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
contactUsSchema.plugin(autoIncrement.plugin, { model: 'contactUs', startAt: 1 });
export default mongoose.model('contactUs', contactUsSchema);