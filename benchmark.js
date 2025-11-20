/* ============================================================
   Benchmark First Fit / Best Fit / Worst Fit
   ============================================================ */

function RNG(seed) {
    let s = seed || Math.floor(Math.random() * 1e9);
    return function () {
        s = (s * 48271) % 0x7fffffff;
        return s / 0x7fffffff;
    };
}

class MemorySim {
    constructor(size, strategy) {
        this.size = size;
        this.strategy = strategy;
        this.mem = new Array(size).fill(null);
        this.procId = 1;
        this.success = 0;
        this.fail = 0;
        this.holeSamples = [];
        this.fragSamples = [];
        this.ops = 0;
        this.procSizes = [];   // lưu kích thước tiến trình đã cấp phát
    }

    getHoles() {
        let holes = [];
        let i = 0;
        while (i < this.size) {
            if (this.mem[i] === null) {
                let j = i;
                while (j < this.size && this.mem[j] === null) j++;
                holes.push({ start: i, size: j - i });
                i = j;
            } else i++;
        }
        return holes;
    }

    externalFrag() {
        const holes = this.getHoles();
        const free = this.mem.filter(x => x === null).length;
        if (!free) return 0;

        // 🔥 avgNeed dựa trên tiến trình thực tế
        const avgNeed = this.procSizes.length
            ? this.procSizes.reduce((a, b) => a + b, 0) / this.procSizes.length
            : 6; // fallback nếu chưa có tiến trình nào

        let wasted = 0;
        holes.forEach(h => {
            if (h.size < avgNeed) wasted += h.size;
        });
        return wasted / free;
    }

    allocate(size) {
        const holes = this.getHoles();
        let candidate = null;
        if (this.strategy === "first") {
            candidate = holes.find(h => h.size >= size);
        } else if (this.strategy === "best") {
            candidate = holes.filter(h => h.size >= size).sort((a, b) => a.size - b.size)[0];
        } else if (this.strategy === "worst") {
            candidate = holes.filter(h => h.size >= size).sort((a, b) => b.size - a.size)[0];
        }
        if (!candidate) {
            this.fail++;
            return null;
        }
        const id = "proc-" + (this.procId++);
        for (let i = 0; i < size; i++) {
            this.mem[candidate.start + i] = id;
        }
        this.success++;
        this.procSizes.push(size);   // 🔥 lưu kích thước tiến trình
        return id;
    }

    free(id) {
        for (let i = 0; i < this.size; i++) {
            if (this.mem[i] === id) this.mem[i] = null;
        }
    }

    step(rng) {
        this.ops++;
        if (rng() < 0.7) {
            const size = Math.floor(rng() * 12) + 1;
            this.allocate(size);
        } else {
            const ids = Array.from(new Set(this.mem.filter(x => x !== null)));
            if (ids.length) {
                const id = ids[Math.floor(rng() * ids.length)];
                this.free(id);
            }
        }
        this.holeSamples.push(this.getHoles().length);
        this.fragSamples.push(this.externalFrag());
    }

    summary() {
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const totalOps = this.success + this.fail;
        const successRate = totalOps ? this.success / totalOps : 0;
        return {
            strategy: this.strategy,
            success: this.success,
            fail: this.fail,
            successRate: successRate,
            avgHoles: avg(this.holeSamples),
            avgFrag: avg(this.fragSamples),
            ops: this.ops
        };
    }
}


/* ============================================================
   MAIN BENCHMARK FUNCTION
============================================================ */
async function runBenchmark(params, logger) {
    const { opsCount, memSize, seed } = params;
    const rng = RNG(seed || Date.now());
    let sims = [
        new MemorySim(memSize, "first"),
        new MemorySim(memSize, "best"),
        new MemorySim(memSize, "worst")
    ];
    for (let i = 0; i < opsCount; i++) {
        sims.forEach(sim => sim.step(rng));
        if (i % 200 === 0) await new Promise(res => setTimeout(res, 10));
    }
    let results = sims.map(sim => sim.summary());
    logger("=== DONE ===");
    results.forEach(r =>
        logger(`${r.strategy.toUpperCase()} | successRate=${(r.successRate*100).toFixed(2)}% | avgHoles=${r.avgHoles.toFixed(1)} | extFrag=${(r.avgFrag*100).toFixed(1)}%`)
    );
    return results;
}

/* ============================================================
   CSV EXPORT
============================================================ */
function resultsToCSV(results) {
    let csv = "strategy,success,fail,successRate,avgHoles,avgFrag,ops\n";
    results.forEach(r => {
        csv += `${r.strategy},${r.success},${r.fail},${r.successRate.toFixed(4)},${r.avgHoles.toFixed(3)},${r.avgFrag.toFixed(4)},${r.ops}\n`;
    });
    return csv;
}
function downloadCSV(results) {
    const csv = resultsToCSV(results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "benchmark_results.csv";
    a.click();
}

/* ============================================================
   DRAW CHART
============================================================ */
let benchmarkChart = null;
function drawChart(results) {
  const ctx = document.getElementById("chart").getContext("2d");
  if (benchmarkChart) benchmarkChart.destroy();

  benchmarkChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["First Fit", "Best Fit", "Worst Fit"],
      datasets: [
        {
          label: "Success Rate (%)",
          data: results.map(r => r.successRate * 100),
          backgroundColor: "#3498db"
        },
        {
          label: "Avg Holes",
          data: results.map(r => r.avgHoles),
          backgroundColor: "#2ecc71"
        },
        {
          label: "External Frag (%)",
          data: results.map(r => r.avgFrag * 100),
          backgroundColor: "#e74c3c"
        }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}


// Bảng màu xoay vòng
const COLORS = [
  "#e74c3c", "#9b59b6", "#f39c12", "#1abc9c", "#3498db",
  "#2ecc71", "#d35400", "#7f8c8d", "#16a085", "#c0392b",
  "#8e44ad", "#27ae60", "#2980b9", "#f1c40f", "#34495e"
];

// Hàm lấy màu theo id tiến trình
function getColor(id) {
  const num = parseInt(id.replace(/[^0-9]/g, "")); // lấy số từ id
  return COLORS[(num - 1) % COLORS.length];
}

function render(){
  memDiv.innerHTML = '';
  for(let i=0;i<CELLS;i++){
    const c = document.createElement('div');
    if (memory[i]) {
      const id = memory[i].id;
      c.className = 'cell';
      c.style.backgroundColor = getColor(id); // tô màu trực tiếp
      c.title = id;
    } else {
      c.className = 'cell hole';
    }
    memDiv.appendChild(c);
  }
  updateStats();
  renderTable();
}

