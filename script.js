// Initialize the map centered in Europe
const map = L.map('map').setView([50, 10], 4);

// Add the base layer OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Create a group for marker clusters
const markersCluster = L.markerClusterGroup();
map.addLayer(markersCluster);

/* Dictionary of country coordinates (based on numeric codes) */
const countryCoordinates = {
  "250": [46.2276, 2.2137],    // France
  "380": [41.8719, 12.5674],    // Italy
  "276": [51.1657, 10.4515],    // Germany
  "724": [40.4637, -3.7492],    // Spain
  "56":  [50.5039, 4.4699],     // Belgium
  "528": [52.1326, 5.2913],     // Netherlands
  "246": [61.9241, 25.7482],    // Finland
  "756": [46.8182, 8.2275],     // Switzerland
  "156": [35.8617, 104.1954],   // China
  "364": [32.4279, 53.6880],    // Iran
  "356": [20.5937, 78.9629],    // India
  "368": [33.2232, 43.6793],    // Iraq
  "616": [51.9194, 19.1451],    // Poland
  "620": [39.3999, -8.2245],    // Portugal
  "818": [26.8206, 30.8025],    // Egypt
  "826": [55.3781, -3.4360],    // United Kingdom
  "642": [45.9432, 24.9668],    // Romania
  "392": [36.2048, 138.2529],   // Japan
  "MAG": [32.0000, -5.0000],    // Maghreb region (approximate)
  "604": [-12.0464, -77.0428],  // Peru (Lima)
  "MED": [41.0082, 28.9784],    // Mediterranean area (Istanbul)
  "788": [33.8869, 9.5375]      // Tunisia (country center)
};

const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver7.csv';

const palette = ["#4793AF", "#FFC470", "#DD5746", "#8B322C", "#B36A5E", "#A64942", "#D99152"];
const allMaterials = new Set();

// Dictionary to translate French material names to English
const materialTranslations = {
  "terre cuite": "Terracotta",
  "terraglia": "Creamware",
  "porcelaine": "Porcellain",
  "faïence": "Earthenware",
  "grés": "Stonewear",
  "quartz": "Quartz",
  "mixte": "Mix",
  "métal": "Metal",
  "mixte(terre cuite+quartz)": "Mix (Terracotta + Quartz)",
  "mixte (grés + métal)": "Mix (Stonewear + Metal)"
};

// (La funzione normalizeLacuna non viene più utilizzata per i chart, ma la lasciamo per eventuali altre necessità)
function normalizeLacuna(val) {
  if (!val) return "other";
  val = val.toString().replace(',', '.').replace('%', '').trim();
  try {
    if (val.includes('<') && !val.includes('x')) {
      const num = parseFloat(val.replace('<', ''));
      if (num <= 10) return "0-10%";
      if (num <= 25) return "10-25%";
    }
    if (val.includes('x') || val.includes('-')) return "range";
    const num = parseFloat(val);
    if (num <= 10) return "0-10%";
    if (num <= 25) return "10-25%";
    if (num <= 50) return "25-50%";
    if (num <= 75) return "50-75%";
    return "75-100%";
  } catch {
    return "other";
  }
}

// --- NEW DATA STRUCTURES for the three visualizations ---
// Chart 1: raggruppamento per valore "raw" incontrato
const groupCountsRaw = {};

// Chart 2: raggruppamento per valori approssimati
// (usa questo mapping per aggregare)
const valoriApproximati = {
  "0": ["0"],
  "5": ["<5", "0-5"],
  "10": ["<10", "10"],
  "15": ["15", "10-20", "10-15"],  // "10-15" aggiunto per coerenza
  "20": ["15-20", "20"],
  "25": ["<25", "20-25"],
  "30": ["30", "<30", "25-30"],
  "35": ["30-40", ">30", "35"],
  "40": ["40", "<40"],
  "45": [],
  "50": ["50"],
  ">50": [">50", ">70", "60"],
  "unknown": ["(?)"]
};
const groupCountsApprox = {};

// Chart 3: per il calcolo della media numerica (% lacuna) per materiale
// (usa questo mapping per convertire le etichette in valore numerico)
const mappaturaValori = {
  "<10": 8,
  "40": 40,
  "15": 15,
  "15-20": 17,
  "10-15": 12,
  "30": 30,
  "10": 10,
  "30-40": 35,
  "50": 50,
  "<40": 38,
  "(?)": "unknown",
  "0": 0,
  "<5": 3,
  "<30": 28,
  "0-5": 2,
  "20": 20,
  "10-20": 15,
  ">50": 52,
  "<25": 23,
  ">70": 72,
  ">30": 32,
  "20-25": 22,
  "35": 35,
  "25-30": 27,
  "60": 60
};
const materialSums = {};   // somma dei valori numerici per materiale
const materialCounts = {}; // numero di oggetti per materiale

