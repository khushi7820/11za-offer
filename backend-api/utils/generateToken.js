const jwt = require("jsonwebtoken");

const generateToken = (vendor) => {
  return jwt.sign(
    {
      id: vendor.id,
      email: vendor.email,
      role: vendor.role || "vendor"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};

module.exports = generateToken;
