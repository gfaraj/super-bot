if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

require = require("esm")(module /*, options*/);
module.exports = require("./src/app.js");