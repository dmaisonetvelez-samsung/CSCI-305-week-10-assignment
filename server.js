const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, User, Project, Task } = require('./database/setup');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

app.use(express.json());

// --- MIDDLEWARE ---

// Authenticate JWT Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}

// Authorize based on roles
function authorize(roles = []) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Requires ${roles.join(' or ')} role.` });
        }
        next();
    };
}

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword, role });

        res.status(201).json({ message: 'User registered', user: { id: newUser.id, role: newUser.role } });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- PROTECTED ROUTES ---

// GET All Users (Admin only)
app.get('/api/users', authenticateToken, authorize(['Admin']), async (req, res) => {
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role'] });
    res.json(users);
});

// PROJECTS
app.get('/api/projects', authenticateToken, async (req, res) => {
    const projects = await Project.findAll({ include: 'manager' });
    res.json(projects);
});

app.post('/api/projects', authenticateToken, authorize(['Manager', 'Admin']), async (req, res) => {
    const project = await Project.create({ ...req.body, managerId: req.user.id });
    res.status(201).json(project);
});

app.delete('/api/projects/:id', authenticateToken, authorize(['Admin']), async (req, res) => {
    await Project.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
});

// TASKS
app.post('/api/projects/:id/tasks', authenticateToken, authorize(['Manager', 'Admin']), async (req, res) => {
    const task = await Task.create({ ...req.body, projectId: req.params.id });
    res.status(201).json(task);
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    // Employees can update status, Managers/Admins can update everything
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updates = req.user.role === 'Employee' ? { status: req.body.status } : req.body;
    await task.update(updates);
    res.json(task);
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
