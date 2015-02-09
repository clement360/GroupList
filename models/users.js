var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
  name: String,
  color: String
});

mongoose.model('users', userSchema);
