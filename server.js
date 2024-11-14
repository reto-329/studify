require('dotenv').config();
const express = require("express"),
    ejs = require("ejs"),
    mongoose = require("mongoose"),
    multer = require("multer"),
    session = require('express-session'),
    bcrypt = require("bcryptjs"),
    fs = require("fs"),
    nodemailer = require('nodemailer'),
    flash = require('connect-flash'),
    path = require("path"),
    MongoStore = require('connect-mongo'), // moved to ensure it's accessible here
    app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Database connection
const mongoDBUri = process.env.MONGODB_URI || "mongodb+srv://reromotabele4love:CHaysbv5o9vMd0h8@cluster0.eixnu.mongodb.net/studify-app";
console.log("MongoDB URI:", mongoDBUri);

mongoose.connect(mongoDBUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch((error) => console.error("Error connecting to MongoDB Atlas:", error));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mysecretkey',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: mongoDBUri
    })
}));

// Defining tutor and student schemas
const tutorSchema = new mongoose.Schema({
    fullName: String,
    phoneNumber: String,
    email: String,
    subjects: String,
    tutoringMode: String,
    qualifications: String,
    location: String,
    availability: [String],
    experience: String,
    username: String,
    password: String,
    profilePicture: {
        data: Buffer,
        contentType: String
    },
    dateRegistered: {
        type: Date,
        default: Date.now
    }
});

const studentSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    phoneNumber: String,
    subjectsOfInterest: String,
    studyMode: String,
    location: String,
    availability: [String],
    username: String,
    password: String,
    dateRegistered: {
        type: Date,
        default: Date.now
    }
});

const studyGroupSchema = new mongoose.Schema({
    groupName: String,
    subjects: [String],
    capacity: Number,
    tutorName: String,
    description: String,
    availability: [String],
    password: String,
    groupProfilePicture: {
        data: Buffer,
        contentType: String
    },
    dateCreated: {
        type: Date,
        default: Date.now
    }
});

app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.sendFile(filePath);
});


const StudyGroup = mongoose.model("StudyGroup", studyGroupSchema);
const Tutor = mongoose.model("Tutor", tutorSchema);
const Student = mongoose.model("Student", studentSchema);

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Ensure unique filename with correct extension
    }
});
const upload = multer({ storage: storage });

// Multer configuration for group profile picture upload
const groupStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads'); // Ensure the uploads folder exists
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const groupUpload = multer({ storage: groupStorage });

// Nodemailer setup
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER, // Use environment variable
        pass: process.env.EMAIL_PASS // Use environment variable
    }
});

