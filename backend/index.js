const port = 4000;
const express = require('express');
// const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer'); //for upload photos
const path = require('path');
const cors = require('cors');//for access and connect frontend to backend
const Stripe = require('stripe');
const bodyParser = require('body-parser');

const app = express();
const stripe = Stripe('sk_test_51PGNc8SGevrr2FinssArXtoDBsVfUorNlQThmTSbEagCdhVLEpKHN0vV6CDYbpSSit6IdjUuebolGEur393uVdLM00BcBp5Ce4');

app.use(bodyParser.json());


app.use(express.json());
app.use(cors());

// Database Connection
const dbURI = "mongodb://127.0.0.1:27017/Ecommerce";
mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("MongoDB connection successful");
}).catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1); // Exit process with failure
});

mongoose.connection.on('connected', () => {
  console.log(`Mongoose connected to ${dbURI}`);
});

mongoose.connection.on('error', (err) => {
  console.error(`Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// API Creation
app.get("/", (req, res) => {
  res.send("Express App is Running");
});

// Image Storage Engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
});

const upload = multer({ storage: storage });

// Creating Upload Endpoint for images
app.use('/images', express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
});

// Schema for creating products

const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required: true,
    },
    name:{
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required: true,
    },
    new_price:{
        type: Number,
        required: true,
    },
    old_price:{
        type: Number,
        required: true,
    },
    Date:{
        type: Date,
        default:Date.now,
    },
    avilable:{
        type: Boolean,
        default:true,
    },
})

app.post('/addproduct',async(req,res)=>{
  let products = await Product.find({}); 
  let id;
  if(products.length>0){
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id+1;
  }
  else{
    id=1;
  }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

// Creating API for deleting product

app.post('/removeproduct',async (req,res)=>{
  await Product.findOneAndDelete({id:req.body.id});
  console.log("Removed");
  res.json({
    success:true,
    name:req.body.name,
  })
})

// Creating API for getting all products
app.get('/allproducts', async (req,res)=>{
  let products = await Product.find({});
  console.log("All Products Fetched");
  res.send(products);
})

//Schema crearing for User MOdel

const Users = mongoose.model('Users',{
  name:{
    type:String,
  },
  email:{
    type:String,
    unique:true,
  },
  password:{
    type:String,
  },
  cartData:{
    type:Object,
  },
  date:{
    type:Date,
    default:Date.now,
  }
})

// Creating endpoint for registering the user
app.post('/signup',async(req,res)=>{

  let check= await Users.findOne({email:req.body.email});
  if(check) {
    return res.status(400).json({success:false,errors:"Exitsting User found with same email address"})
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i]=0;
  }
  const user = new Users({
    name:req.body.username,
    email:req.body.email,
    password:req.body.password,
    cartData:cart,
  })

  await user.save();

  const data = {
    user:{
      id:user.id
    }
  }

  const token = jwt.sign(data,'secret_ecom');
  res.json({success:true,token})
})

// creating endpoint for user login
app.post('/login', async (req, res) => {
  try {
    let user = await Users.findOne({ email: req.body.email });
    console.log("Retrieved user:", user); // Add this line for debugging
    if (user) {
      const passCompare = req.body.password === user.password;
      console.log("Password comparison result:", passCompare); // Add this line for debugging
      if (passCompare) {
        const data = {
          user: {
            id: user.id
          }
        }
        const token = jwt.sign(data, 'secret_ecom');
        console.log("Login successful. Token generated:", token); // Add this line for debugging
        res.json({ success: true, token });
      } else {
        console.log("Wrong password provided."); // Add this line for debugging
        res.json({ success: false, errors: "Wrong Password" });
      }
    } else {
      console.log("User not found."); // Add this line for debugging
      res.json({ success: false, errors: "Wrong Email Id" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, errors: "Internal Server Error" });
  }
});
// creating endpoint for thr newcollection data

app.get('/newcollections',async (req,res)=>{
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("NewCollection Fetched");
  res.send(newcollection);
})

// Payment Gateway
app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
// creating endpoint for popular in women section

app.get('/popularinwomen',async (req,res)=>{
  let products = await Product.find({category:'women'});
  let popular_in_women = products.slice(0,4);
  console.log("Popular in women Fetched");
  res.send(popular_in_women)
})
// creaing middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) {
    return res.status(401).send({ errors: "Please authenticate using valid token" });
  } 
  try {
    const data = jwt.verify(token, 'secret_ecom');
    req.user = data.user;
    next();
  } catch (error) {
    return res.status(401).send({ errors: 'Please authenticate using a valid token' });
  }
};


// Endpoint for adding products to cart
app.post('/addtocart', fetchUser, async (req, res) => {  
  console.log("Added",req.body.itemId);
  let userData = await Users.findOne({_id:req.user.id});
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send('Added')

});

//// creating endpoint to remove product from cartdat
app.post('/removefromcart',fetchUser,async (req,res)=>{
  console.log("removed",req.body.itemId);
  let userData = await Users.findOne({_id:req.user.id});
  if(userData.cartData[req.body.itemId]>0)
  userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
  res.send('Removed')
})
//creating endpoint to get data from cartdata
app.post('/getcart', fetchUser, async (req, res) => {
  try {
      // Find the user in the database
      let userData = await Users.findOne({ _id: req.user.id });

      if (!userData) {
          return res.status(404).send({ error: 'User not found' });
      }

      // Return the cart data
      res.json(userData.cartData);
  } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).send({ error: 'Internal Server Error' });
  }
});


// app.listen(5000, () => console.log('Server is running on port 5000'));

app.listen(port, (error) => {
  if (!error) {
    console.log("Server Running " + port);
  } else {
    console.log("Error: " + error);
  }
});
