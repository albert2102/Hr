import mongoose,{ Schema} from "mongoose";
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18nLocalize from "mongoose-i18n-localize";
const issueSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    advertisment:{
        type:Number,
        ref:'advertisment'
    },
    user:{
        type:Number,
        ref:'user'
    },
    deleted:{
        type:Boolean,
        default:false
    },
    text:{
        type: String
    },
    adminSeen:{
        type:Boolean,
        default:false
    },
}, { timestamps: true});

issueSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
autoIncrement.initialize(mongoose.connection);
issueSchema.plugin(autoIncrement.plugin, { model: 'issue', startAt: 1 });
issueSchema.plugin(mongooseI18nLocalize,{locales:['ar','en']});

export default mongoose.model('issue', issueSchema);