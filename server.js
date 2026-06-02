const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploads folder

// Initialize SQLite Database
// Using a separate database file or deleting the old one would be ideal,
// but we can just drop the old table and recreate for simplicity in this dev environment.
const db = new sqlite3.Database("./class_project_v2.db", (err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");

    db.serialize(() => {
      // Create Classes Table
      db.run(`CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                section TEXT NOT NULL,
                teacher_id INTEGER NOT NULL,
                FOREIGN KEY (teacher_id) REFERENCES users (id)
            )`);

      // Create Users Table
      db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                class_id INTEGER,
                FOREIGN KEY (class_id) REFERENCES classes (id)
            )`, () => {
                // Attempt to add the class_id column in case the table already exists from an older version
                db.run("ALTER TABLE users ADD COLUMN class_id INTEGER REFERENCES classes(id)", (err) => {
                    // It will error if the column already exists, which is fine, we just ignore it.
                });
            });

      // Create Students Table
      db.run(`CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                class_id INTEGER NOT NULL,
                FOREIGN KEY (class_id) REFERENCES classes (id),
                UNIQUE(email, class_id)
            )`);

      // Create Marks Table
      db.run(`CREATE TABLE IF NOT EXISTS marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                attendance INTEGER DEFAULT 0,
                participation INTEGER DEFAULT 0,
                project INTEGER DEFAULT 0, 
                mid_term INTEGER DEFAULT 0,
                final_term INTEGER DEFAULT 0,
                FOREIGN KEY (student_id) REFERENCES users (id)
            )`);

      // Create Assignments Table
      db.run(`CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT,
                teacher_id INTEGER NOT NULL,
                file_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users (id)
            )`);

      // Create Submissions Table
      db.run(`CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                notes TEXT,
                file_path TEXT NOT NULL,
                submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES assignments (id),
                FOREIGN KEY (student_id) REFERENCES users (id)
            )`);

      // Insert default Teacher account if not exists
      db.get(
        "SELECT * FROM users WHERE email = 'teacher@example.com'",
        (err, row) => {
          if (!row) {
            db.run(
              `INSERT INTO users (name, email, password, role) VALUES ('Admin Teacher', 'teacher@example.com', 'password', 'teacher')`,
            );
            console.log(
              "Default teacher account created: teacher@example.com / password",
            );
          }
        },
      );
    });
  }
});

// API Routes

// --- Authentication & Registration ---

app.post("/api/signup", (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }
  // ensure role is valid
  const userRole = role === "teacher" ? "teacher" : "student";

  db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, password, userRole],
    function (err) {
      if (err) {
        res.status(400).json({ error: "Email already exists or invalid data" });
        return;
      }
      res.json({
        message: "success",
        data: { id: this.lastID, name, email, role: userRole },
      });
    },
  );
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  
  // First check users table (Teachers/Admins)
  db.get(
    "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, userRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (userRow) {
        return res.json({ message: "success", user: userRow });
      }
      
      // If not found in users, check students table
      db.all(
        "SELECT students.id, students.name, students.email, classes.id as class_id, classes.name as class_name, classes.section as class_section FROM students JOIN classes ON students.class_id = classes.id WHERE students.email = ? AND students.password = ?",
        [email, password],
        (err, studentRows) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          if (studentRows && studentRows.length > 0) {
            // Assign role 'student' for the frontend to recognize
            // We return the first row as the main user object, but also include all enrollments
            const user = {
                id: studentRows[0].id, // default to first enrollment
                name: studentRows[0].name,
                email: studentRows[0].email,
                role: 'student',
                enrollments: studentRows
            };
            return res.json({ message: "success", user: user });
          } else {
            return res.status(401).json({ error: "Invalid email or password" });
          }
        }
      );
    }
  );
});

// --- User Management (Teacher Only) ---

// Get all students
app.get("/api/users/students", (req, res) => {
  db.all(
    "SELECT students.id, students.name, students.email, classes.name as class_name, classes.section as class_section FROM students JOIN classes ON students.class_id = classes.id",
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    },
  );
});

// Get students for a specific class
app.get("/api/classes/:class_id/students", (req, res) => {
  db.all(
    "SELECT id, name, email FROM students WHERE class_id = ?",
    [req.params.class_id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    }
  );
});

// Register a new student
app.post("/api/users/students", (req, res) => {
  const { name, email, password, class_id } = req.body;
  if (!name || !email || !password || !class_id) {
    res.status(400).json({ error: "Name, email, password, and class are required" });
    return;
  }

  db.run(
    "INSERT INTO students (name, email, password, class_id) VALUES (?, ?, ?, ?)",
    [name, email, password, class_id],
    function (err) {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({ message: "success", data: { id: this.lastID, name, email, class_id } });
    },
  );
});

// Delete a student
app.delete("/api/users/students/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM students WHERE id = ?", id, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Also delete associated marks
    db.run("DELETE FROM marks WHERE student_id = ?", id);
    res.json({ message: "deleted" });
  });
});

// --- Class Management ---

// Get all classes
app.get("/api/classes", (req, res) => {
  db.all("SELECT * FROM classes", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Create a new class
app.post("/api/classes", (req, res) => {
  const { name, section, teacher_id } = req.body;
  if (!name || !section || !teacher_id) {
    res.status(400).json({ error: "Name, section, and teacher ID are required" });
    return;
  }

  db.run(
    "INSERT INTO classes (name, section, teacher_id) VALUES (?, ?, ?)",
    [name, section, teacher_id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "success", id: this.lastID });
    }
  );
});

// --- Marks Management ---

// Get marks for a specific student
app.get("/api/marks/:student_id", (req, res) => {
  db.all(
    "SELECT * FROM marks WHERE student_id = ?",
    [req.params.student_id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ data: rows });
    },
  );
});

// Add marks for a subject
app.post("/api/marks", (req, res) => {
  const {
    student_id,
    subject,
    attendance,
    participation,
    project,
    mid_term,
    final_term,
  } = req.body;
  if (!student_id || !subject) {
    res.status(400).json({ error: "Student ID and Subject are required" });
    return;
  }

  const sql = `INSERT INTO marks (student_id, subject, attendance, participation, project, mid_term, final_term) 
  VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    student_id,
    subject,
    attendance || 0,
    participation || 0,
    project || 0,
    mid_term || 0,
    final_term || 0,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "success", id: this.lastID });
  });
});

