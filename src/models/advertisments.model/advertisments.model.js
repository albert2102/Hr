import mongoose, { Schema } from "mongoose";
import autoIncrement from 'mongoose-auto-increment';

const advertismentsSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    images:{
        type:[String]
    },
    address:{
        type: String,
        required: true
    },
    description:{
        type: String,
    },
    phone:{
        type: String
    },
    whatsappNumber:{
        type: String
    },
    contactBy:{
        type: [String],
        enum:['PHONE','CONVERSATION']
    },
    geoLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [30.98758, 30.867589] }
    },
    status:{
        type: String,
        enum:['WAITING','ACCEPTED','REJECTED','DELETED','ENDED','UPDATED','STOPED'],
        default: 'WAITING'
    },
    commetion:{
        type:Number
    },
    user:{
        type: Number,
        ref:'user',
        required: true
    },
    numberOfViews:{
        type: Number,
        default: 0
    },
    price:{
        type: Number,
        default: 100
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedDate:{
        type: Date
    },
    advertisment:{
        type: Number,
        ref:'advertisment'
    },
    endedDate:{
        type: Date
    },
    rejectedReason:{
        type: String
    },
    issuesCount:{
        type: Number,
        default: 0
    }
}, { timestamps: true });

advertismentsSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
advertismentsSchema.index({ geoLocation: "2dsphere" });
advertismentsSchema.plugin(autoIncrement.plugin, { model: 'advertisments', startAt: 1 });
export default mongoose.model('advertisments', advertismentsSchema);