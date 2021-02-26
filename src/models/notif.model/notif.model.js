import mongoose, { Schema } from "mongoose";
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18nLocalize from 'mongoose-i18n-localize'

const NotifSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    resource: {
        type: Number,
        ref: 'user'
    },
    target: {
        type: Number,
        ref: 'user'
    },
    description:{
        type:String,
        i18n:true
    },
    subject:{
        type:Number
    },
    subjectType:{
        type:String,
        enum:['USER','CONTACTUS','ADMIN','ORDER','CHANGE_ORDER_STATUS','PROMOCODE','PRODUCT']
    },
    mailType:{
        type:String,
        enum:['CLIENT','DRIVER', 'SPECIFIC','ALL']
    } ,           
    read:{
        type:Boolean,
        default:false
    },
    promoCode:{
        type:Number
    },
    deleted: {
        type: Boolean,
        default: false
    },
    informed : {
        type:[Number]
    },
    type:{
        type:String,
        enum:['USER','USERS','ALL','MAIL','SMS']
    },
    users:{
        type: [Number],
        ref: 'user'
    },
    usersDeleted:{
        type: [Number],
        ref: 'user'
    },
    order:{
        type: Number,
        ref: 'order'
    },
    image:{
        type: String
    }
}, { timestamps: true });

NotifSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
NotifSchema.plugin(autoIncrement.plugin, { model: 'notif', startAt: 1 });
NotifSchema.plugin(mongooseI18nLocalize,{locales:['ar','en']});
export default mongoose.model('notif', NotifSchema);