const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TASKS_FILE = path.join(__dirname, '../.tasks.json');

function readTasks() {
    if (!fs.existsSync(TASKS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function writeTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 4));
}

function checkPid(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

function cleanDeadTasks() {
    const tasks = readTasks();
    let changed = false;
    for (const [id, task] of Object.entries(tasks)) {
        if (task.status === 'running' && !checkPid(task.pid)) {
            task.status = 'failed';
            task.message = 'El proceso se cerró inesperadamente.';
            changed = true;
        }
    }
    if (changed) writeTasks(tasks);
    return tasks;
}

module.exports = {
    startTask: function(taskName, scriptName) {
        const tasks = cleanDeadTasks();
        const taskId = Date.now().toString();
        
        // Spawn the background process detached
        const out = fs.openSync(path.join(__dirname, '../logs', `${taskId}.log`), 'a');
        const err = fs.openSync(path.join(__dirname, '../logs', `${taskId}.err`), 'a');
        
        if (!fs.existsSync(path.join(__dirname, '../logs'))) {
            fs.mkdirSync(path.join(__dirname, '../logs'));
        }

        const child = spawn('node', [path.join(__dirname, scriptName), taskId], {
            detached: true,
            stdio: ['ignore', out, err]
        });
        
        child.unref(); // Allow the parent (kekosuite CLI) to exit while this keeps running
        
        tasks[taskId] = {
            id: taskId,
            name: taskName,
            pid: child.pid,
            progress: 0,
            total: 0,
            message: 'Iniciando proceso...',
            status: 'running',
            startedAt: Date.now()
        };
        
        writeTasks(tasks);
        return taskId;
    },

    updateProgress: function(taskId, progress, total, message) {
        const tasks = readTasks();
        if (tasks[taskId]) {
            tasks[taskId].progress = progress;
            tasks[taskId].total = total;
            tasks[taskId].message = message;
            writeTasks(tasks);
        }
    },

    finishTask: function(taskId, status, message) {
        const tasks = readTasks();
        if (tasks[taskId]) {
            tasks[taskId].status = status; // 'completed' or 'failed'
            tasks[taskId].message = message;
            tasks[taskId].progress = tasks[taskId].total; // 100%
            tasks[taskId].finishedAt = Date.now();
            writeTasks(tasks);
        }
    },

    getActiveTasks: function() {
        return cleanDeadTasks();
    },

    clearCompletedTasks: function() {
        const tasks = readTasks();
        for (const id in tasks) {
            if (tasks[id].status !== 'running') {
                delete tasks[id];
            }
        }
        writeTasks(tasks);
    }
};
