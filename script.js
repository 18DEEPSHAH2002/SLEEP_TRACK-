const sleepForm = document.getElementById('sleepForm');
const recordsList = document.getElementById('recordsList');
const clearDataBtn = document.getElementById('clearData');

let records = [];

// Load data on startup
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateUI();
});

sleepForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const date = document.getElementById('date').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    if (!date || !startTime || !endTime) {
        alert("Please fill all fields");
        return;
    }

    const duration = calculateDuration(startTime, endTime);
    
    const record = {
        id: Date.now(),
        date,
        startTime,
        endTime,
        duration
    };
    
    records.push(record);
    saveData();
    updateUI();
    sleepForm.reset();
});

clearDataBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all data?")) {
        records = [];
        saveData();
        updateUI();
    }
});

function calculateDuration(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    if (endMinutes < startMinutes) {
        // Crossed midnight
        endMinutes += 24 * 60;
    }
    
    const diffMinutes = endMinutes - startMinutes;
    return parseFloat((diffMinutes / 60).toFixed(2));
}

function saveData() {
    localStorage.setItem('sleepRecords', JSON.stringify(records));
}

function loadData() {
    const data = localStorage.getItem('sleepRecords');
    if (data) {
        records = JSON.parse(data);
    }
}

function updateUI() {
    renderRecords();
    if (typeof analyzeSleep === 'function') analyzeSleep(); 
    if (typeof updateCharts === 'function') updateCharts();
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours);
    const m = minutes;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${m} ${ampm}`;
}

function renderRecords() {
    recordsList.innerHTML = '';
    // Sort records by date descending, then time
    const sortedRecords = [...records].sort((a, b) => {
        if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
        return b.id - a.id;
    });

    if (sortedRecords.length === 0) {
        recordsList.innerHTML = '<p>No records found.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'record-list';

    sortedRecords.forEach(record => {
        const li = document.createElement('li');
        li.className = 'record-item';
        li.innerHTML = `
            <span><strong>${record.date}</strong>: ${formatTime(record.startTime)} - ${formatTime(record.endTime)}</span>
            <span>${record.duration} hrs</span>
            <button onclick="deleteRecord(${record.id})" class="delete-btn">x</button>
        `;
        ul.appendChild(li);
    });
    recordsList.appendChild(ul);
}

// Global scope for onclick
window.deleteRecord = function(id) {
    if (confirm("Delete this record?")) {
        records = records.filter(r => r.id !== id);
        saveData();
        updateUI();
    }
};

function analyzeSleep() {
    if (records.length === 0) {
        document.getElementById('totalDays').innerText = "0";
        document.getElementById('averageSleep').innerText = "0";
        document.getElementById('sleepStatus').innerText = "-";
        document.getElementById('statusDetail').innerText = "";
        return;
    }

    // Group by date
    const dailySleep = {};
    records.forEach(record => {
        if (!dailySleep[record.date]) {
            dailySleep[record.date] = 0;
        }
        dailySleep[record.date] += record.duration;
    });

    const uniqueDays = Object.keys(dailySleep).length;
    const totalSleepAllDays = Object.values(dailySleep).reduce((a, b) => a + b, 0);
    const average = totalSleepAllDays / uniqueDays;

    document.getElementById('totalDays').innerText = uniqueDays;
    document.getElementById('averageSleep').innerText = average.toFixed(2);

    const threshold = 7.5;
    const diff = average - threshold;
    const statusSpan = document.getElementById('sleepStatus');
    const detailP = document.getElementById('statusDetail');

    if (diff > 0) {
        statusSpan.innerText = "Over Sleep";
        statusSpan.style.color = "#d9534f"; // Red
        detailP.innerText = `You are sleeping ${diff.toFixed(2)} hours more than the 7.5h average.`;
    } else if (diff < 0) {
        statusSpan.innerText = "Under Sleep";
        statusSpan.style.color = "#f0ad4e"; // Orange
        detailP.innerText = `You are sleeping ${Math.abs(diff).toFixed(2)} hours less than the 7.5h average.`;
    } else {
        statusSpan.innerText = "Perfect Balance";
        statusSpan.style.color = "#5cb85c"; // Green
        detailP.innerText = "You are sleeping exactly 7.5 hours on average.";
    }
}

let weeklyChartInstance = null;
let monthlyChartInstance = null;

function updateCharts() {
    // Aggregate by date first
    const dailySleep = {};
    records.forEach(record => {
        if (!dailySleep[record.date]) dailySleep[record.date] = 0;
        dailySleep[record.date] += record.duration;
    });

    // Helper to get dates
    function getLastNDays(n) {
        const dates = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }

    const last7Days = getLastNDays(7);
    const last30Days = getLastNDays(30);

    const weeklyData = last7Days.map(date => dailySleep[date] || 0);
    const monthlyData = last30Days.map(date => dailySleep[date] || 0);

    renderChart('weeklyChart', last7Days, weeklyData, 'Weekly Sleep (hrs)', 'rgba(75, 192, 192, 0.2)', 'rgba(75, 192, 192, 1)');
    renderChart('monthlyChart', last30Days, monthlyData, 'Monthly Sleep (hrs)', 'rgba(153, 102, 255, 0.2)', 'rgba(153, 102, 255, 1)');
}

function renderChart(canvasId, labels, data, label, bgColor, borderColor) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart if updating
    if (canvasId === 'weeklyChart') {
        if (weeklyChartInstance) weeklyChartInstance.destroy();
    } else if (canvasId === 'monthlyChart') {
        if (monthlyChartInstance) monthlyChartInstance.destroy();
    }

    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: bgColor,
                borderColor: borderColor,
                borderWidth: 1,
                fill: true
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    const newChart = new Chart(ctx, config);

    if (canvasId === 'weeklyChart') {
        weeklyChartInstance = newChart;
    } else {
        monthlyChartInstance = newChart;
    }
}
