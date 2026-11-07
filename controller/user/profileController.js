const { STATUS_CODE } = require("../../constants/StatusCode");
const { COMMON_MESSAGES } = require("../../constants/messages/CommonMessages");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema")

const nodemailer = require('nodemailer')
const bcrypt = require("bcrypt")
const env = require('dotenv').config
const session = require("express-session")

function generateOtp() {
   return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendVerificationEmail = async (email, otp) => {
   try {
      // Validate email and OTP
      if (!email || !otp) {
         throw new Error("Invalid email or OTP");
      }

      const transporter = nodemailer.createTransport({
         host: 'smtp.gmail.com',
         port: 587,
         secure: false, // true for port 465, false for 587
         requireTLS: true,
         auth: {
            user: process.env.NODEMAILER_EMAIL,
            pass: process.env.NODEMAILER_PASSWORD, // Use app-specific password for Gmail
         },
      });

      const info = await transporter.sendMail({
         from: process.env.NODEMAILER_EMAIL,
         to: email,
         subject: 'Verify your Email',
         text: `Your OTP is ${otp}`,
         html: `<b>Your OTP: ${otp}</b>`,
      });

      if (info.accepted.length > 0) {
         console.log(`Verification email sent successfully to ${email}`);
         return { success: true, message: COMMON_MESSAGES.EMAIL_SENT_SUCCESSFULLY };
      } else {
         console.warn(`${COMMON_MESSAGES.FAILED_TO_SEND_VERIFICATION_EMAIL_TO} ${email}`);
         return { success: false, message: COMMON_MESSAGES.EMAIL_NOT_ACCEPTED_BY_RECIPIENT_SERVER };
      }
   } catch (error) {
      console.error(COMMON_MESSAGES.ERROR_IN_SENDING_VERIFICATION_OTP_EMAIL, {
         message: error.message,
         stack: error.stack,
      });
      return { success: false, message: error.message }; // Return detailed error message
   }
};

const securePassword = async (password) => {
   try {
      const passwordHash = await bcrypt.hash(password, 10)
      return passwordHash
   } catch (error) {
      console.log(COMMON_MESSAGES.PASSWORD_HASHING_ERROR)
   }
}

const getForgotPassWordPage = async (req, res) => {
   try {
      res.render("auth/forgot-password-page")
   } catch (error) {
      console.log(COMMON_MESSAGES.GETFORGOTPASSWORDPAGE_ERROR, error)
      res.redirect("auth/pageNotFound")
   }
};

const forgotEmailVarifiation = async (req, res) => {
   try {
      const email = req.body.email;
      const findUser = await User.findOne({ email: email })

      if (findUser) {
         const otp = generateOtp();
         // otp in forgotEmailVarifiation, otp);
         const emailSent = await sendVerificationEmail(email, otp);
         if (emailSent) {
            req.session.userOtp = otp;
            req.session.email = email;
            res.json({
               success: true,
               message: COMMON_MESSAGES.OTP_SENT_SUCCESSFULLY_PLEASE_VERIFY,
               redirectUrl: '/Verify-OTP-page'
            });
         } else {
            res.json({ success: false, message: COMMON_MESSAGES.FAILED_TO_SEND_OTP_PLEASE_TRY_AGAIN })
         }
      } else {
         res.render("auth/forgot-password-page", {
            message: COMMON_MESSAGES.USER_WITH_THIS_EMAIL_DOES_NOT_EXIST
         })
      }

   } catch (error) {
      res.redirect("pageNotFound")
   }
}

const getVerifyOTPPage = async (req, res) => {
   try {
      res.render("auth/forgot-Verify-Otp")
   } catch (error) {

   }
}

const verifyOtp = async (req, res) => {
   try {
      const otp = req.body.otp
      if (otp === req.session.userOtp) {
         res.json({ success: true, redirectUrl: "/reset-password" })
      } else {
         res.json({ success: false, message: COMMON_MESSAGES.OTP_NOT_MATCHING });
      }
   } catch (error) {
      res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.AN_ERROR_OCCURED_PLEASE_TRY_AGAIN });
   }
}

