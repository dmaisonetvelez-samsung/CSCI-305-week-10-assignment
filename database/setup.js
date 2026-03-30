const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const db = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
});

// User Model
const User = db.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { 
        type: DataTypes.ENUM('Employee', 'Manager', 'Admin'), 
        defaultValue: 'Employee' 
    }
});

// Project Model
const Project = db.define('Project', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'active' }
});

// Task Model
const Task = db.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    priority: { type: DataTypes.STRING, defaultValue: 'medium' }
});

// Relationships
User.hasMany(Project, { as: 'managedProjects', foreignKey: 'managerId' });
Project.belongsTo(User, { as: 'manager', foreignKey: 'managerId' });

Project.hasMany(Task, { foreignKey: 'projectId', onDelete: 'CASCADE' });
Task.belongsTo(Project, { foreignKey: 'projectId' });

User.hasMany(Task, { foreignKey: 'assignedUserId' });
Task.belongsTo(User, { as: 'assignedUser', foreignKey: 'assignedUserId' });

// Setup function for the npm run setup script
const initDb = async () => {
    try {
        await db.sync({ force: true });
        console.log("Database synced successfully.");
    } catch (err) {
        console.error("Database sync failed:", err);
    }
};

if (require.main === module) {
    initDb();
}

module.exports = { db, User, Project, Task };
