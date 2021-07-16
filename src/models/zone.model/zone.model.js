import mongoose, { Schema } from 'mongoose';
import autoIncrement from 'mongoose-auto-increment';
import mongooseI18n from 'mongoose-i18n-localize'

const zoneSchema = new Schema({
    _id: {
        type: Number,
        required: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    name:{
        type: String,
        i18n: true
    },
    location: {
        type: {type: String,default: 'Point'},
        coordinates: [Number]
    },
    radius: {
        type: Number /// in meters
    },
    user:{
        type: Number
    }
}, { timestamps: true });

zoneSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret.password;
        delete ret._id;
        delete ret.__v;
    }
});

autoIncrement.initialize(mongoose.connection);
zoneSchema.index({ location: "2dsphere" });
zoneSchema.plugin(mongooseI18n, { locales: ['en', 'ar'] });
zoneSchema.plugin(autoIncrement.plugin, { model: 'zone', startAt: 1 });
export default mongoose.model('zone', zoneSchema);