const resendOtp = async (req, res) => {
   try {

      const otp = generateOtp();
      req.session.userOtp = otp;
      const email = req.session.email;
      console.log(`resend OTP :${otp} to ${email}`);
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
         res.status(STATUS_CODE.OK).json({ success: true, message: COMMON_MESSAGES.OTP_RESENT_SUCCESSFULLY })
      }
   } catch (error) {
      console.log(COMMON_MESSAGES.ERROR_IN_RESEND_OTP, error);
      res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.INTERNEL_SERVER_ERROR })

   }
}

const getResetPassword = async (req, res) => {
   try {
      res.render("profile/reset-password")
   } catch (error) {
      res.redirect("/pageNotFound")
   }
}

const resetPassword = async (req, res) => {
   try {
      const { password, confirmPassword } = req.body;
      const email = req.session.email;

      if (password === confirmPassword) {
         const passwordHash = await securePassword(password)
         await User.updateOne(
            { email: email },
            { $set: { password: passwordHash } }
         )
         res.redirect("/login");
      } else {
         res.render("profile/reset-password", { message: COMMON_MESSAGES.PASSWORD_DOES_NOT_MATCH })
      }

   } catch (error) {
      console.log(COMMON_MESSAGES.ERROR_OCCURED_AT_RESETPASSWORD_FUNCTION, error);
      res.redirect("/pageNotFound")
   }
}

const userProfile = async (req, res) => {
   try {
      // Session User:, req.session.user);
      const userId = req.session.user;

      const userData = await User.findById(userId);

      if (!userData) {
         console.error(COMMON_MESSAGES.USER_NOT_FOUND_FOR_ID, userId);
         return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.USER_NOT_FOUND });
      }

      if (!userData.wallet) {
         userData.wallet = { balance: 0, transactions: [] };
         await userData.save();
         // Wallet created for user:, userId);
      }

      const addressData = await Address.findOne({ userId: userId });

      const orderData = await Order.find({ userId: userId }).populate("items.productId").sort({ createdAt: -1 });

      const walletHistory = userData.wallet.transactions || [];

      // userData, userData);
      // orderData, orderData);
      // walletHistory, walletHistory);

      res.render("profile/profile-page", {
         user: userData,
         addresses: addressData ? addressData.address : [],
         orders: orderData || [],
         walletHistory: walletHistory,
      })

   } catch (error) {
      console.error(COMMON_MESSAGES.ERROR_RETRIEVING_PROFILE_DATA, error);
      res.redirect("/pageNotFound");
   }
};

const editProfile = async (req, res) => {
   try {

      const userId = req.session.user;
      const { name, phone } = req.body;

      if (!userId) {
         return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.USER_NOT_FOUND_3 });
      }

      if (!name || !phone) {
         return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.NAME_AND_PHONE_MUST_NOT_BE_EMPTY });
      }

      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
         return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.PHONE_NUMBER_MUST_BE_A_VALID_10_DIGIT_NUMBER });
      }

      const user = await User.findOneAndUpdate(
         { _id: userId },
         { $set: { name: name.trim(), phone: phone.trim() } },
         { new: true }
      );

      if (!user) {
         return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.USER_NOT_FOUND_OR_UPDATE_FAILED });
      }

      return res.status(STATUS_CODE.OK).json({
         message: COMMON_MESSAGES.PROFILE_UPDATED_SUCCESSFULLY,
         user,
      });

   } catch (error) {
      console.error(COMMON_MESSAGES.ERROR_UPDATING_PROFILE, error);

      return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.AN_INTERNAL_SERVER_ERROR_OCCURRED_PLEASE_TRY_AGAIN_LATER });
   }
};

const changePassword = async (req, res) => {
   try {
      const userId = req.query.id
      const { currPassword, password, confirmPassword } = req.body

      if (!currPassword || !password || !confirmPassword) {
         return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.ALL_FIELDS_ARE_REQUIRED });
      }

      if (password !== confirmPassword) {
         return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.PASSWORDS_DO_NOT_MATCH });
      }

      const user = await User.findById(userId);
      if (!user) {
         return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.USER_NOT_FOUND });
      }

      const isMatch = await bcrypt.compare(currPassword, user.password);
      if (!isMatch) {
         return res.status(STATUS_CODE.UNAUTHORIZED).json({ success: false, message: COMMON_MESSAGES.CURRENT_PASSWORD_IS_INCORRECT });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user.password = hashedPassword;
      await user.save();

      res.status(STATUS_CODE.OK).json({ success: true, message: COMMON_MESSAGES.PASSWORD_UPDATED_SUCCESSFULLY });

   } catch (error) {

      console.error(COMMON_MESSAGES.ERROR_CHANGING_PASSWORD, error);
      res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR_2 });

   }
}

