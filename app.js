require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const ejs=require("ejs");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const flash = require("connect-flash");

const bcrypt = require("bcryptjs")
const session = require("express-session");
const passport = require("passport");

const app = express();

require("./config/passport")(passport);

const db= require("./config/keys.js").MongoURI;
//app.use(expressLayouts);
app.set('view engine', 'ejs');

app.use(express.static("public"));

app.use(bodyParser.urlencoded({extended: true}));
const secret=process.env.SECRET;

app.use(session({
  secret: process.env.SECRET,
  resave: true,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());


app.use((req,res,next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
})




mongoose.connect(db)
// .then(() => console.log("alll ok"))
// .catch(err => console.log(err));

const User = require("./models/User.js")

const defaultItems = ["Welcome to your todo list",
 "Press enter to add an item",
  "<-- click this to delete an item"];

let today = new Date();
let options = {
  weekday: "long",
  day: "numeric",
  month: "long"
};
let day = today.toLocaleDateString("en-US",options);

app.get("/",function(req,res){
  res.render("login");
});

app.get("/login",function(req,res){
  res.render("login");
});

app.get("/email-check", function(req,res){
  res.render("email-check");
})


app.get("/signup",function(req,res){
  res.render("signup");
});

const {ensureAuthenticated} = require("./config/auth.js");

app.get("/todo",ensureAuthenticated,(req,res) => {
  const thisEmail = req.user.email;
  User.findOne({email: thisEmail}, function(err, foundUser){
    if(!err){
      res.render("todo",{
        listItems:foundUser.lists, listTitle: day,userEmail: thisEmail
      })
    }
  })

});



app.post("/todo", function(req,res){
  const itemName = req.body.newItem;
  const thisEmail = req.body.btn;
  User.findOne({email:thisEmail}, async function(err,foundUser){
    if(err){
      console.log(err);
    } else{
      if(itemName === ""){
        res.redirect("/todo");
      }else{
        foundUser.lists.push(itemName);
        await foundUser.save();
        res.redirect("/todo");
      }

    }
  })
})

app.post("/delete", function(req,res){
  const userEmail = req.body.userEmail;
  const deleteItem = req.body.checkbox;
  // console.log(userEmail, deleteItem);

  User.findOneAndUpdate({email: userEmail}, {$pull:{lists:deleteItem}}, function(err,foundItem){
    if(!err){
      res.redirect("/todo");
    }
  });

})

app.post("/login", (req,res, next) => {
  passport.authenticate("local", {
    successRedirect: "/todo",
    failureRedirect: "/login",
    failureFlash: true
  })(req,res,next);
});



app.post("/signup",function(req,res){
  const{ username, email, password, cpassword }= req.body;
  let errors = [];
  if(!username || !email || !password || !cpassword){
    errors.push({msg: 'Please fill in all fields' });
    // console.log("required");
  }

  if(password !== cpassword){
    errors.push({msg: "Passwords do not match"});
  }

  if(password.length<8){
    errors.push({msg: "Password should be atleast 8 characters"});
  }

  if(errors.length>0){
    res.render("signup",{
      errors,username,email,password,cpassword
    });
  }else{
    User.findOne({email:email})
    .then(user => {
      if(user){
        errors.push({msg:"Email is already registered"})
        res.render("signup",{
          errors,username,email,password,cpassword
        });
      } else{
        const newUser = new User({
          "username" : username,
          "email" : email,
          "password" : password,
          "lists" : defaultItems
        });

        bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(newUser.password, salt, (err, hash) =>{
          if(err) throw err;
          newUser.password = hash;
          newUser.save()
           .then(user => {
             req.flash("success_msg","successfully registered. Please login");
             res.redirect("/login");
           })
           .catch(err => console.log(err));

        }))
      }
    });
  }
});

app.get("/reset-password", function(req,res){
  res.render("reset-password");
})


app.post("/email-check", function(req,res){
  const resetEmail = req.body.resetEmail;
  let errorss=[];
  User.findOne({email:resetEmail},function(err,foundUser){
    if(err){
      console.log(err);
    } else{
      if(!foundUser){
        errorss.push({msg: 'Incorrect Emailid' });
      }
      if(errorss.length>0){
        res.render("email-check",{
          errorss
        });
      } else{
        // console.log("done");
        res.render("reset-password",{resetEmail:resetEmail});

      }
    }
  })
})


app.post("/reset-password", function(req,res){
  let errors2=[]
  const pwd = req.body.pwd;
  const cpwd = req.body.cpwd;
  const thisEmail = req.body.email;
  // console.log(thisEmail);
  if(!pwd || !cpwd){
    errors2.push({msg: 'Please fill in all fields' });
  }
  if(pwd != cpwd){
    errors2.push({msg: 'Passwords do not match' });
  }
  if(pwd.length<8){
    errors2.push({msg: "Password should be atleast 8 characters"});
  }

  if(errors2.length>0){
    res.render("reset-password",{
      errors2,pwd,cpwd, resetEmail:thisEmail
    });
  } else{
    User.findOne({email:thisEmail},async function(err,foundUser){
      if(err){
        console.log(err);
      } else{



        bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(pwd, salt, (err, hash) =>{
          if(err) throw err;
          foundUser.password = hash;
          foundUser.save()
           .then(user => {
             req.flash("success_msg","Password changed.You can now log in with your new password!");
             res.redirect("/login");
           })
           .catch(err => console.log(err));

        }))

        // User.updateOne({email:thisEmail},{$set: {"password":"qwertyui"} } ,function(err){
        //   if(err){
        //     console.log(err);
        //   } else{
        //     console.log("successfully changed");
        //   }
        // })
      }
    })
    // console.log("all set");
  }
})





const PORT = process.env.PORT || 3000;
app.listen(PORT,function(){
  console.log("server is running on port 3000");
});


// dc8e52e9e6f98020e9938780281fed1c-us14

// db59a4a61d