// Load and parse the CSV file using Papa Parse
Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    console.log(`Total rows in CSV: ${data.length}`);

    addMarkers(data);

    const unprocessedRows = [];

    data.forEach(row => {
      const rawLacuna = row["% lacunaire"];
      const rawMaterial = row["matériau simplifié"] || "";
      const materialKey = rawMaterial.trim().toLowerCase();
      const translatedMaterial = materialTranslations[materialKey] || rawMaterial;

      if (!rawLacuna || !rawMaterial) {
        unprocessedRows.push(row);
        return;
      }

      const trimmedLacuna = rawLacuna.trim();
      allMaterials.add(translatedMaterial);

      // Chart 1: raggruppa per valore "raw" della % lacunaire
      if (!groupCountsRaw[trimmedLacuna]) {
        groupCountsRaw[trimmedLacuna] = {};
      }
      groupCountsRaw[trimmedLacuna][translatedMaterial] = (groupCountsRaw[trimmedLacuna][translatedMaterial] || 0) + 1;

      // Chart 2: raggruppa in base al mapping dei valori approssimati
      for (const key in valoriApproximati) {
        if (valoriApproximati[key].includes(trimmedLacuna)) {
          if (!groupCountsApprox[key]) {
            groupCountsApprox[key] = {};
          }
          groupCountsApprox[key][translatedMaterial] = (groupCountsApprox[key][translatedMaterial] || 0) + 1;
          break; // si assume che ogni valore rientri in un solo gruppo
        }
      }

      // Chart 3: accumula il valore numerico per calcolare la media per materiale
      const numVal = mappaturaValori[trimmedLacuna];
      if (numVal !== undefined && numVal !== "unknown") {
        if (!materialSums[translatedMaterial]) {
          materialSums[translatedMaterial] = 0;
          materialCounts[translatedMaterial] = 0;
        }
        materialSums[translatedMaterial] += numVal;
        materialCounts[translatedMaterial] += 1;
      }
    });

    console.log(`Processed materials: ${Array.from(allMaterials).length}`);
    if (unprocessedRows.length > 0) {
      console.warn("Rows that could not be processed:", unprocessedRows);
    } else {
      console.log("All rows processed successfully.");
    }

    // Render the three charts
    renderChartAllData();
    renderChartApprox();
    renderChartMaterialAverage();
    renderMaterialCards();
  },
  error: function(err) {
    console.error("Error loading CSV: ", err);
  }
});

// Function to add markers to the map based on country coordinates
function addMarkers(data) {
  data.forEach(row => {
    const inventaire = row["inventaire"];
    let countryCode = row["provenance (country code)"];
    const provenanceText = row["provenance@en"];

    if (countryCode) {
      // Split by semicolon and take the first value
      countryCode = countryCode.split(';')[0].trim();
      // Remove any occurrence of "(?)"
      countryCode = countryCode.replace(/\(\?\)/g, '').trim();
    } else {
      console.warn(`Row with inventory ${inventaire} has no country code.`);
    }

    if (countryCode && countryCoordinates[countryCode]) {
      const coords = countryCoordinates[countryCode];
      const marker = L.marker(coords);
      marker.bindPopup(`<strong>Inventory:</strong> ${inventaire}<br><strong>Provenance:</strong> ${provenanceText}`);
      markersCluster.addLayer(marker);
    } else {
      console.warn(`Row with inventory ${inventaire} has an unrecognized country code: ${countryCode}`);
    }
  });
}

// --- Chart Rendering Functions ---

// Chart 1: Stacked bar chart con gruppi per ogni valore "raw" di "% lacunaire"
// Ordinamento semantico: se inizia con "<" o ">" viene modificato l'effettivo valore per posizionarlo correttamente.
function renderChartAllData() {
  function parseLabel(label) {
    label = label.trim();
    if (label.startsWith("<")) {
      const num = parseFloat(label.slice(1));
      return num - 0.1;
    }
    if (label.startsWith(">")) {
      const num = parseFloat(label.slice(1));
      return num + 0.1;
    }
    if (label.includes("-")) {
      const parts = label.split("-");
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) {
          return (a + b) / 2;
        }
      }
    }
    const num = parseFloat(label);
    if (!isNaN(num)) return num;
    return Infinity;
  }

  const labels = Array.from(Object.keys(groupCountsRaw)).sort((a, b) => parseLabel(a) - parseLabel(b));
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => ({
    label: material,
    data: labels.map(lacuna => (groupCountsRaw[lacuna]?.[material] || 0)),
    backgroundColor: palette[idx % palette.length]
  }));

  new Chart(document.getElementById('chartAllData'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacuna (Raw Values) per Material' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Raw % Lacuna Values' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of Artifacts' } }
      }
    }
  });
}

// Chart 2: Stacked bar chart raggruppato con i valori approssimati
function renderChartApprox() {
  // Ordine desiderato per le colonne
  const approxOrder = ["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", ">50", "unknown"];
  // Considera solo le chiavi per cui ci sono dati
  const labels = approxOrder.filter(key => groupCountsApprox[key] !== undefined);
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => ({
    label: material,
    data: labels.map(key => (groupCountsApprox[key]?.[material] || 0)),
    backgroundColor: palette[idx % palette.length]
  }));

  new Chart(document.getElementById('chartApprox'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacuna (Approximated) per Material' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Approximated % Lacuna Groups' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of Artifacts' } }
      }
    }
  });
}