// Route for homepage
app.get('/', async (req, res) => {
    try {
        const studyGroups = await StudyGroup.find(); // Fetch study groups from the database
        res.render('index', { 
            studyGroups, // Pass studyGroups to the EJS template
            logout: req.query.logout // Pass logout query parameter
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Route for getting to group listed
app.get("/listed", (req, res) => {
    res.render("listed");
});

// Route for getting to group listed
app.get("/listed2", (req, res) => {
    res.render("listed2");
});

// Route for login homepage
// Route for homepage (accessible only by students after login)
app.get('/home', (req, res) => {
    if (!req.session.student_id) {
        req.flash('error_msg', 'Please log in as a student');
        return res.redirect('/student_login');
    }
    res.render('home'); // This will be the student homepage
});

// About page
app.get("/about", (req, res) => {
    res.render("about");
});

// Tutor registration page
app.get("/tutor-registration", (req, res) => {
    res.render("tutor-registration");
});

// Route to display the registration success page
app.get("/registration-success", (req, res) => {
    res.render("registration-success");
});

// Tutor registration POST route
app.post("/tutor-registration", upload.single('profilePicture'), async (req, res) => {
    const { fullName, phoneNumber, email, subjects, tutoringMode, qualifications, location, availability, experience, username, password, confirm_password } = req.body;
    try {
        if (password !== confirm_password) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect('/tutor-registration');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newTutor = new Tutor({
            fullName,
            phoneNumber,
            email,
            subjects,
            tutoringMode,
            qualifications,
            location,
            availability,
            experience,
            username,
            password: hashedPassword,
            profilePicture: {
                data: fs.readFileSync(path.join(__dirname, '/uploads/', req.file.filename)),
                contentType: 'image/png'
            }
        });

        await newTutor.save();

        // Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER, // Use environment variable for sender email
            to: email,
            subject: "Tutor Registration Successful",
            text: `Dear ${fullName}, your registration is successful.`
        };
        
        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        // Redirect to the success page
        res.redirect("/registration-success");

    } catch (err) {
        console.log(err);
        res.send("Error registering tutor");
    }
});

// Student registration page
app.get("/student-registration", (req, res) => {
    res.render("student-registration");
});

// Student registration POST route
app.post("/student-registration", async (req, res) => {
    const { fullName, email, phoneNumber, subjectsOfInterest, studyMode, location, availability, username, password, confirm_password } = req.body;
    try {
        if (password !== confirm_password) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect('/student-registration');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newStudent = new Student({
            fullName,
            email,
            phoneNumber,
            subjectsOfInterest,
            studyMode,
            location,
            availability,
            username,
            password: hashedPassword
        });

        await newStudent.save();

        // Send confirmation email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Student Registration Successful",
            text: `Dear ${fullName}, your registration is successful.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log("Email sent: " + info.response);
            }
        });

        // Redirect to the success page
        res.redirect("/registration-success");

    } catch (err) {
        console.log(err);
        res.send("Error registering student");
    }
});


//Student Login page
app.get("/student_login", (req, res) => {
    res.render("student_login");
});


//Tutor Login page
app.get("/tutor_login", (req, res) => {
    res.render("tutor_login");
});

// Tutor login POST route
app.post("/tutor_login", async (req, res) => {
    const { tutorEmail, tutorPassword } = req.body;
    try {
        const tutor = await Tutor.findOne({ email: tutorEmail });
        console.log("Tutor Found:", tutor); // Debugging line
        if (!tutor) {
            req.flash('error_msg', "This email does not exist");
            return res.redirect('/tutor_login');
        }

        const isVerified = await bcrypt.compare(tutorPassword, tutor.password);
        if (isVerified) {
            req.session.tutor_id = tutor._id;
            req.session.tutor_name = tutor.fullName; // Store the tutor's name in the session
            req.flash('message', 'Welcome to your dashboard!');
            return res.redirect('/dashboard-tutor');
        } else {
            req.flash('error_msg', "Invalid password");
            return res.redirect('/tutor_login');
        }

    } catch (err) {
        console.error("Error logging in tutor:", err); // Improved error logging
        req.flash('error_msg', 'Error logging in');
        return res.redirect('/tutor_login');
    }
});

// Student login POST route
app.post("/student_login", async (req, res) => {
    const { studentEmail, studentPassword } = req.body;
    try {
        const student = await Student.findOne({ email: studentEmail });
        console.log("Student Found:", student); // Debugging line
        if (!student) {
            req.flash('error_msg', "This email does not exist");
            return res.redirect('/student_login');
        }

        const isVerified = await bcrypt.compare(studentPassword, student.password);
        if (isVerified) {
            req.session.student_id = student._id;
            req.flash('message', 'Welcome to your dashboard!');
            return res.redirect('/dashboard-student');
        } else {
            req.flash('error_msg', "Invalid password");
            return res.redirect('/student_login');
        }

    } catch (err) {
        console.error("Error logging in student:", err); // Improved error logging
        req.flash('error_msg', 'Error logging in');
        return res.redirect('/student_login');
    }
});


// Tutor dashboard route
app.get("/dashboard-tutor", async (req, res) => {
    if (!req.session.tutor_id) {
        req.flash('error_msg', 'Please login as a tutor first');
        return res.redirect('/tutor_login');
    }
    try {
        const tutor = await Tutor.findById(req.session.tutor_id);
        const studyGroups = await StudyGroup.find({ tutorName: tutor.fullName }); // Fetch study groups for this tutor
        res.render("dashboard-tutor.ejs", { tutor, studyGroups, message: req.flash('message') });
    } catch (err) {
        console.error("Error fetching tutor data:", err);
        req.flash('error_msg', 'Error fetching tutor data');
        return res.redirect('/tutor_login');
    }
});


// Student dashboard route (Home page should be accessed from here)
app.get("/dashboard-student", async (req, res) => {
    if (!req.session.student_id) {
        req.flash('error_msg', 'Please login as a student first');
        return res.redirect('/student_login');
    }
    try {
        const student = await Student.findById(req.session.student_id);
        res.render("dashboard-student.ejs", { student, message: req.flash('message') });
    } catch (err) {
        console.error("Error fetching student data:", err);
        req.flash('error_msg', 'Error fetching student data');
        return res.redirect('/student_login');
    }
});


// Creation success page
app.get("/creation-success", (req, res) => {
    res.render("creation-success");
});

// Route to render study group creation page (only accessible by tutors)
app.get("/study-group", async (req, res) => {
    if (req.session.tutor_id) {
        try {
            const tutor = await Tutor.findById(req.session.tutor_id);
            res.render("study-group", { tutorName: tutor.fullName }); // Pass tutor's full name to the view
        } catch (err) {
            console.error("Error fetching tutor data:", err);
            req.flash('error_msg', 'Error fetching tutor data');
            return res.redirect('/tutor_login');
        }
    } else {
        req.flash('error_msg', 'Please login as a tutor first');
        return res.redirect('/tutor_login');
    }
});

// Study group creation POST route (only accessible by tutors)
app.post("/study-group", groupUpload.single('groupProfilePicture'), async (req, res) => {
    const { groupName, subjects, capacity, description, availability, password, confirm_password } = req.body;
    const tutorName = req.session.tutor_name;

    try {
        if (password !== confirm_password) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect('/study-group');
        }

        const newStudyGroup = new StudyGroup({
            groupName,
            subjects: subjects.split(',').map(subject => subject.trim()),
            capacity,
            tutorName,
            description,
            availability,
            password: await bcrypt.hash(password, 10),
            groupProfilePicture: {
                data: fs.readFileSync(path.join(__dirname, '/uploads/', req.file.filename)),
                contentType: req.file.mimetype
            }
        });

        await newStudyGroup.save();
        req.flash('message', 'Study Group created successfully!');
        res.redirect("/creation-success");

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating study group');
        res.redirect('/study-group');
    }
});


// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }

        // Pass 'logout' as a query parameter to the index route
        res.redirect('/?logout=true');
    });
});





// SEARCH PAGE FOR INDEX PAGE 
app.post('/search', async (req, res) => {
    const { subject } = req.body;

    let searchCriteria = {};

    if (subject) {
        searchCriteria.subjects = { $elemMatch: { $regex: subject, $options: 'i' } };
    }

    try {
        const studyGroups = await StudyGroup.find(searchCriteria);
        res.render('search_result', { studyGroups, path: '/uploads' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while searching');
    }
});

// SEARCH PAGE FOR LOGGEDIN HOME PAGE 
app.post('/search2', async (req, res) => {
    const { subject } = req.body;

    let searchCriteria = {};

    if (subject) {
        searchCriteria.subjects = { $elemMatch: { $regex: subject, $options: 'i' } };
    }

    try {
        const studyGroups = await StudyGroup.find(searchCriteria);
        res.render('search_result2', { studyGroups, path: '/uploads' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error occurred while searching');
    }
});


// Route to render the edit study group page
app.get('/study-group/:id/edit', async (req, res) => {
    try {
        const group = await StudyGroup.findById(req.params.id);
        if (!group) {
            req.flash('error_msg', 'Study group not found');
            return res.redirect('/dashboard-tutor');
        }
        res.render('edit-study-group', { group });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// Route to handle the POST request to update the study group
app.post('/study-group/:id/edit', groupUpload.single('groupProfilePicture'), async (req, res) => {
    try {
        const { groupName, subjects, capacity, description, availability, password } = req.body;
        const groupData = {
            groupName,
            subjects: subjects.split(',').map(subject => subject.trim()),
            capacity,
            description,
            availability,
        };

        if (password) {
            groupData.password = await bcrypt.hash(password, 10);
        }

        if (req.file) {
            groupData.groupProfilePicture = {
                data: fs.readFileSync(path.join(__dirname, '/uploads/', req.file.filename)),
                contentType: req.file.mimetype
            };
        }

        await StudyGroup.findByIdAndUpdate(req.params.id, groupData);
        req.flash('message', 'Study group updated successfully!');
        res.redirect('/dashboard-tutor');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating study group');
        res.redirect(`/study-group/${req.params.id}/edit`);
    }
});

// Route to handle deleting a study group
app.post('/study-group/:id/delete', async (req, res) => {
    try {
        await StudyGroup.findByIdAndDelete(req.params.id);
        req.flash('message', 'Study group deleted successfully!');
        res.redirect('/dashboard-tutor');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error deleting study group');
        res.redirect('/dashboard-tutor');
    }
});


// Route to display the edit tutor profile page
app.get('/edit-tutor-profile', async (req, res) => {
    if (req.session.tutor_id) {
        try {
            const tutor = await Tutor.findById(req.session.tutor_id);
            res.render('edit-tutor-profile', { tutor });
        } catch (err) {
            console.error("Error fetching tutor data:", err);
            req.flash('error_msg', 'Error fetching tutor data');
            return res.redirect('/dashboard-tutor');
        }
    } else {
        req.flash('error_msg', 'Please login as a tutor first');
        return res.redirect('/tutor_login');
    }
});


app.post('/edit-tutor-profile', upload.single('profilePicture'), async (req, res) => {
    const { fullName, phoneNumber, email, subjects, tutoringMode, qualifications, location, availability, experience, username } = req.body;

    try {
        // Collect tutor data from the form
        const tutorData = {
            fullName,
            phoneNumber,
            email,
            subjects,
            tutoringMode,
            qualifications,
            location,
            availability,
            experience,
            username,
        };

        // If a new profile picture is uploaded, include it in the update
        if (req.file) {
            tutorData.profilePicture = {
                data: fs.readFileSync(path.join(__dirname, '/uploads/', req.file.filename)),
                contentType: req.file.mimetype
            };
        }

        // Update the tutor's profile in the Tutor collection
        await Tutor.findByIdAndUpdate(req.session.tutor_id, tutorData);

        // Update the tutor's name in all associated Study Groups
        await StudyGroup.updateMany(
            { tutorName: req.session.tutor_name }, // Find all study groups with the old tutor's name
            { tutorName: fullName } // Update to the new full name
        );

        // Update session data to reflect the new tutor name
        req.session.tutor_name = fullName;

        // Flash success message and redirect
        req.flash('message', 'Profile updated successfully!');
        res.redirect('/dashboard-tutor');
    } catch (err) {
        console.error("Error updating tutor profile:", err);
        req.flash('error_msg', 'Error updating profile');
        res.redirect('/edit-tutor-profile');
    }
});


// Route to render the profile edit page with the student's current data
app.get('/edit-student-profile', async (req, res) => {
    try {
        // Assuming you have a session with the student's ID
        const studentId = req.session.student_id;
        
        // Fetch the student's data from the database
        const student = await Student.findById(studentId);
        
        // Render the profile edit page with the student's current data
        res.render('edit-student-profile', {
            student: student
        });
    } catch (err) {
        console.error('Error fetching student data:', err);
        req.flash('error_msg', 'Error fetching your profile data.');
        res.redirect('/dashboard-student');
    }
});


// Route to handle the profile update
app.post('/edit-student-profile', async (req, res) => {
    const { fullName, email, subjectsOfInterest, password, confirmPassword } = req.body;
    
    try {
        // Check if the password and confirm password match
        if (password !== confirmPassword) {
            req.flash('error_msg', 'Passwords do not match!');
            return res.redirect('/edit-student-profile');
        }

        // Find the student by ID (assuming session is used for login)
        const studentId = req.session.student_id;
        const student = await Student.findById(studentId);

        // Prepare the updated student data
        const updatedData = {
            fullName,
            email,
            subjectsOfInterest
        };

        // Update password if provided
        if (password) {
            // Hash the new password (using bcrypt for example)
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedData.password = hashedPassword;
        }

        // Update the student's profile in the database
        await Student.findByIdAndUpdate(studentId, updatedData);

        // Redirect to the dashboard with a success message
        req.flash('message', 'Profile updated successfully!');
        res.redirect('/dashboard-student');
    } catch (err) {
        console.error('Error updating student profile:', err);
        req.flash('error_msg', 'Error updating your profile.');
        res.redirect('/edit-student-profile');
    }
});




// Get the port from environment variables, default to 10000 if not set
const port = process.env.PORT || 10000;

// Bind the server to all interfaces (0.0.0.0) and start listening on the defined port
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
