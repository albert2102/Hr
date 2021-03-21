import mongoose, { Schema } from "mongoose";
import autoIncrement from 'mongoose-auto-increment';
const CreditSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    user: {
        type: Number,
        required: true,
        ref: 'user'
    },
    holder: {
        type: String,
    },
    cardNumber: {
        type: String,
        required: true
    },
    cvc: {
        type: String,
        required: true
    },
    expireDateYear: {
        type: String,
        required: true
    },
    expireDateMonth: {
        type: String,
        required: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    paymentType: {
        type: String,
        enum: ['VISA','MASTERCARD','MADA'],
    },
}, { timestamps: true });

CreditSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
CreditSchema.plugin(autoIncrement.plugin, { model: 'credit', startAt: 1 });

export default mongoose.model('credit', CreditSchema);