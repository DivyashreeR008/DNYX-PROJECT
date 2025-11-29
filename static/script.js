let students = [];
let charts = {};

async function loadStudents() {
  try {
    const res = await fetch("/api/students");
    students = await res.json();
    renderStudents();
    loadOverviewStats();
    loadCharts();
    console.log(`✅ Loaded ${students.length} students from PostgreSQL studentdb`);
  } catch(e) {
    console.error('Failed to load students:', e);
    document.getElementById("total-students").textContent = "Error";
  }
}

// Tab switching (FIXED to match HTML IDs)
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    const tab = button.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById(tab).classList.add("active");
  });
});

function getStatus(g3) {
  if (g3 >= 15) return { text: "Excellent", cls: "status-excellent" };
  if (g3 >= 10) return { text: "Good", cls: "status-good" };
  return { text: "Average", cls: "status-average" };
}

function renderStudents(filter = "") {
  const tbody = document.getElementById("students-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  const q = filter.toLowerCase();
  students.filter(s =>
    !q || String(s.id).includes(q) || 
    (s.school||"").toLowerCase().includes(q) || 
    (s.gender||"").toLowerCase().includes(q)
  ).forEach(s => {
    const status = getStatus(s.g3);
    tbody.innerHTML += `
      <tr>
        <td>${s.id}</td>
        <td>${s.school}</td>
        <td>${s.gender}</td>
        <td>${s.age}</td>
        <td>${s.study}</td>
        <td>${s.failures}</td>
        <td>${s.absences}</td>
        <td>${s.g1}</td>
        <td>${s.g2}</td>
        <td><strong>${s.g3}</strong></td>
        <td><span class="status-pill ${status.cls}">${status.text}</span></td>
      </tr>
    `;
  });
}

document.getElementById("search")?.addEventListener("input", e => renderStudents(e.target.value));

["g1", "g2", "failures", "absences"].forEach(id => {
  const input = document.getElementById(id);
  const label = document.getElementById(id + "-val");
  if (input && label) {
    const update = () => label.textContent = input.value;
    input.addEventListener("input", update);
    update();
  }
});

document.getElementById("predict-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    age: Number(document.getElementById("age").value),
    study: Number(document.getElementById("study-time").value),
    g1: Number(document.getElementById("g1").value),
    g2: Number(document.getElementById("g2").value),
    failures: Number(document.getElementById("failures").value),
    absences: Number(document.getElementById("absences").value)
  };

  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    document.getElementById("pred-grade").textContent = result.predicted_grade;
    document.getElementById("pred-status").textContent = `${result.status} (${result.predicted_grade}/20)`;
  } catch(e) {
    document.getElementById("pred-status").textContent = "Prediction failed";
  }
});

function loadOverviewStats() {
  const total = students.length;
  document.getElementById("total-students").textContent = total || 0;
  document.getElementById("avg-grade").textContent = total ? (students.reduce((a,b)=>a+b.g3,0)/total).toFixed(1) : 0;
  document.getElementById("success-rate").textContent = total ? ((students.filter(s=>s.g3>=10).length/total*100).toFixed(1)+"%") : "0%";
  document.getElementById("avg-age").textContent = total ? (students.reduce((a,b)=>a+b.age,0)/total).toFixed(1) : 0;
}

function loadCharts() {
  // Destroy existing charts
  Object.values(charts).forEach(chart => chart.destroy());
  charts = {};
  
  if (!students.length) return;
  
  // Final Grade Distribution (Histogram)
  const g3Counts = {};
  students.forEach(s => g3Counts[s.g3] = (g3Counts[s.g3] || 0) + 1);
  charts.final = new Chart(document.getElementById("chart-final"), {
    type: "bar",
    data: {
      labels: Object.keys(g3Counts).sort((a,b)=>a-b),
      datasets: [{
        label: "Students",
        data: Object.values(g3Counts),
        backgroundColor: "#2563eb",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });

  // Gender Distribution
  const males = students.filter(s=>s.gender==="M").length;
  const females = students.filter(s=>s.gender==="F").length;
  charts.gender = new Chart(document.getElementById("chart-gender"), {
    type: "doughnut",
    data: {
      labels: ["Male", "Female"],
      datasets: [{
        data: [males, females],
        backgroundColor: ["#3b82f6", "#ec4899"]
      }]
    },
    options: { responsive: true }
  });

  // Study Time (simplified)
  charts.study = new Chart(document.getElementById("chart-study"), {
    type: "bar",
    data: {
      labels: ["1-2h", "2-5h", "5-10h"],
      datasets: [{
        label: "Avg G3",
        data: [12, 13.5, 14.5],
        backgroundColor: "#06b6d4"
      }]
    },
    options: { responsive: true, indexAxis: 'y' }
  });

  // Failures Distribution
  const failureCounts = {};
  students.forEach(s => failureCounts[s.failures] = (failureCounts[s.failures] || 0) + 1);
  charts.failures = new Chart(document.getElementById("chart-failures"), {
    type: "pie",
    data: {
      labels: Object.keys(failureCounts).map(k => `Failures: ${k}`),
      datasets: [{
        data: Object.values(failureCounts),
        backgroundColor: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"]
      }]
    },
    options: { responsive: true }
  });
    // Grade progression (G1 → G3) – average line
  const labelsProg = ["G1", "G2", "G3"];
  const avgG1 = students.reduce((a, s) => a + s.g1, 0) / students.length;
  const avgG2 = students.reduce((a, s) => a + s.g2, 0) / students.length;
  const avgG3 = students.reduce((a, s) => a + s.g3, 0) / students.length;

  charts.progression = new Chart(document.getElementById("chart-progression"), {
    type: "line",
    data: {
      labels: labelsProg,
      datasets: [{
        label: "Average grade",
        data: [avgG1, avgG2, avgG3],
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.2)",
        tension: 0.3
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true, max: 20 } } }
  });

  // Absences vs Final Grade – scatter
  charts.absence = new Chart(document.getElementById("chart-absence"), {
    type: "scatter",
    data: {
      datasets: [{
        label: "Student",
        data: students.map(s => ({ x: s.absences, y: s.g3 })),
        backgroundColor: "#06b6d4"
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: "Absences" } },
        y: { title: { display: true, text: "G3" }, beginAtZero: true, max: 20 }
      }
    }
  });

}

// Auto-reload every 30 seconds
setInterval(loadStudents, 30000);

window.onload = () => loadStudents();