// Update marks
app.put("/api/marks/:id", (req, res) => {
  const { attendance, participation, project, mid_term, final_term } = req.body;
  const sql = `UPDATE marks SET attendance = ?, participation = ?, project = ?, mid_term = ?, final_term = ? WHERE id = ?`;
  const params = [
    attendance,
    participation,
    project,
    mid_term,
    final_term,
    req.params.id,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "updated" });
  });
});

// Delete a subject mark
app.delete("/api/marks/:id", (req, res) => {
  db.run("DELETE FROM marks WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "deleted" });
  });
});

// Get all marks for Excel export
app.get("/api/export/marks", (req, res) => {
  const sql = `
        SELECT u.name as student_name, u.email, m.subject, m.attendance, m.participation, m.project, m.mid_term, m.final_term
        FROM marks m
        JOIN students u ON m.student_id = u.id
    `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Create an assignment (Teacher)
app.post("/api/assignments", upload.single("file"), (req, res) => {
  const { title, description, due_date, teacher_id } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !teacher_id) {
    return res.status(400).json({ error: "Title and Teacher ID are required" });
  }

  const sql = `INSERT INTO assignments (title, description, due_date, teacher_id, file_path) VALUES (?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [title, description, due_date, teacher_id, file_path],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "success", id: this.lastID });
    },
  );
});

// Get all assignments
app.get("/api/assignments", (req, res) => {
  const sql = `SELECT a.*, u.name as teacher_name FROM assignments a JOIN users u ON a.teacher_id = u.id ORDER BY a.created_at DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// --- Submissions Management ---

// Create a submission (Student)
app.post("/api/submissions", upload.single("file"), (req, res) => {
  const { assignment_id, student_id, notes } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  if (!assignment_id || !student_id || !file_path) {
    return res
      .status(400)
      .json({ error: "Assignment ID, Student ID, and File are required" });
  }

  const sql = `INSERT INTO submissions (assignment_id, student_id, notes, file_path) VALUES (?, ?, ?, ?)`;
  db.run(sql, [assignment_id, student_id, notes, file_path], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: "success", id: this.lastID });
  });
});

// Get submissions for a specific assignment (Teacher)
app.get("/api/submissions/:assignment_id", (req, res) => {
  const sql = `
        SELECT s.*, u.name as student_name, u.email as student_email 
        FROM submissions s 
        JOIN students u ON s.student_id = u.id 
        WHERE s.assignment_id = ?
        ORDER BY s.submission_date DESC
    `;
  db.all(sql, [req.params.assignment_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
