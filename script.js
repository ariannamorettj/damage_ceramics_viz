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
  "604": [-12.0464, -77.0428],   // Peru (Lima)
  "MED": [41.33, 19.82] // Mediterranean area (roman - bizantine influence)
};

const csvFilePath = 'input_data_per_web/unified_dataset_ceramics_ver2.csv';

const palette = ["#4793AF", "#FFC470", "#DD5746", "#8B322C", "#B36A5E", "#A64942", "#D99152"];
const groupCounts = {};
const allMaterials = new Set();
const allLacuna = new Set();

// Dictionary to translate French material names to English
const materialTranslations = {
  "terre cuite": "Terracotta",
  "terraglia": "Creamware",
  "porcellaine": "Porcellain",
  "porceclaine": "Porcellain",
  "faïence": "Earthenware",
  "grés": "Stonewear",
  "quartz": "Quartz",
  "mixte": "Mix",
  "métal": "Metal",
  "mixte(terre cuite+quartz)": "Mix (Terracotta + Quartz)",
  "mixte (grés + métal)": "Mix (Stonewear + Metal)"
};

// Function to normalize the lacuna percentage value
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

// Load and parse the CSV file using Papa Parse
Papa.parse(csvFilePath, {
  header: true,
  download: true,
  complete: function(results) {
    const data = results.data;
    console.log(`Total rows in CSV: ${data.length}`);

    addMarkers(data);

    // Array to store rows that cannot be processed
    const unprocessedRows = [];

    // Process each row for chart and card rendering
    data.forEach(row => {
      const rawLacuna = row["% lacunaire"];
      const rawMaterial = row["matériau simplifié"] || "";
      const materialKey = rawMaterial.trim().toLowerCase();
      const translatedMaterial = materialTranslations[materialKey] || rawMaterial;
      const lacuna = normalizeLacuna(rawLacuna);

      // Log rows that do not have both a material and lacuna value
      if (!lacuna || !rawMaterial) {
        unprocessedRows.push(row);
        return;
      }

      allLacuna.add(lacuna);
      allMaterials.add(translatedMaterial);

      if (!groupCounts[lacuna]) groupCounts[lacuna] = {};
      groupCounts[lacuna][translatedMaterial] = (groupCounts[lacuna][translatedMaterial] || 0) + 1;
    });

    console.log(`Processed entries: ${Array.from(allMaterials).length} materials, ${Array.from(allLacuna).length} lacuna labels.`);
    if (unprocessedRows.length > 0) {
      console.warn("Rows that could not be processed:", unprocessedRows);
    } else {
      console.log("All rows processed successfully.");
    }

    renderChart();
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
    const provenanceText = row["provenance"];

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
      // Create a marker
      const marker = L.marker(coords);
      // Add a popup with the inventory and provenance text
      marker.bindPopup(`<strong>Inventory:</strong> ${inventaire}<br><strong>Provenance:</strong> ${provenanceText}`);
      markersCluster.addLayer(marker);
    } else {
      console.warn(`Row with inventory ${inventaire} has an unrecognized country code: ${countryCode}`);
    }
  });
}

// Function to render the chart (bar chart for lacuna distribution)
function renderChart() {
  const labels = ["0-10%", "10-25%", "25-50%", "50-75%", "75-100%", "range", "other"].filter(label => allLacuna.has(label));
  const sortedMaterials = Array.from(allMaterials).sort();

  const datasets = sortedMaterials.map((material, idx) => {
    return {
      label: material,
      data: labels.map(lacuna => (groupCounts[lacuna]?.[material] || 0)),
      backgroundColor: palette[idx % palette.length]
    };
  });

  new Chart(document.getElementById('lacunaChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: '% Lacuna per Material (dynamic)' }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: '% Lacuna' } },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Number of artifacts' } }
      }
    }
  });
}

// Dictionary of background images for materials
const backgroundImages = {
  "Earthenware": "assets/materials/fa-ence.jpg",
  "Stonewear": "assets/materials/gr-s.jpg",
  "Mix (Stonewear + Metal)": "assets/materials/mixte--gr-s---m-tal-.jpg",
  "Mix (Terracotta + Quartz)": "assets/materials/mixte-terre-cuite-quartz-.jpg",
  "Porcellain": "assets/materials/porceclaine.jpg",
  "Creamware": "assets/materials/terraglia.jpg",
  "Terracotta": "assets/materials/terre-cuite.jpg"
};

// Function to render material cards using Bootstrap collapse sections and modals
function renderMaterialCards() {
  const container = document.getElementById("materialCardContainer");
  container.innerHTML = "";

  const colors = {
    "0-10%": "#4793AF",
    "10-25%": "#FFC470",
    "25-50%": "#DD5746",
    "50-75%": "#8B322C",
    "75-100%": "#B36A5E",
    "range": "#A64942",
    "other": "#D99152"
  };

  const lacunaLabels = Object.keys(colors);
  // Sorted list of translated materials
  const sortedMaterials = Array.from(allMaterials).sort();

  sortedMaterials.forEach(material => {
    const materialId = material.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const distribution = lacunaLabels.map(lacuna => ({
      category: lacuna,
      count: groupCounts[lacuna]?.[material] || 0
    })).filter(entry => entry.count > 0);

    // Use the background image from the dictionary if available
    const imagePath = backgroundImages[material] || `assets/materials/${materialId}.jpg`;
    console.log("Image path:", imagePath);

    // Card HTML
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

    // Modal HTML
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

    // Initialize the chart when the modal is shown
    const targetModal = document.getElementById(`modal-${materialId}`);
    targetModal.addEventListener('shown.bs.modal', function () {
      const ctx = document.getElementById(`chart-${materialId}`).getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: distribution.map(d => d.category),
          datasets: [{
            data: distribution.map(d => d.count),
            backgroundColor: distribution.map(d => colors[d.category])
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