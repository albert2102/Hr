import mongoose,{ Schema} from "mongoose";
import mongooseI18n from "mongoose-i18n-localize";
import autoIncrement from 'mongoose-auto-increment';
const complaintSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    name:{
        type:String,
        // required:true,
    },
    user:{
        type: Number,
        // required: true,
        ref:'user'
    },
    firebaseToken:{
        type:String
    },
    title:{
        type: String,
        required: true
    },
    number:{
        type: String,
        // required: true
    },
    // status:{
    //     type: String,
    //     enum:['WAITING','RESPONDING','ANSWERED'],
    //     default: 'WAITING'
    // },
    respondingBy:{
        type: String,
        ref:'user'
    },
    notes:{
        type: String
    },
    deleted:{
        type:Boolean,
        default:false
    },
    adminInformed: {
        type: Boolean,
        default: false
    },
       
}, { timestamps: true });

complaintSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);

complaintSchema.plugin(autoIncrement.plugin, { model: 'complaint', startAt: 1 });
complaintSchema.plugin(mongooseI18n, { locales:['ar','en'] });

export default mongoose.model('complaint', complaintSchema);