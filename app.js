document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginSection = document.getElementById('login-section');
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    
    const teacherDashboard = document.getElementById('teacher-dashboard');
    const studentDashboard = document.getElementById('student-dashboard');
    const userInfo = document.getElementById('user-info');
    const welcomeText = document.getElementById('welcome-text');
    const logoutBtn = document.getElementById('logout-btn');
    const headerSubtitle = document.getElementById('header-subtitle');

    // Forms
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const addStudentForm = document.getElementById('add-student-form');
    const addMarksForm = document.getElementById('add-marks-form');
    const addClassForm = document.getElementById('add-class-form');

    // Modals
    const marksModal = document.getElementById('marks-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Tables
    const teacherStudentsTbody = document.getElementById('teacher-students-tbody');
    const studentMarksTbody = document.getElementById('student-marks-tbody');
    const myMarksTbody = document.getElementById('my-marks-tbody');
    const teacherClassesTbody = document.getElementById('teacher-classes-tbody');

    // Toggles
    const showSignupBtn = document.getElementById('show-signup');
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginContainer) loginContainer.classList.add('hidden');
            if (signupContainer) signupContainer.classList.remove('hidden');
        });
    }

    const showLoginBtn = document.getElementById('show-login');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupContainer) signupContainer.classList.add('hidden');
            if (loginContainer) loginContainer.classList.remove('hidden');
        });
    }

    // Excel Export Button
    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportExcel);

    let currentUser = null;
    let currentSelectedClassId = null;
    let currentSelectedClassName = null;
    let currentSelectedStudentId = null;

    // --- Utility: Grade Calculation ---
    function calculateGradeInfo(mark) {
        const total = (mark.attendance || 0) + (mark.participation || 0) + 
                      (mark.project || 0) + (mark.mid_term || 0) + (mark.final_term || 0);
        
        // Assuming total is out of 100
        let grade = 'F';
        if (total >= 90) grade = 'A';
        else if (total >= 85) grade = 'A-';
        else if (total >= 80) grade = 'B+';
        else if (total >= 75) grade = 'B';
        else if (total >= 70) grade = 'B-';
        else if (total >= 65) grade = 'C+';
        else if (total >= 60) grade = 'C';
        else if (total >= 55) grade = 'C-';
        else if (total >= 50) grade = 'D';
        
        return { total, grade };
    }

    // --- Authentication & Registration ---

    // Check if user is already logged in
    const storedUser = localStorage.getItem('classAppUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    }

    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (response.ok) {
                currentUser = result.user;
                localStorage.setItem('classAppUser', JSON.stringify(currentUser));
                showMessage('login-message', 'Login successful!', 'success');
                setTimeout(() => {
                    loginForm.reset();
                    showDashboard();
                }, 1000);
            } else {
                showMessage('login-message', result.error, 'error');
            }
        } catch (error) {
            showMessage('login-message', 'Network error', 'error');
        }
    });

    if (signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value;

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            const result = await response.json();

            if (response.ok) {
                showMessage('signup-message', 'Account created! You can now login.', 'success');
                setTimeout(() => {
                    signupForm.reset();
                    document.getElementById('show-login').click();
                }, 1500);
            } else {
                showMessage('signup-message', result.error, 'error');
            }
        } catch (error) {
            showMessage('signup-message', 'Network error', 'error');
        }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('classAppUser');
        showSection(loginSection);
        if (userInfo) userInfo.classList.add('hidden');
        if (headerSubtitle) headerSubtitle.textContent = 'Manage your academic performance seamlessly';
    });

    function showDashboard() {
        userInfo.classList.remove('hidden');
        welcomeText.textContent = `Welcome, ${currentUser.name} (${currentUser.role})`;
        
        if (currentUser.role === 'teacher') {
            showSection(teacherDashboard);
            headerSubtitle.textContent = 'Teacher Dashboard';
            document.getElementById('teacher-classes-view').classList.remove('hidden');
            document.getElementById('teacher-class-details-view').classList.add('hidden');
            loadClassesList();
        } else if (currentUser.role === 'student') {
            showSection(studentDashboard);
            headerSubtitle.textContent = 'Student Dashboard';
            
            document.getElementById('student-classes-list-view').classList.remove('hidden');
            document.getElementById('student-class-details-view').classList.add('hidden');
            
            const grid = document.getElementById('student-classes-grid');
            if (grid) {
                grid.innerHTML = '';
                if (currentUser.enrollments && currentUser.enrollments.length > 0) {
                    currentUser.enrollments.forEach(enr => {
                        const card = document.createElement('div');
                        card.className = 'glass-panel';
                        card.style.cursor = 'pointer';
                        card.style.transition = 'transform 0.2s';
                        card.onmouseover = () => card.style.transform = 'translateY(-5px)';
                        card.onmouseout = () => card.style.transform = 'translateY(0)';
                        card.innerHTML = `
                            <h3 style="margin-top: 0; color: var(--primary-color);">${escapeHtml(enr.class_name)}</h3>
                            <p style="color: var(--text-secondary); margin-bottom: 1rem;">Section: ${escapeHtml(enr.class_section)}</p>
                            <button class="btn action-btn" style="width: 100%;">View Class</button>
                        `;
                        card.onclick = () => openStudentClass(enr);
                        grid.appendChild(card);
                    });
                } else {
                    grid.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">Not assigned to any class.</p>';
                }
            }
        }
    }

    window.openStudentClass = (enrollment) => {
        currentSelectedStudentId = enrollment.id;
        document.getElementById('student-classes-list-view').classList.add('hidden');
        document.getElementById('student-class-details-view').classList.remove('hidden');
        
        const classInfo = document.getElementById('student-class-info');
        if (classInfo) {
            classInfo.textContent = `Class: ${enrollment.class_name} | Section: ${enrollment.class_section}`;
        }
        
        loadMyMarks();
        loadAssignments();
    };

    const studentBackToClassesBtn = document.getElementById('student-back-to-classes-btn');
    if (studentBackToClassesBtn) {
        studentBackToClassesBtn.addEventListener('click', () => {
            currentSelectedStudentId = null;
            document.getElementById('student-classes-list-view').classList.remove('hidden');
            document.getElementById('student-class-details-view').classList.add('hidden');
        });
    }

    function showSection(section) {
        loginSection.classList.remove('active-section');
        loginSection.classList.add('hidden');
        teacherDashboard.classList.remove('active-section');
        teacherDashboard.classList.add('hidden');
        studentDashboard.classList.remove('active-section');
        studentDashboard.classList.add('hidden');

        section.classList.remove('hidden');
        section.classList.add('active-section');
    }

    // --- Class Management ---
    
    if (addClassForm) addClassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('class-name').value;
        const section = document.getElementById('class-section').value;
        
        try {
            const response = await fetch('/api/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, section, teacher_id: currentUser.id })
            });
            const result = await response.json();
            if (response.ok) {
                showMessage('class-form-message', 'Class added successfully!', 'success');
                addClassForm.reset();
                loadClassesList();
            } else {
                showMessage('class-form-message', result.error, 'error');
            }
        } catch (error) {
            showMessage('class-form-message', 'Network error', 'error');
        }
    });

    async function loadClassesList() {
        try {
            const response = await fetch('/api/classes');
            const result = await response.json();
            
            if (teacherClassesTbody) teacherClassesTbody.innerHTML = '';
            
            if (!result.data || result.data.length === 0) {
                if (teacherClassesTbody) teacherClassesTbody.innerHTML = `<tr><td colspan="3" class="empty-state">No classes found.</td></tr>`;
                return;
            }

            result.data.forEach(cls => {
                if (teacherClassesTbody) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(cls.name)}</td>
                        <td>${escapeHtml(cls.section)}</td>
                        <td><button class="btn action-btn" onclick="openClassView(${cls.id}, '${escapeHtml(cls.name)}', '${escapeHtml(cls.section)}')">Open</button></td>
                    `;
                    teacherClassesTbody.appendChild(tr);
                }
            });
        } catch (error) {
            console.error('Error loading classes', error);
        }
    }

    window.openClassView = (id, name, section) => {
        currentSelectedClassId = id;
        currentSelectedClassName = name;
        document.getElementById('teacher-classes-view').classList.add('hidden');
        document.getElementById('teacher-class-details-view').classList.remove('hidden');
        document.getElementById('current-class-title').textContent = `${name} (${section})`;
        loadStudentsList();
    };

    const backToClassesBtn = document.getElementById('back-to-classes-btn');
    if (backToClassesBtn) {
        backToClassesBtn.addEventListener('click', () => {
            currentSelectedClassId = null;
            currentSelectedClassName = null;
            document.getElementById('teacher-classes-view').classList.remove('hidden');
            document.getElementById('teacher-class-details-view').classList.add('hidden');
            loadClassesList();
        });
    }

    // --- Teacher Functions ---

    if (addStudentForm) addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('student-name').value;
        const email = document.getElementById('student-email').value;
        const password = document.getElementById('student-password').value;

        if (!currentSelectedClassId) {
            showMessage('student-form-message', 'No class selected', 'error');
            return;
        }

        try {
            const response = await fetch('/api/users/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, class_id: currentSelectedClassId })
            });
            const result = await response.json();

            if (response.ok) {
                showMessage('student-form-message', 'Student registered successfully!', 'success');
                addStudentForm.reset();
                loadStudentsList();
            } else {
                showMessage('student-form-message', result.error, 'error');
            }
        } catch (error) {
            showMessage('student-form-message', 'Network error', 'error');
        }
    });

    async function loadStudentsList() {
        if (!currentSelectedClassId) return;
        try {
            const response = await fetch(`/api/classes/${currentSelectedClassId}/students`);
            const result = await response.json();
            
            if (!teacherStudentsTbody) return;
            teacherStudentsTbody.innerHTML = '';
            if (!result.data || result.data.length === 0) {
                teacherStudentsTbody.innerHTML = `<tr><td colspan="3" class="empty-state">No students found in this class.</td></tr>`;
                return;
            }

            result.data.forEach(student => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(student.name)}</td>
                    <td>${escapeHtml(student.email)}</td>
                    <td>
                        <button class="btn action-btn" onclick="openMarksModal(${student.id}, '${escapeHtml(student.name)}')">Manage Marks</button>
                        <button class="btn danger-btn" onclick="deleteStudent(${student.id})">Delete</button>
                    </td>
                `;
                teacherStudentsTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading students', error);
        }
    }

    window.deleteStudent = async (id) => {
        if (!confirm('Are you sure you want to delete this student and all their marks?')) return;
        try {
            const response = await fetch(`/api/users/students/${id}`, { method: 'DELETE' });
            if (response.ok) {
                loadStudentsList();
            }
        } catch (error) {
            console.error('Error deleting student', error);
        }
    };

    // --- Marks Management (Teacher) ---

    window.openMarksModal = (studentId, studentName) => {
        document.getElementById('marks-student-id').value = studentId;
        document.getElementById('marks-record-id').value = ''; // Clear edit ID
        document.getElementById('marks-modal-title').textContent = `Manage Marks: ${studentName}`;
        document.getElementById('marks-subject').value = currentSelectedClassName; // Auto-set subject to class name
        marksModal.classList.remove('hidden');
        loadStudentMarks(studentId);
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
        if (marksModal) marksModal.classList.add('hidden');
        if (addMarksForm) addMarksForm.reset();
        const rid = document.getElementById('marks-record-id');
        if (rid) rid.value = '';
    });

    if (addMarksForm) addMarksForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const student_id = document.getElementById('marks-student-id').value;
        const record_id = document.getElementById('marks-record-id').value;
        
        const subject = document.getElementById('marks-subject').value;
        const attendance = parseInt(document.getElementById('marks-attendance').value) || 0;
        const participation = parseInt(document.getElementById('marks-participation').value) || 0;
        const project = parseInt(document.getElementById('marks-project').value) || 0;
        const mid_term = parseInt(document.getElementById('marks-mid').value) || 0;
        const final_term = parseInt(document.getElementById('marks-final').value) || 0;

        const payload = { student_id, subject, attendance, participation, project, mid_term, final_term };

        try {
            let url = '/api/marks';
            let method = 'POST';

            if (record_id) {
                url = `/api/marks/${record_id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                addMarksForm.reset();
                document.getElementById('marks-student-id').value = student_id; // Restore ID
                document.getElementById('marks-record-id').value = ''; // Clear edit ID
                loadStudentMarks(student_id);
            } else {
                const res = await response.json();
                alert(res.error);
            }
        } catch (error) {
            console.error('Error saving marks', error);
        }
    });

    async function loadStudentMarks(studentId) {
        try {
            const response = await fetch(`/api/marks/${studentId}`);
            const result = await response.json();
            
            if (!studentMarksTbody) return;
            studentMarksTbody.innerHTML = '';
            if (!result.data || result.data.length === 0) {
                studentMarksTbody.innerHTML = `<tr><td colspan="9" class="empty-state">No marks recorded yet.</td></tr>`;
                return;
            }

            result.data.forEach(mark => {
                const { total, grade } = calculateGradeInfo(mark);
                // Stringify the mark object for the edit function
                const markJson = JSON.stringify(mark).replace(/"/g, '&quot;');
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(mark.subject)}</td>
                    <td>${mark.attendance}</td>
                    <td>${mark.participation}</td>
                    <td>${mark.project}</td>
                    <td>${mark.mid_term}</td>
                    <td>${mark.final_term}</td>
                    <td><strong>${total}</strong></td>
                    <td><strong class="${grade === 'F' ? 'text-danger' : 'text-success'}">${grade}</strong></td>
                    <td style="white-space: nowrap;">
                        <button class="btn action-btn" onclick="editMark(${markJson})">Edit</button>
                        <button class="btn danger-btn" onclick="deleteMark(${mark.id}, ${studentId})">Rem</button>
                    </td>
                `;
                studentMarksTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading marks', error);
        }
    }

    window.editMark = (mark) => {
        document.getElementById('marks-record-id').value = mark.id;
        document.getElementById('marks-subject').value = mark.subject;
        document.getElementById('marks-attendance').value = mark.attendance;
        document.getElementById('marks-participation').value = mark.participation;
        document.getElementById('marks-project').value = mark.project;
        document.getElementById('marks-mid').value = mark.mid_term;
        document.getElementById('marks-final').value = mark.final_term;
    };

    window.deleteMark = async (markId, studentId) => {
        if (!confirm('Delete this subject record?')) return;
        try {
            const response = await fetch(`/api/marks/${markId}`, { method: 'DELETE' });
            if (response.ok) {
                loadStudentMarks(studentId);
            }
        } catch (error) {
            console.error('Error deleting mark', error);
        }
    };

    // --- Excel (CSV) Export ---
    async function exportExcel() {
        try {
            const response = await fetch('/api/export/marks');
            const result = await response.json();
            
            if (!result.data || result.data.length === 0) {
                alert("No marks data to export.");
                return;
            }

            // Create CSV Headers
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Student Name,Email,Subject,Attendance,Participation,Project,Mid Term,Final Term,Total,Grade\n";

            // Add rows
            result.data.forEach(row => {
                const { total, grade } = calculateGradeInfo(row);
                const rowData = [
                    `"${row.student_name}"`,
                    `"${row.email}"`,
                    `"${row.subject}"`,
                    row.attendance,
                    row.participation,
                    row.project,
                    row.mid_term,
                    row.final_term,
                    total,
                    grade
                ];
                csvContent += rowData.join(",") + "\n";
            });

            // Trigger download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "student_marks_export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Error exporting data', error);
            alert("Failed to export data.");
        }
    }

    // --- Student Functions ---

    async function loadMyMarks() {
        if (!currentSelectedStudentId) return;
        try {
            const response = await fetch(`/api/marks/${currentSelectedStudentId}`);
            const result = await response.json();
            
            if (!myMarksTbody) return;
            myMarksTbody.innerHTML = '';
            if (!result.data || result.data.length === 0) {
                myMarksTbody.innerHTML = `<tr><td colspan="8" class="empty-state">No academic records found.</td></tr>`;
                return;
            }

            result.data.forEach(mark => {
                const { total, grade } = calculateGradeInfo(mark);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(mark.subject)}</strong></td>
                    <td>${mark.attendance}</td>
                    <td>${mark.participation}</td>
                    <td>${mark.project}</td>
                    <td>${mark.mid_term}</td>
                    <td>${mark.final_term}</td>
                    <td><strong>${total}</strong></td>
                    <td><strong class="${grade === 'F' ? 'text-danger' : 'text-success'}">${grade}</strong></td>
                `;
                myMarksTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading my marks', error);
        }
    }

    // --- Assignments & Submissions ---

    const createAssignmentForm = document.getElementById('create-assignment-form');
    const teacherAssignmentsTbody = document.getElementById('teacher-assignments-tbody');
    const submissionsModal = document.getElementById('submissions-modal');
    const closeSubmissionsModal = document.getElementById('close-submissions-modal');
    const teacherSubmissionsTbody = document.getElementById('teacher-submissions-tbody');

    const studentAssignmentsTbody = document.getElementById('student-assignments-tbody');
    const submitAssignmentModal = document.getElementById('submit-assignment-modal');
    const closeSubmitModal = document.getElementById('close-submit-modal');
    const submitAssignmentForm = document.getElementById('submit-assignment-form');

    // Teacher: Create Assignment
    if (createAssignmentForm) createAssignmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', document.getElementById('assignment-title').value);
        formData.append('due_date', document.getElementById('assignment-due').value);
        formData.append('description', document.getElementById('assignment-desc').value);
        formData.append('teacher_id', currentUser.id);
        
        const fileInput = document.getElementById('assignment-file');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        try {
            const response = await fetch('/api/assignments', {
                method: 'POST',
                body: formData
            });
            
            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                throw new Error("Server returned an invalid response (likely not JSON). Please ensure the server was restarted.");
            }

            if (response.ok) {
                showMessage('assignment-form-message', 'Assignment created!', 'success');
                createAssignmentForm.reset();
                loadAssignments();
            } else {
                showMessage('assignment-form-message', result.error || 'Server error', 'error');
            }
        } catch (error) {
            console.error('Assignment Upload Error:', error);
            showMessage('assignment-form-message', error.message || 'Network error', 'error');
        }
    });

    // Load Assignments (for both roles)
    async function loadAssignments() {
        try {
            const response = await fetch('/api/assignments');
            const result = await response.json();
            
            if (currentUser.role === 'teacher' && teacherAssignmentsTbody) {
                teacherAssignmentsTbody.innerHTML = '';
                if (!result.data || result.data.length === 0) {
                    teacherAssignmentsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No assignments created.</td></tr>`;
                } else {
                    result.data.filter(a => a.teacher_id === currentUser.id).forEach(a => {
                        const fileLink = a.file_path ? `<a href="${a.file_path}" target="_blank" class="action-btn">Download</a>` : 'None';
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${escapeHtml(a.title)}</strong><br><small style="color:var(--text-secondary)">${escapeHtml(a.description)}</small></td>
                            <td>${escapeHtml(a.due_date)}</td>
                            <td>${fileLink}</td>
                            <td><button class="btn action-btn" onclick="viewSubmissions(${a.id})">View Submissions</button></td>
                        `;
                        teacherAssignmentsTbody.appendChild(tr);
                    });
                }
            }

            if (currentUser.role === 'student' && studentAssignmentsTbody) {
                studentAssignmentsTbody.innerHTML = '';
                if (!result.data || result.data.length === 0) {
                    studentAssignmentsTbody.innerHTML = `<tr><td colspan="5" class="empty-state">No assignments available.</td></tr>`;
                } else {
                    result.data.forEach(a => {
                        const fileLink = a.file_path ? `<a href="${a.file_path}" target="_blank" class="action-btn">Download</a>` : 'None';
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><strong>${escapeHtml(a.title)}</strong><br><small style="color:var(--text-secondary)">${escapeHtml(a.description)}</small></td>
                            <td>${escapeHtml(a.teacher_name)}</td>
                            <td>${escapeHtml(a.due_date)}</td>
                            <td>${fileLink}</td>
                            <td><button class="btn primary-btn" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="openSubmitModal(${a.id}, '${escapeHtml(a.title)}')">Submit</button></td>
                        `;
                        studentAssignmentsTbody.appendChild(tr);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading assignments', error);
        }
    }

    // Teacher: View Submissions
    window.viewSubmissions = async (assignmentId) => {
        submissionsModal.classList.remove('hidden');
        try {
            const response = await fetch(`/api/submissions/${assignmentId}`);
            const result = await response.json();
            
            if (!teacherSubmissionsTbody) return;
            teacherSubmissionsTbody.innerHTML = '';
            
            if (!result.data || result.data.length === 0) {
                teacherSubmissionsTbody.innerHTML = `<tr><td colspan="4" class="empty-state">No submissions yet.</td></tr>`;
                return;
            }

            result.data.forEach(sub => {
                const fileLink = sub.file_path ? `<a href="${sub.file_path}" target="_blank" class="action-btn">Download</a>` : 'None';
                const dateObj = new Date(sub.submission_date);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(sub.student_name)}</strong><br><small style="color:var(--text-secondary)">${escapeHtml(sub.student_email)}</small></td>
                    <td>${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}</td>
                    <td>${escapeHtml(sub.notes || '')}</td>
                    <td>${fileLink}</td>
                `;
                teacherSubmissionsTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading submissions', error);
        }
    };

    if (closeSubmissionsModal) closeSubmissionsModal.addEventListener('click', () => {
        submissionsModal.classList.add('hidden');
    });

    // Student: Open Submit Modal
    window.openSubmitModal = (assignmentId, title) => {
        document.getElementById('submit-assignment-id').value = assignmentId;
        document.getElementById('submit-modal-title').textContent = `Submit: ${title}`;
        submitAssignmentModal.classList.remove('hidden');
    };

    if (closeSubmitModal) closeSubmitModal.addEventListener('click', () => {
        submitAssignmentModal.classList.add('hidden');
        if (submitAssignmentForm) submitAssignmentForm.reset();
    });

    // Student: Submit Assignment
    if (submitAssignmentForm) submitAssignmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('assignment_id', document.getElementById('submit-assignment-id').value);
        formData.append('student_id', currentSelectedStudentId || currentUser.id);
        formData.append('notes', document.getElementById('submit-notes').value);
        
        const fileInput = document.getElementById('submit-file');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        try {
            const response = await fetch('/api/submissions', {
                method: 'POST',
                body: formData
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonError);
                throw new Error("Server returned an invalid response. Please ensure the server was restarted.");
            }

            if (response.ok) {
                showMessage('submit-form-message', 'Submission successful!', 'success');
                setTimeout(() => {
                    submitAssignmentModal.classList.add('hidden');
                    submitAssignmentForm.reset();
                }, 1500);
            } else {
                showMessage('submit-form-message', result.error || 'Server error', 'error');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            showMessage('submit-form-message', error.message || 'Network error', 'error');
        }
    });

    // Call loadAssignments when dashboard loads
    const originalShowDashboard = showDashboard;
    showDashboard = function() {
        originalShowDashboard();
        loadAssignments();
    };

    // --- Utils ---
    
    function showMessage(elementId, msg, type) {
        const el = document.getElementById(elementId);
        el.textContent = msg;
        el.className = `message ${type}`;
        el.classList.remove('hidden');
        setTimeout(() => {
            el.classList.add('hidden');
        }, 3000);
    }

    function escapeHtml(unsafe) {
        return (unsafe || '')
             .toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
