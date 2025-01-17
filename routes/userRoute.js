const express = require("express");
const puppeteer = require('puppeteer');
const User = require("../models/userModel");
const session = require("express-session");
const randomstring = require("randomstring");
const bcypt = require('bcrypt');
const cors = require("cors");
const app = express.Router();
const saltRounds = 10;
const { tokenSign, tokenVerify } = require('../jwt');



// Not using session anymore since session is not storing the captcha(Showing errors)
// const secretKey = randomstring.generate({
//   length: 32, // You can adjust the length of the secret key as needed
//   charset: "alphanumeric",
// });
// app.use(cors());
// app.use(
//   session({
//     secret: secretKey,
//     resave: false,
//     saveUninitialized: true,
//   })
// );

function generateCaptcha() {
  return randomstring.generate({
    length: 6,
    charset: "alphanumeric",
  });
}

let storedCaptcha = ''
app.get("/captcha", (req, res) => {
  const captcha = generateCaptcha();
  storedCaptcha = captcha
  res.send(captcha);
});

app.get('/screenshot', async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const response = await page.goto(`https://www.linkedin.com/in/${req.query.username}`);

  res.end(await response.text());

  await browser.close();
})


// Create endpoints
app.post("/login", async (request, response) => {
  const userInput = request.body.captchaInput;

  if (userInput === storedCaptcha) {
    try {
      const result = await User.findOne({
        username: request.body.username
      });

      if (result) {
        const passwordDecode = await bcypt.compare(request.body.password, result.password);
        if (passwordDecode) {
          const token = await tokenSign(result)
          response.send(token).status(201);
        } else {
          response.status(400).json("Login failed");
        }
      } else {
        response.status(400).json("Login failed");
      }
    } catch (error) {
      response.status(400).json(error);
    }
  } else {
    response.status(400).json("Invalid CAPTCHA");
  }
});


app.post("/register", async (request, response) => {
  const userInput = request.body.captchaInput;

  if (userInput === storedCaptcha) {
    try {
      const result = await User.findOne({
        username: request.body.username,
      });

      if (result) {
        response.status(400).json("User already exists");
      } else {
        if (request.body.password === request.body.confirmPassword) {
          const genSalt = await bcypt.genSalt(saltRounds);
          const hashPassword = await bcypt.hash(request.body.password, genSalt);
          request.body.password = hashPassword;
          const newUser = new User(request.body);
          await newUser.save();

          response.send(newUser);
        } else {
          response.status(400).json("Passwords do not match");
        }
      }
    } catch (error) {
      response.status(400).json(error);
    }
  } else {
    response.status(400).json("Invalid CAPTCHA");
  }
});


app.post("/update", tokenVerify, async (request, response) => {
  try {
    const userId = req.user._id;
    const user = await User.findOneAndUpdate({ _id: userId }, request.body, { new: true });
    response.send(user);
  } catch (error) {
    response.status(400).json(error);
  }
});

module.exports = app;
