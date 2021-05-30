import mongoose, { Schema } from "mongoose";
import mongooseI18n from 'mongoose-i18n-localize'
import autoIncrement from 'mongoose-auto-increment';



const productSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    productCategory:{
        type:Number,
        ref:'productCategory'
    },
    name: {
        type: String,
        i18n: true
    },
    description: {
        type: String,
        i18n: true
    },
    price: {
        type: Number,
        required: true
    },
    slider: [String],
    image: {
        type: String,
        //required: true
    },
    trader:{
        type:Number,
        ref:'user'
    },
    createdBy:{
        type:Number,
        ref:'user'
    },
    favorite: {
        type: Boolean,
        default: false
    },
    taxes:{
        type: Number,
        //default: 5
    },

    ////////////////////////////////////////////////// adds data
    addContuctNumber:{
        type:String
    },
    addWhatsAppNumber:{
        type:String
    },
    contuctBy:{
        type:String,
        enum:['WHATSAPP','CONVERSATION']
    },
    location:{
        address:String,
        longtude:String,
        latitude:String
    },

////////////////////////////////////////////////////////
    offer: {
        type: Number,
        default: 0
    },
    deleted: {
        type: Boolean,
        default: false
    },
    useStatus:{
        type: String,
        enum:['USED','NEW'],
        //required: true
    }
}, { timestamps: true });

productSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
productSchema.plugin(mongooseI18n, { locales: ['en', 'ar'] });
productSchema.plugin(autoIncrement.plugin, { model: 'product', startAt: 1 });

export default mongoose.model('product', productSchema);