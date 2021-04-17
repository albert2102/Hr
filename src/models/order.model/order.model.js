import mongoose, { Schema } from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';

let productSchema = new Schema({
    product: { type: Number},
    category : { type: Number },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    offer: { type: Number },
    priceAfterOffer: { type: Number }
});

let coordinateSchema = new Schema({
    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },
    address: { type: String, default: 'El-Haram streat' }
});


const orderSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    user: {
        type: Number,
        ref: 'user',
        required: true
    },
    driver:{
        type: Number,
        ref: 'user'
    },
    products: {
        type: [productSchema]
    },
    lastLocation: {
        type: coordinateSchema
    },
    promoCode: {
        type: Number,
        ref: 'promocode'
    },
    paymentMethod: {
        type: String,
        enum: ['DIGITAL','WALLET','CASH']
    },
    status: {
        type: String,
        enum: ['WAITING','ACCEPTED','DRIVER_ACCEPTED','REJECTED', 'CANCELED', 'SHIPPED', 'DELIVERED','NOT_ASSIGN'],
        default: 'WAITING'
    },
    price: {
        type: Number
    },
    totalPrice: {
        type: Number
    },
    deliveredDate: {
        type: Date
    },
    orderNumber: {
        type: String,
        required: true
    },
    adminInformed: {
        type: Boolean,
        default: false
    },
    transportPrice:{
        type: Number
    },
    taxes:{
        type: Number
    },
    orderType:{
        type: String,
        enum:['DELIVERY','FROM_STORE']
    },
    durationDelivery:{ // second
        type: Number
    },
    discountValue:{
        type: Number
    },
    trader:{
        type: Number,
        ref :'user'
    },
    rejectReason:{
        type: String
    },
    rejectedDrivers:{
        type: [Number]
    }
}, { timestamps: true });
orderSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
orderSchema.plugin(autoIncrement.plugin, { model: 'order', startAt: 1 });
orderSchema.plugin(mongooseI18n, { locales: ['ar', 'en'] });

export default mongoose.model('order', orderSchema);