// Chart 3: Bar chart (non stacked) per la media numerica di % lacuna per materiale
function renderChartMaterialAverage() {
  const sortedMaterials = Array.from(allMaterials).sort();
  const labels = sortedMaterials;
  const averages = sortedMaterials.map(material => {
    if (materialCounts[material]) {
      return (materialSums[material] / materialCounts[material]).toFixed(2);
    }
    return 0;
  });

  new Chart(document.getElementById('chartMaterialAverage'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average % Lacuna Value',
        data: averages,
        backgroundColor: sortedMaterials.map((_, idx) => palette[idx % palette.length])
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Average Numeric % Lacuna per Material' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const material = context.label;
              const avg = context.raw;
              const count = materialCounts[material] || 0;
              return `Avg: ${avg} - Total Objects: ${count}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Material' } },
        y: { beginAtZero: true, title: { display: true, text: 'Average Value' } }
      }
    }
  });
}

// Function to render material cards (modal with material distribution charts)
// Ora, ogni doughnut mostra la distribuzione dei gruppi approssimati (groupCountsApprox)
// e nella legenda viene mostrato il valore seguito da "%" (eccetto per "unknown")
const backgroundImages = {
  "Earthenware": "assets/materials/fa-ence.jpg",
  "Stonewear": "assets/materials/gr-s.jpg",
  "Mix (Stonewear + Metal)": "assets/materials/mixte--gr-s---m-tal-.jpg",
  "Mix (Terracotta + Quartz)": "assets/materials/mixte-terre-cuite-quartz-.jpg",
  "Porcellain": "assets/materials/porceclaine.jpg",
  "Creamware": "assets/materials/terraglia.jpg",
  "Terracotta": "assets/materials/terre-cuite.jpg"
};

function renderMaterialCards() {
  const container = document.getElementById("materialCardContainer");
  container.innerHTML = "";

  // Definiamo l'ordine dei gruppi per la distribuzione, lo stesso usato in Chart 2
  const approxOrder = ["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", ">50", "unknown"];
  // Definiamo i colori per ogni gruppo (puoi personalizzarli)
  const groupColors = {
    "0": "#4793AF",
    "5": "#FFC470",
    "10": "#DD5746",
    "15": "#8B322C",
    "20": "#B36A5E",
    "25": "#A64942",
    "30": "#D99152",
    "35": "#4793AF",
    "40": "#FFC470",
    "45": "#DD5746",
    "50": "#8B322C",
    ">50": "#B36A5E",
    "unknown": "#A64942"
  };

  const sortedMaterials = Array.from(allMaterials).sort();

  sortedMaterials.forEach(material => {
    const materialId = material.toLowerCase().replace(/[^a-z0-9]/g, "-");
    // Costruiamo la distribuzione usando groupCountsApprox per il materiale corrente
    const distribution = approxOrder.map(group => ({
      category: group,
      count: (groupCountsApprox[group] && groupCountsApprox[group][material]) ? groupCountsApprox[group][material] : 0
    }));

    const imagePath = backgroundImages[material] || `assets/materials/${materialId}.jpg`;
    console.log("Image path:", imagePath);

    const cardHTML = `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100 shadow-sm" role="button" data-bs-toggle="modal" data-bs-target="#modal-${materialId}">
          <img src="${imagePath}" class="card-img-top" alt="${material}" onerror="this.onerror=null;this.src='assets/placeholder.jpeg';">
          <div class="card-body text-center">
            <h5 class="card-title">${material}</h5>
            <p class="text-muted small">Click to see the distribution</p>
          </div>
        </div>
      </div>
    `;

    const modalHTML = `
      <div class="modal fade" id="modal-${materialId}" tabindex="-1" aria-labelledby="modalLabel-${materialId}" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header" style="background-color: #4793AF; color: white;">
              <h5 class="modal-title" id="modalLabel-${materialId}">Lacuna Distribution – ${material}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center">
              <canvas id="chart-${materialId}" width="400" height="400"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML("beforeend", cardHTML);
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const targetModal = document.getElementById(`modal-${materialId}`);
    targetModal.addEventListener('shown.bs.modal', function () {
      const ctx = document.getElementById(`chart-${materialId}`).getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          // Per i label, aggiungiamo "%" accanto al valore se non è "unknown"
          labels: distribution.map(d => (d.category === "unknown" ? d.category : d.category + "%")),
          datasets: [{
            data: distribution.map(d => d.count),
            backgroundColor: distribution.map(d => groupColors[d.category] || "#cccccc")
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: {
              display: true,
              text: `% Lacuna – ${material}`
            }
          }
        }
      });
    }, { once: true });
  });
}