const getAddAddress = async (req, res) => {
   try {
      const user = req.session.user;
      const { redirectTo } = req.query
      res.render("profile/user-address", { user: user, redirectTo })

   } catch (error) {
      res.redirect("/pageNotFound")
   }
}

const addAddress = async (req, res) => {
   try {
      const userId = req.session.user
      const userData = await User.findOne({ _id: userId });
      const { addressType, name, city, landMark, state, pincode, phone, altPhone, redirectTo } = req.body
      const userAddress = await Address.findOne({ userId: userData._id });

      if (!userAddress) {
         const newAddress = new Address({
            userId: userData._id,
            address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
         })
         await newAddress.save();
      } else {
         userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
         await userAddress.save();
      }

      if (redirectTo == "checkout") {
         return res.redirect("/checkout");
      } else {
         return res.redirect("/userProfile");
      }

   } catch (error) {
      console.error(COMMON_MESSAGES.ERROR_ADDING_ADDRESS, error);
      res.redirect("/pageNotFound");
   }
}

const getEditAddress = async (req, res) => {
   try {
      const addressId = req.query.id;
      const user = req.session.user;
      const currentAddress = await Address.findOne({
         "address._id": addressId,
      });

      if (!currentAddress) {
         return res.redirect('/pageNotFound');
      }

      const addressData = currentAddress.address.find((item) => {
         return item._id.toString() === addressId.toString();
      })

      if (!addressData) {
         return res.redirect('/pageNotFound')
      }

      res.render("profile/edit-address", { address: addressData, user: user })

   } catch (error) {
      console.log(COMMON_MESSAGES.ERROR_ON_GETEDITADDRESS_FUNCTION, error);
      res.redirect("/pageNotFound")

   }
}

const editAddress = async (req, res) => {
   try {
      const data = req.body;
      const addressId = req.query.id
      const user = req.session.user;

      const findAddress = await Address.findOne({ "address._id": addressId })
      if (!findAddress) {
         res.redirect("/pageNotFound");
      }
      await Address.updateOne(
         { "address._id": addressId },
         {
            $set: {
               "address.$": {
                  _id: addressId,
                  addressType: data.addressType,
                  name: data.name,
                  city: data.city,
                  landMark: data.landMark,
                  state: data.state,
                  pincode: data.pincode,
                  phone: data.phone,
                  altPhone: data.altPhone
               }
            }
         }
      )

      res.redirect("/userProfile");
   } catch (error) {
      console.log(COMMON_MESSAGES.ERROR_IN_EDITADDRESS_FUNCTION, error);
      res.redirect("/pageNotFound")

   }
}

const deleteAddress = async (req, res) => {
   try {

      const addressId = req.query.id;
      const findAddress = await Address.findOne({ "address._id": addressId })
      if (!findAddress) {
         return res.status(STATUS_CODE.NOT_FOUND).send(COMMON_MESSAGES.ADDRESS_NOT_FOUND)
      }

      await Address.updateOne(
         { "address._id": addressId },
         { $pull: { address: { _id: addressId } } }
      )

      res.redirect("/userProfile")

   } catch (error) {
      console.error(COMMON_MESSAGES.ERROR_IN_DELETEADDRESS_FUNCTION, error);
      res.redirect("/pageNotFound")
   }

}

module.exports = {
   getForgotPassWordPage,
   forgotEmailVarifiation,
   getVerifyOTPPage,
   verifyOtp,
   getResetPassword,
   resendOtp,
   resetPassword,
   userProfile,
   editProfile,
   changePassword,
   getAddAddress,
   addAddress,
   getEditAddress,
   editAddress,
   deleteAddress
}